package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"backend/internal/database" // Use your module name

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// CreateClass handles the creation of a new classroom.
func (h *APIHandler) CreateClass(w http.ResponseWriter, r *http.Request) {
	// Retrieve the user ID from the context (set by AuthMiddleware)
	instructorIDHex, ok := r.Context().Value(UserIDContextKey).(string)
	if !ok {
		http.Error(w, `{"error": "Could not retrieve user ID from token"}`, http.StatusInternalServerError)
		return
	}
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	var req struct {
		Name string `json:"name"`
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")

	// Create the new classroom document
	newClass := database.Classroom{
		ID:           primitive.NewObjectID(),
		Name:         req.Name,
		Code:         req.Code,
		InstructorID: instructorID,
		StudentIDs:   []primitive.ObjectID{instructorID}, // Instructor is auto-enrolled
	}

	_, err := classroomsCollection.InsertOne(context.TODO(), newClass)
	if err != nil {
		// In a real app, you'd check for duplicate code errors specifically
		http.Error(w, `{"error": "Failed to create classroom"}`, http.StatusInternalServerError)
		return
	}

	// Add the classroom to the user's list of classrooms
	usersCollection := h.DB.Collection("users")
	_, err = usersCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": instructorID},
		bson.M{"$addToSet": bson.M{"classroom_ids": newClass.ID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update user's classrooms list"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newClass)
}

// GetMyClasses retrieves all classrooms a user is enrolled in.
func (h *APIHandler) GetMyClasses(w http.ResponseWriter, r *http.Request) {
	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	usersCollection := h.DB.Collection("users")
	classroomsCollection := h.DB.Collection("classrooms")

	var user database.User
	err := usersCollection.FindOne(context.TODO(), bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
		return
	}

	if len(user.ClassroomIDs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]database.Classroom{}) // Return empty JSON array
		return
	}

	// Find all classrooms where the _id is in the user's list
	cursor, err := classroomsCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": user.ClassroomIDs}})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch classrooms"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var classrooms []database.Classroom
	if err = cursor.All(context.TODO(), &classrooms); err != nil {
		http.Error(w, `{"error": "Failed to decode classrooms"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(classrooms)
}

// JoinClass allows a student to join a classroom using a code.
func (h *APIHandler) JoinClass(w http.ResponseWriter, r *http.Request) {
	studentIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	studentID, _ := primitive.ObjectIDFromHex(studentIDHex)

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body, expected 'code'"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	usersCollection := h.DB.Collection("users")

	// Find the classroom by its code
	var classroom database.Classroom
	err := classroomsCollection.FindOne(context.TODO(), bson.M{"code": req.Code}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Classroom with that code not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	// Add student to the classroom's student list
	_, err = classroomsCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": classroom.ID},
		bson.M{"$addToSet": bson.M{"student_ids": studentID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to add student to classroom"}`, http.StatusInternalServerError)
		return
	}

	// Add classroom to the student's classroom list
	_, err = usersCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": studentID},
		bson.M{"$addToSet": bson.M{"classroom_ids": classroom.ID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to add classroom to user"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully joined classroom"})
}

// ... (at the end of the file)

// LeaveClass allows a user to leave a classroom.
func (h *APIHandler) LeaveClass(w http.ResponseWriter, r *http.Request) {
	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	// Get classID from the URL parameter
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID format"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	usersCollection := h.DB.Collection("users")

	// Use $pull to remove an item from an array
	// Remove student from the classroom's student list
	_, err = classroomsCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": classID},
		bson.M{"$pull": bson.M{"student_ids": userID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to remove student from classroom"}`, http.StatusInternalServerError)
		return
	}

	// Remove classroom from the student's classroom list
	_, err = usersCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": userID},
		bson.M{"$pull": bson.M{"classroom_ids": classID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to remove classroom from user"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully left classroom"})
}

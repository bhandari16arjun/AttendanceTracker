package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"backend/internal/database" // Use your module name

	// "github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// CreateClass handles the creation of a new classroom.
// CreateClass handles the creation of a new classroom based on the updated model.
 func (h *APIHandler) CreateClass(w http.ResponseWriter, r *http.Request) {
		// 1. Retrieve the user ID from the context (set by AuthMiddleware)
		instructorIDHex, ok := r.Context().Value(UserIDContextKey).(string)
		if !ok {
			http.Error(w, `{"error": "Could not retrieve user ID from token"}`, http.StatusInternalServerError)
			return
		}
		instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)
	
			// 2. Decode the request body
			var req struct {
				Name string `json:"name"`
				Code string `json:"code"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
				return
			}
	
			classroomsCollection := h.DB.Collection("classrooms")
	
			// 3. Create the new classroom document with the new structure
			newClass := database.Classroom{
				ID:           primitive.NewObjectID(),
				Name:         req.Name,
				Code:         req.Code,
				InstructorID: instructorID,
				// Initialize EnrolledStudents with the instructor, who has attended 0 lectures.
				EnrolledStudents: make(map[string]int),
				// Initialize LectureIDs as an empty slice.
				LectureIDs: []primitive.ObjectID{},
			}
	
			// 4. Insert the new classroom into the database
			_, err := classroomsCollection.InsertOne(context.TODO(), newClass)
			if err != nil {
				// In a real app, you'd check for duplicate code errors specifically
				http.Error(w, `{"error": "Failed to create classroom"}`, http.StatusInternalServerError)
				return
			}
	
			// 5. Respond with the created classroom object
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(newClass)
    }

// GetMyClasses retrieves all classrooms a user is enrolled in by using the AttendanceHistory map.
func (h *APIHandler) GetMyClasses(w http.ResponseWriter, r *http.Request) {
	// 1. Get the user ID from the authentication token.
	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	usersCollection := h.DB.Collection("users")
	classroomsCollection := h.DB.Collection("classrooms")

	// 2. Find the user document to access their history.
	var user database.User
	err := usersCollection.FindOne(context.TODO(), bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
		return
	}

	// 3. Extract the classroom IDs from the keys of the AttendanceHistory map.
	var classroomIDs []primitive.ObjectID
	if user.AttendanceHistory != nil {
		for classIDHex := range user.AttendanceHistory {
			classID, err := primitive.ObjectIDFromHex(classIDHex)
			if err == nil { // Ignore any keys that aren't valid ObjectIDs
				classroomIDs = append(classroomIDs, classID)
			}
		}
	}


	// 4. If the user is in no classrooms, return an empty list.
	if len(classroomIDs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]database.Classroom{}) // Return empty JSON array
		return
	}

	// 5. Find all classrooms where the _id is in the list we just built.
	cursor, err := classroomsCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": classroomIDs}})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch classrooms"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	// 6. Decode the results into a slice of Classroom objects.
	var classrooms []database.Classroom
	if err = cursor.All(context.TODO(), &classrooms); err != nil {
		http.Error(w, `{"error": "Failed to decode classrooms"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(classrooms)
}

// JoinClass allows a student to join a classroom using a code.
// JoinClass allows a student to join a classroom using a code, updating the new data models.
func (h *APIHandler) JoinClass(w http.ResponseWriter, r *http.Request) {
	// 1. Get student ID from the authentication token
	studentIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	studentID, _ := primitive.ObjectIDFromHex(studentIDHex)

	// 2. Get the classroom code from the request body
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body, expected 'code'"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	usersCollection := h.DB.Collection("users")

	// 3. Find the classroom by its unique code
	var classroom database.Classroom
	err := classroomsCollection.FindOne(context.TODO(), bson.M{"code": req.Code}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Classroom with that code not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error while finding classroom"}`, http.StatusInternalServerError)
		return
	}

	// 4. Prevent the instructor from joining their own class as a student
	if classroom.InstructorID == studentID {
		http.Error(w, `{"error": "You cannot join your own class as a student"}`, http.StatusBadRequest)
		return
	}

	// 5. Update the Classroom document to add the new student
	// Using dot notation with $set adds the student to the 'EnrolledStudents' map with 0 lectures attended.
	// This operation is idempotent; running it again won't cause duplicates.
	updateClassroom := bson.M{
		"$set": bson.M{
			"enrolled_students." + studentID.Hex(): 0,
		},
	}
	_, err = classroomsCollection.UpdateOne(context.TODO(), bson.M{"_id": classroom.ID}, updateClassroom)
	if err != nil {
		http.Error(w, `{"error": "Failed to add student to classroom"}`, http.StatusInternalServerError)
		return
	}

	// 6. Update the User document to add the new classroom to their history
	// This adds the classroom to the user's 'AttendanceHistory' map with an empty list of attended lectures.
	updateUser := bson.M{
		"$set": bson.M{
			"attendance_history." + classroom.ID.Hex(): []primitive.ObjectID{},
		},
	}
	_, err = usersCollection.UpdateOne(context.TODO(), bson.M{"_id": studentID}, updateUser)
	if err != nil {
		http.Error(w, `{"error": "Failed to add classroom to user's history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully joined classroom"})
}

// // ... (at the end of the file)

// // LeaveClass allows a user to leave a classroom.
// func (h *APIHandler) LeaveClass(w http.ResponseWriter, r *http.Request) {
// 	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
// 	userID, _ := primitive.ObjectIDFromHex(userIDHex)

// 	// Get classID from the URL parameter
// 	classIDHex := chi.URLParam(r, "classID")
// 	classID, err := primitive.ObjectIDFromHex(classIDHex)
// 	if err != nil {
// 		http.Error(w, `{"error": "Invalid classroom ID format"}`, http.StatusBadRequest)
// 		return
// 	}

// 	classroomsCollection := h.DB.Collection("classrooms")
// 	usersCollection := h.DB.Collection("users")

// 	// Use $pull to remove an item from an array
// 	// Remove student from the classroom's student list
// 	_, err = classroomsCollection.UpdateOne(
// 		context.TODO(),
// 		bson.M{"_id": classID},
// 		bson.M{"$pull": bson.M{"student_ids": userID}},
// 	)
// 	if err != nil {
// 		http.Error(w, `{"error": "Failed to remove student from classroom"}`, http.StatusInternalServerError)
// 		return
// 	}

// 	// Remove classroom from the student's classroom list
// 	_, err = usersCollection.UpdateOne(
// 		context.TODO(),
// 		bson.M{"_id": userID},
// 		bson.M{"$pull": bson.M{"classroom_ids": classID}},
// 	)
// 	if err != nil {
// 		http.Error(w, `{"error": "Failed to remove classroom from user"}`, http.StatusInternalServerError)
// 		return
// 	}

// 	w.Header().Set("Content-Type", "application/json")
// 	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully left classroom"})
// }

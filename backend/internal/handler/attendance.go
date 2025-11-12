// File: internal/handler/attendance.go

package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"backend/internal/database"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// generateSecureToken creates a random, URL-safe string.
func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateAttendanceSession generates a short-lived token for a class.
func (h *APIHandler) CreateAttendanceSession(w http.ResponseWriter, r *http.Request) {
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": classID, "instructor_id": instructorID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	session := database.AttendanceSession{
		ID:          primitive.NewObjectID(),
		Token:       "", // Will be generated next
		ClassroomID: classID,
		CreatedAt:   time.Now(),
	}
	// Generate token that includes session ID for better traceability if needed
	token, err := generateSecureToken(16)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate session token"}`, http.StatusInternalServerError)
		return
	}
	session.Token = token

	sessionsCollection := h.DB.Collection("attendance_sessions")
	_, err = sessionsCollection.InsertOne(context.TODO(), session)
	if err != nil {
		http.Error(w, `{"error": "Failed to create attendance session"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"attendanceToken": token})
}

// MarkAttendance allows a student to mark their attendance.
func (h *APIHandler) MarkAttendance(w http.ResponseWriter, r *http.Request) {
	studentIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	studentID, _ := primitive.ObjectIDFromHex(studentIDHex)

	var req struct {
		AttendanceToken string `json:"attendanceToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	sessionsCollection := h.DB.Collection("attendance_sessions")
	var session database.AttendanceSession
	err := sessionsCollection.FindOne(context.TODO(), bson.M{"token": req.AttendanceToken}).Decode(&session)
	if err != nil {
		http.Error(w, `{"error": "Invalid or expired attendance token"}`, http.StatusUnauthorized)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": session.ClassroomID, "student_ids": studentID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not enrolled in this class"}`, http.StatusForbidden)
		return
	}

	attendanceCollection := h.DB.Collection("attendance_records")
	newRecord := database.AttendanceRecord{
		ID:          primitive.NewObjectID(),
		UserID:      studentID,
		ClassroomID: session.ClassroomID,
		SessionID:   session.ID, // MODIFIED: Store the session ID
		Timestamp:   time.Now(),
	}

	_, err = attendanceCollection.InsertOne(context.TODO(), newRecord)
	if err != nil {
		// This will now catch the duplicate key error from our unique index
		if mongo.IsDuplicateKeyError(err) {
			http.Error(w, `{"error": "Attendance already marked for this session"}`, http.StatusConflict) // 409 Conflict
			return
		}
		http.Error(w, `{"error": "Failed to record attendance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Attendance marked successfully"})
}

// GetMyAttendanceHistory retrieves all attendance records for the logged-in user.
func (h *APIHandler) GetMyAttendanceHistory(w http.ResponseWriter, r *http.Request) {
	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	attendanceCollection := h.DB.Collection("attendance_records")

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"user_id": userID}}},
		{{Key: "$sort", Value: bson.M{"timestamp": -1}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "classrooms",
			"localField":   "classroom_id",
			"foreignField": "_id",
			"as":           "classroomInfo",
		}}},
		{{Key: "$unwind", Value: "$classroomInfo"}},
	}

	cursor, err := attendanceCollection.Aggregate(context.TODO(), pipeline)
	if err != nil {
		http.Error(w, `{"error": "Failed to aggregate attendance history"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var results []database.StudentAttendanceHistory
	if err = cursor.All(context.TODO(), &results); err != nil {
		http.Error(w, `{"error": "Failed to decode attendance history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GetClassAttendance retrieves a summary of attendance for all students in a class.
func (h *APIHandler) GetClassAttendance(w http.ResponseWriter, r *http.Request) {
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": classID, "instructor_id": instructorID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	attendanceCollection := h.DB.Collection("attendance_records")

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"classroom_id": classID}}},
		{{Key: "$group", Value: bson.M{
			"_id":           "$user_id",
			"attendedCount": bson.M{"$sum": 1},
		}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "studentInfo",
		}}},
		{{Key: "$unwind", Value: "$studentInfo"}},
		{{Key: "$project", Value: bson.M{
			"_id":           1,
			"name":          "$studentInfo.name",
			"email":         "$studentInfo.email",
			"attendedCount": 1,
		}}},
	}

	cursor, err := attendanceCollection.Aggregate(context.TODO(), pipeline)
	if err != nil {
		http.Error(w, `{"error": "Failed to aggregate class attendance"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var results []database.ClassAttendanceSummary
	if err = cursor.All(context.TODO(), &results); err != nil {
		http.Error(w, `{"error": "Failed to decode class attendance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

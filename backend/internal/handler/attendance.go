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

	// Verify the user is actually the instructor of this class
	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": classID, "instructor_id": instructorID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	// Generate and store the session token
	token, err := generateSecureToken(16) // 32 characters long
	if err != nil {
		http.Error(w, `{"error": "Failed to generate session token"}`, http.StatusInternalServerError)
		return
	}

	session := database.AttendanceSession{
		ID:          primitive.NewObjectID(),
		Token:       token,
		ClassroomID: classID,
		CreatedAt:   time.Now(),
	}

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

	// 1. Find the session token. If it's expired, it won't be found.
	sessionsCollection := h.DB.Collection("attendance_sessions")
	var session database.AttendanceSession
	err := sessionsCollection.FindOne(context.TODO(), bson.M{"token": req.AttendanceToken}).Decode(&session)
	if err != nil {
		http.Error(w, `{"error": "Invalid or expired attendance token"}`, http.StatusUnauthorized)
		return
	}

	// 2. Verify student is enrolled in the class associated with the token
	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": session.ClassroomID, "student_ids": studentID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not enrolled in this class"}`, http.StatusForbidden)
		return
	}

	// 3. Record the attendance
	attendanceCollection := h.DB.Collection("attendance_records")
	newRecord := database.AttendanceRecord{
		ID:          primitive.NewObjectID(),
		UserID:      studentID,
		ClassroomID: session.ClassroomID,
		Timestamp:   time.Now(),
	}

	_, err = attendanceCollection.InsertOne(context.TODO(), newRecord)
	if err != nil {
		http.Error(w, `{"error": "Failed to record attendance"}`, http.StatusInternalServerError)
		return
	}

	// Optional: Immediately delete the session token so it can't be reused,
	// even before the TTL expires.
	sessionsCollection.DeleteOne(context.TODO(), bson.M{"_id": session.ID})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Attendance marked successfully"})
}

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
	// "go.mongodb.org/mongo-driver/mongo"
)

// generateSecureToken creates a random, URL-safe string.
func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateAttendanceSession generates a short-lived token for a specific lecture.
func (h *APIHandler) CreateAttendanceSession(w http.ResponseWriter, r *http.Request) {
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	lectureIDHex := chi.URLParam(r, "lectureID")
	lectureID, err := primitive.ObjectIDFromHex(lectureIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid lecture ID"}`, http.StatusBadRequest)
		return
	}

	// Verify the user is the instructor of the class this lecture belongs to.
	lecturesCollection := h.DB.Collection("lectures")
	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		http.Error(w, `{"error": "Lecture not found"}`, http.StatusNotFound)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": lecture.ClassroomID, "instructor_id": instructorID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	// Create the short-lived session token.
	token, err := generateSecureToken(16)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate session token"}`, http.StatusInternalServerError)
		return
	}

	session := database.AttendanceSession{
		ID:        primitive.NewObjectID(),
		Token:     token,
		LectureID: lectureID,
		CreatedAt: time.Now(),
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

// MarkAttendance allows a student to mark their attendance for a specific lecture session.
// This handler now performs multiple updates to keep the data models in sync.
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

	// 1. Find the active attendance session from the token.
	sessionsCollection := h.DB.Collection("attendance_sessions")
	var session database.AttendanceSession
	err := sessionsCollection.FindOne(context.TODO(), bson.M{"token": req.AttendanceToken}).Decode(&session)
	if err != nil {
		http.Error(w, `{"error": "Invalid or expired attendance token"}`, http.StatusUnauthorized)
		return
	}

	lectureID := session.LectureID
	attendanceCollection := h.DB.Collection("attendance_records")

	// --- NEW: Check for existing attendance for this LECTURE before any updates ---
	count, err := attendanceCollection.CountDocuments(context.TODO(), bson.M{"user_id": studentID, "lecture_id": lectureID})
	if err != nil {
		http.Error(w, `{"error": "Database error checking existing attendance"}`, http.StatusInternalServerError)
		return
	}
	if count > 0 {
		http.Error(w, `{"error": "Attendance already marked for this lecture"}`, http.StatusConflict) // 409 Conflict
		return
	}
	// --- End of New Check ---

	// 2. Get the lecture to find the classroom ID.
	lecturesCollection := h.DB.Collection("lectures")
	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		http.Error(w, `{"error": "Associated lecture not found"}`, http.StatusInternalServerError)
		return
	}
	classroomID := lecture.ClassroomID

	// 3. Verify the student is actually enrolled in the class.
	classroomsCollection := h.DB.Collection("classrooms")
	count, err = classroomsCollection.CountDocuments(context.TODO(), bson.M{
		"_id": classroomID,
		"enrolled_students." + studentIDHex: bson.M{"$exists": true},
	})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not enrolled in this class"}`, http.StatusForbidden)
		return
	}

	// --- Perform all database updates ---
	// Note: In a production system, these operations should be wrapped in a database transaction
	// to ensure atomicity. For simplicity, we are doing them sequentially.

	// 4. Update Lecture: Add student to the lecture's `attended_by` list.
	_, err = lecturesCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": lectureID},
		bson.M{"$addToSet": bson.M{"attended_by": studentID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update lecture attendance"}`, http.StatusInternalServerError)
		return
	}

	// 5. Update User: Add the lecture to the user's attendance history for this class.
	usersCollection := h.DB.Collection("users")
	_, err = usersCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": studentID},
		bson.M{"$addToSet": bson.M{"attendance_history." + classroomID.Hex(): lectureID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update user history"}`, http.StatusInternalServerError)
		return
	}
	
	// 6. Update Classroom: Increment the student's attended lecture count.
	_, err = classroomsCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": classroomID},
		bson.M{"$inc": bson.M{"enrolled_students." + studentIDHex: 1}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update classroom count"}`, http.StatusInternalServerError)
		return
	}


	// 7. Create the immutable attendance record (for logging and auditing).
	newRecord := database.AttendanceRecord{
		ID:        primitive.NewObjectID(),
		UserID:    studentID,
		LectureID: lectureID,
		SessionID: session.ID,
		Timestamp: time.Now(),
	}
	// This InsertOne is now safe from duplicates because of the check above.
	_, err = attendanceCollection.InsertOne(context.TODO(), newRecord)
	if err != nil {
		http.Error(w, `{"error": "Failed to record attendance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Attendance marked successfully"})
}
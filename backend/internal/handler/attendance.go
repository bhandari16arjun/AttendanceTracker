// File: internal/handler/attendance.go

package handler

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
		FaceImage       string `json:"faceImage"` // Base64
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.FaceImage == "" {
		http.Error(w, `{"error": "Face verification required. Please take a photo."}`, http.StatusBadRequest)
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

	// --- VERIFY PROXIMITY (BLE CHECK) ---
	isDetected := false
	for _, detectedID := range lecture.LiveDetectedUsers {
		if detectedID == studentID {
			isDetected = true
			break
		}
	}
	if !isDetected {
		http.Error(w, `{"error": "Attendance Failed: You are not in range or haven't been detected by the instructor yet."}`, http.StatusForbidden)
		return
	}
	// --- End of Proximity Check ---

	// --- FACE VERIFICATION ---
	imageBytes, err := base64.StdEncoding.DecodeString(req.FaceImage)
	if err != nil {
		http.Error(w, `{"error": "Failed to decode face image"}`, http.StatusBadRequest)
		return
	}

	uploadDir := "uploads/faces"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.MkdirAll(uploadDir, 0755)
	}

	registeredFacePath := filepath.Join(uploadDir, studentIDHex+".jpg")
	if _, err := os.Stat(registeredFacePath); os.IsNotExist(err) {
		http.Error(w, `{"error": "No registered face found. Please register your face first."}`, http.StatusBadRequest)
		return
	}

	tempFileName := fmt.Sprintf("qr_temp_%s_%d.jpg", studentIDHex, time.Now().UnixNano())
	tempFacePath := filepath.Join(uploadDir, tempFileName)
	err = os.WriteFile(tempFacePath, imageBytes, 0644)
	if err != nil {
		http.Error(w, `{"error": "Failed to process face image"}`, http.StatusInternalServerError)
		return
	}
	defer os.Remove(tempFacePath)

	cmd := exec.Command("/Users/bhuveshraina/miniconda3/bin/python3", "scripts/face_matcher.py", registeredFacePath, tempFacePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("Python Error: %v, Output: %s\n", err, string(output))
		http.Error(w, `{"error": "Face verification system error"}`, http.StatusInternalServerError)
		return
	}

	result := strings.TrimSpace(string(output))
	if result != "true" {
		http.Error(w, `{"error": "Face verification failed. No match found."}`, http.StatusUnauthorized)
		return
	}
	// -----------------------

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

// MarkAttendanceProximity allows a student to mark their attendance after a client-side check.
func (h *APIHandler) MarkAttendanceProximity(w http.ResponseWriter, r *http.Request) {
	studentIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	studentID, _ := primitive.ObjectIDFromHex(studentIDHex)

	var req struct {
		LectureID string `json:"lectureId"`
		FaceImage string `json:"faceImage"` // Base64
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}
	
	if req.FaceImage == "" {
		http.Error(w, `{"error": "Face verification required. Please take a photo."}`, http.StatusBadRequest)
		return
	}

	lectureID, err := primitive.ObjectIDFromHex(req.LectureID)
	if err != nil {
		http.Error(w, `{"error": "Invalid lecture ID"}`, http.StatusBadRequest)
		return
	}

	// 1. Get the lecture to check 'LiveDetectedUsers'
	lecturesCollection := h.DB.Collection("lectures")
	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		http.Error(w, `{"error": "Lecture not found"}`, http.StatusNotFound)
		return
	}

	// 2. VERIFY PROXIMITY: Check if the instructor has detected this student
	isDetected := false
	for _, detectedID := range lecture.LiveDetectedUsers {
		if detectedID == studentID {
			isDetected = true
			break
		}
	}

	if !isDetected {
		http.Error(w, `{"error": "Attendance Failed: You are not in range or haven't been detected by the instructor yet."}`, http.StatusForbidden)
		return
	}
	
	// --- FACE VERIFICATION ---
	// Decode incoming face image
	imageBytes, err := base64.StdEncoding.DecodeString(req.FaceImage)
	if err != nil {
		http.Error(w, `{"error": "Failed to decode face image"}`, http.StatusBadRequest)
		return
	}

	uploadDir := "uploads/faces"
	// Ensure dir exists
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.MkdirAll(uploadDir, 0755)
	}

	// Registered face path
	registeredFacePath := filepath.Join(uploadDir, studentIDHex+".jpg")
	if _, err := os.Stat(registeredFacePath); os.IsNotExist(err) {
		http.Error(w, `{"error": "No registered face found for this user. Please register your face first."}`, http.StatusBadRequest)
		return
	}

	// Temp verification face path
	tempFileName := fmt.Sprintf("temp_%s_%d.jpg", studentIDHex, time.Now().UnixNano())
	tempFacePath := filepath.Join(uploadDir, tempFileName)
	
	err = os.WriteFile(tempFacePath, imageBytes, 0644)
	if err != nil {
		http.Error(w, `{"error": "Failed to process face image"}`, http.StatusInternalServerError)
		return
	}
	// Clean up temp file
	defer os.Remove(tempFacePath)

	// Run Python Script
	// Using absolute path to Miniconda python to ensure dependencies are found
	cmd := exec.Command("/Users/bhuveshraina/miniconda3/bin/python3", "scripts/face_matcher.py", registeredFacePath, tempFacePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Log the error for debugging
		fmt.Printf("Python Error: %v, Output: %s\n", err, string(output))
		http.Error(w, `{"error": "Face verification system error"}`, http.StatusInternalServerError)
		return
	}

	result := strings.TrimSpace(string(output))
	if result != "true" {
		http.Error(w, `{"error": "Face verification failed. Face does not match registered user."}`, http.StatusUnauthorized)
		return
	}
	// -----------------------

	classroomID := lecture.ClassroomID

	// 3. Verify the student is enrolled in the class.
	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{
		"_id": classroomID,
		"enrolled_students." + studentIDHex: bson.M{"$exists": true},
	})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not enrolled in this class"}`, http.StatusForbidden)
		return
	}

	// 4. Check for existing attendance.
	attendanceCollection := h.DB.Collection("attendance_records")
	count, err = attendanceCollection.CountDocuments(context.TODO(), bson.M{"user_id": studentID, "lecture_id": lectureID})
	if err != nil {
		http.Error(w, `{"error": "Database error checking existing attendance"}`, http.StatusInternalServerError)
		return
	}
	if count > 0 {
		// Already marked, return success (idempotent)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Attendance already marked"})
		return
	}

	// --- Perform all database updates ---

	// 5. Update Lecture: Add student to the lecture's `attended_by` list.
	_, err = lecturesCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": lectureID},
		bson.M{"$addToSet": bson.M{"attended_by": studentID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update lecture attendance"}`, http.StatusInternalServerError)
		return
	}

	// 6. Update User: Add the lecture to the user's attendance history for this class.
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

	// 7. Update Classroom: Increment the student's attended lecture count.
	_, err = classroomsCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": classroomID},
		bson.M{"$inc": bson.M{"enrolled_students." + studentIDHex: 1}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update classroom count"}`, http.StatusInternalServerError)
		return
	}

	// 8. Create the immutable attendance record.
	newRecord := database.AttendanceRecord{
		ID:        primitive.NewObjectID(),
		UserID:    studentID,
		LectureID: lectureID,
		Timestamp: time.Now(),
	}
	_, err = attendanceCollection.InsertOne(context.TODO(), newRecord)
	if err != nil {
		http.Error(w, `{"error": "Failed to record attendance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Attendance marked successfully"})
}

// SyncDetectedUsers allows the instructor to upload a list of detected student IDs.
func (h *APIHandler) SyncDetectedUsers(w http.ResponseWriter, r *http.Request) {
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	lectureIDHex := chi.URLParam(r, "lectureID")
	lectureID, err := primitive.ObjectIDFromHex(lectureIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid lecture ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		DetectedStudentIDs []string `json:"detectedStudentIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Convert strings to ObjectIDs
	var detectedObjectIDs []primitive.ObjectID
	for _, idStr := range req.DetectedStudentIDs {
		if oid, err := primitive.ObjectIDFromHex(idStr); err == nil {
			detectedObjectIDs = append(detectedObjectIDs, oid)
		}
	}

	// Verify instructor ownership of the lecture
	lecturesCollection := h.DB.Collection("lectures")
	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		http.Error(w, `{"error": "Lecture not found"}`, http.StatusNotFound)
		return
	}

	// Check if the user is the instructor of the class
	classroomsCollection := h.DB.Collection("classrooms")
	count, err := classroomsCollection.CountDocuments(context.TODO(), bson.M{"_id": lecture.ClassroomID, "instructor_id": instructorID})
	if err != nil || count == 0 {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	// Update the lecture's LiveDetectedUsers (Use $addToSet with $each to merge, or $set to replace?)
	// User Requirement: "not detected by ble will be shown a message... if in range we will mark"
	// $addToSet is better so we don't lose students if the instructor's phone clears the list temporarily.
	// But if we want to enforce "currently in range", $set is better.
	// Based on BLE flakiness, $addToSet is safer (Session-based detection).
	
	if len(detectedObjectIDs) > 0 {
		_, err = lecturesCollection.UpdateOne(
			context.TODO(),
			bson.M{"_id": lectureID},
			bson.M{"$addToSet": bson.M{"live_detected_users": bson.M{"$each": detectedObjectIDs}}},
		)
		if err != nil {
			http.Error(w, `{"error": "Failed to update detected users"}`, http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Synced successfully"})
}

// MarkStudentAttendance allows an instructor to manually mark a student present.
func (h *APIHandler) MarkStudentAttendance(w http.ResponseWriter, r *http.Request) {
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	lectureIDHex := chi.URLParam(r, "lectureID")
	lectureID, err := primitive.ObjectIDFromHex(lectureIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid lecture ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		StudentID string `json:"studentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}
	studentID, err := primitive.ObjectIDFromHex(req.StudentID)
	if err != nil {
		http.Error(w, `{"error": "Invalid student ID"}`, http.StatusBadRequest)
		return
	}

	// 1. Get the lecture to find the classroom ID and verify instructor ownership.
	lecturesCollection := h.DB.Collection("lectures")
	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		http.Error(w, `{"error": "Lecture not found"}`, http.StatusNotFound)
		return
	}
	classroomID := lecture.ClassroomID

	classroomsCollection := h.DB.Collection("classrooms")
	var classroom database.Classroom
	err = classroomsCollection.FindOne(context.TODO(), bson.M{"_id": classroomID}).Decode(&classroom)
	if err != nil {
		http.Error(w, `{"error": "Classroom not found"}`, http.StatusNotFound)
		return
	}

	if classroom.InstructorID != instructorID {
		http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
		return
	}

	// 2. Verify the student is enrolled.
	if _, ok := classroom.EnrolledStudents[req.StudentID]; !ok {
		http.Error(w, `{"error": "Student is not enrolled in this class"}`, http.StatusBadRequest)
		return
	}

	// 3. Check for existing attendance.
	attendanceCollection := h.DB.Collection("attendance_records")
	count, err := attendanceCollection.CountDocuments(context.TODO(), bson.M{"user_id": studentID, "lecture_id": lectureID})
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	if count > 0 {
		// Already marked, just return success to be idempotent
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Attendance already marked"})
		return
	}

	// --- Perform all database updates ---

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
		bson.M{"$inc": bson.M{"enrolled_students." + req.StudentID: 1}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update classroom count"}`, http.StatusInternalServerError)
		return
	}

	// 7. Create the immutable attendance record.
	// Note: We don't have a session ID here because it's manual, so we can use a placeholder or nil equivalent if allowed.
	// The struct defines SessionID as primitive.ObjectID, which is not a pointer. We'll generate a new zero one or just use the lecture ID related info.
	// Or we can just leave it as a new ObjectID.
	
	newRecord := database.AttendanceRecord{
		ID:        primitive.NewObjectID(),
		UserID:    studentID,
		LectureID: lectureID,
		// SessionID: primitive.NilObjectID, // Not available in older drivers, just use zero value or new
		Timestamp: time.Now(),
	}
	_, err = attendanceCollection.InsertOne(context.TODO(), newRecord)
	if err != nil {
		http.Error(w, `{"error": "Failed to record attendance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Attendance marked successfully"})
}
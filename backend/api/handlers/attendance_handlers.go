package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"presently/api/models"
	"presently/api/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AttendanceHandler struct {
	attendanceRepo *repository.AttendanceRepository
	classroomRepo  *repository.ClassroomRepository
}

func NewAttendanceHandler(attendanceRepo *repository.AttendanceRepository,classroomRepo *repository.ClassroomRepository) *AttendanceHandler{
	return &AttendanceHandler{
		attendanceRepo: attendanceRepo,
		classroomRepo: classroomRepo,
	}
}

func (h *AttendanceHandler) StartAttendance(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	role := r.Context().Value("role")
	if role == nil || role.(string) != "instructor" {
		http.Error(w, "Forbidden: only instructors can start attendance", http.StatusForbidden)
		return
	}

	var input struct {
		ClassroomID string `json:"classroomId"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}

	if input.ClassroomID == "" {
		http.Error(w, "Invalid request body: classroomId is required", http.StatusBadRequest)
		return
	}

	classroomID, err := primitive.ObjectIDFromHex(input.ClassroomID)
	if err != nil {
		http.Error(w, "Invalid classroom ID format", http.StatusBadRequest)
		return
	}

	// Verify user is the instructor
	classroom, err := h.classroomRepo.GetClassroomById(r.Context(), classroomID)
	if err != nil {
		http.Error(w, "Classroom not found", http.StatusNotFound)
		return
	}

	instructorID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	if classroom.InstructorID != instructorID {
		http.Error(w, "Forbidden: you are not the instructor of this classroom", http.StatusForbidden)
		return
	}

	// Create attendance session with 5 minutes validity
	// TODO: store these in a cache like redis
	startTime := time.Now()
	endTime := startTime.Add(5 * time.Minute)

	newSession := &models.AttendanceSession{
		ClassroomID: classroomID,
		StartTime:   startTime,
		EndTime:     endTime,
	}

	if err := h.attendanceRepo.CreateSession(r.Context(), newSession); err != nil {
		http.Error(w, "Failed to create attendance session", http.StatusInternalServerError)
		return
	}

	// QRCodeData === session ID
	// On the client side , we will scan QRCode to get sesssion ID
	qrcodedata := newSession.ID.Hex()

	response := map[string]interface{}{
		"message":    "Attendance session started successfully",
		"sessionId":  newSession.ID,
		"qrCodeData": qrcodedata,
		"endTime":    newSession.EndTime,
	}
	respondWithJSON(w, http.StatusCreated, response)
}

func (h *AttendanceHandler) MarkAttendance(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	var input struct {
		SessionID string `json:"sessionId"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}

	if input.SessionID == "" {
		http.Error(w, "Invalid request body: sessionId is required", http.StatusBadRequest)
		return
	}

	sessionID, err := primitive.ObjectIDFromHex(input.SessionID)
	if err != nil {
		http.Error(w, "Invalid session ID format", http.StatusBadRequest)
		return
	}

	// Fetch attendance session
	session, err := h.attendanceRepo.GetSessionById(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Attendance session not found", http.StatusNotFound)
		return
	}

	// Check if session has expired
	if time.Now().After(session.EndTime) {
		http.Error(w, "Attendance session has expired", http.StatusBadRequest)
		return
	}

	studentID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	// Verify student is enrolled in the classroom
	classroom, err := h.classroomRepo.GetClassroomById(r.Context(), session.ClassroomID)
	if err != nil {
		http.Error(w, "Classroom not found", http.StatusNotFound)
		return
	}

	isEnrolled := false
	for _, id := range classroom.StudentIDs {
		if id == studentID {
			isEnrolled = true
			break
		}
	}

	if !isEnrolled {
		http.Error(w, "Forbidden: you are not enrolled in this classroom", http.StatusForbidden)
		return
	}

	// Check if student has already marked attendance
	existingRecord, _ := h.attendanceRepo.FindRecordBySessionAndUser(r.Context(), sessionID, studentID)
	if existingRecord != nil {
		http.Error(w, "Attendance already marked for this session", http.StatusBadRequest)
		return
	}

	// Create attendance record
	newRecord := &models.AttendanceRecord{
		SessionID: sessionID,
		UserID:    studentID,
		Timestamp: time.Now(),
		Status:    "PRESENT",
	}

	if err := h.attendanceRepo.CreateRecord(r.Context(), newRecord); err != nil {
		http.Error(w, "Failed to mark attendance", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message":   "Attendance marked successfully",
		"recordId":  newRecord.ID,
		"status":    newRecord.Status,
		"timestamp": newRecord.Timestamp,
	}
	respondWithJSON(w, http.StatusCreated, response)
}

func (h *AttendanceHandler) GetMyHistory(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	studentID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	records, err := h.attendanceRepo.GetRecordsByStudent(r.Context(), studentID)
	if err != nil {
		http.Error(w, "Internal server error: failed to fetch attendance history", http.StatusInternalServerError)
		return
	}

	if records == nil {
		records = []*models.AttendanceRecord{}
	}

	respondWithJSON(w, http.StatusOK, records)
}

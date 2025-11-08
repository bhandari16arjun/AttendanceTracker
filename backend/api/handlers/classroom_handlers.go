package handlers

import (
	"encoding/json"
	"net/http"

	"presently/api/models"
	"presently/api/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ClassroomHandler struct {
	classroomRepo *repository.ClassroomRepository
}

// constructor
func NewClassroomHandler(classroomRepo *repository.ClassroomRepository) *ClassroomHandler {
	return &ClassroomHandler{
		classroomRepo: classroomRepo,
	}
}

func (h *ClassroomHandler) CreateClassroom(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	role := r.Context().Value("role")
	if role == nil || role.(string) != "instructor" {
		http.Error(w, "Forbidden: only instructors can create classrooms", http.StatusForbidden)
		return
	}

	var input struct {
		Name string `json:"name"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}

	if input.Name == "" {
		http.Error(w, "Invalid request body: name is required", http.StatusBadRequest)
		return
	}

	// Generate unique code for classroom
	uniqueCode := generateUniqueCode()

	instructorID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	newClassroom := &models.Classroom{
		Name:         input.Name,
		InstructorID: instructorID,
		StudentIDs:   []primitive.ObjectID{},
		UniqueCode:   uniqueCode,
	}

	if err := h.classroomRepo.CreateNewClassroom(r.Context(), newClassroom); err != nil {
		http.Error(w, "Failed to create classroom", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message":     "Classroom created successfully",
		"code":        newClassroom.UniqueCode,
		"classroomId": newClassroom.ID,
	}
	respondWithJSON(w, http.StatusCreated, response)
}

func (h *ClassroomHandler) JoinClassroom(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	var input struct {
		Code string `json:"code"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}

	if input.Code == "" {
		http.Error(w, "Invalid request body: code is required", http.StatusBadRequest)
		return
	}

	classroom, err := h.classroomRepo.GetClassroomByCode(r.Context(), input.Code)
	if err != nil {
		http.Error(w, "Classroom not found with the provided code", http.StatusNotFound)
		return
	}

	studentID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	// Check if student is already in the classroom
	for _, id := range classroom.StudentIDs {
		if id == studentID {
			http.Error(w, "You are already a member of this classroom", http.StatusBadRequest)
			return
		}
	}

	if err := h.classroomRepo.AddStudentToClassroom(r.Context(), classroom.ID, studentID); err != nil {
		http.Error(w, "Failed to join classroom", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message":       "Successfully joined classroom",
		"classroomId":   classroom.ID,
		"classroomName": classroom.Name,
	}
	respondWithJSON(w, http.StatusOK, response)
}

func (h *ClassroomHandler) GetMyClasses(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	role := r.Context().Value("role")
	if role == nil {
		http.Error(w, "Unauthorized: role not found in context", http.StatusUnauthorized)
		return
	}

	uid, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	var classrooms []*models.Classroom
	var err error

	if role.(string) == "instructor" {
		classrooms, err = h.classroomRepo.GetClassroomsByInstructor(r.Context(), uid)
	} else {
		classrooms, err = h.classroomRepo.GetClassroomsByStudent(r.Context(), uid)
	}

	if err != nil {
		http.Error(w, "Internal server error: failed to fetch classrooms", http.StatusInternalServerError)
		return
	}

	if classrooms == nil {
		classrooms = []*models.Classroom{}
	}

	respondWithJSON(w, http.StatusOK, classrooms)
}

func (h *ClassroomHandler) LeaveClassroom(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
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

	studentID, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	if err := h.classroomRepo.RemoveStudentFromClassroom(r.Context(), classroomID, studentID); err != nil {
		http.Error(w, "Failed to leave classroom", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"message": "Successfully left classroom",
	}
	respondWithJSON(w, http.StatusOK, response)
}

func (h *ClassroomHandler) GetClassroomDetails(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userId")
	if userID == nil {
		http.Error(w, "Unauthorized: user not found in context", http.StatusUnauthorized)
		return
	}

	classroomIDStr := r.URL.Query().Get("id")
	if classroomIDStr == "" {
		http.Error(w, "Invalid request: classroom id is required", http.StatusBadRequest)
		return
	}

	classroomID, err := primitive.ObjectIDFromHex(classroomIDStr)
	if err != nil {
		http.Error(w, "Invalid classroom ID format", http.StatusBadRequest)
		return
	}

	classroom, err := h.classroomRepo.GetClassroomById(r.Context(), classroomID)
	if err != nil {
		http.Error(w, "Classroom not found", http.StatusNotFound)
		return
	}

	uid, ok := userID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Internal server error: invalid user ID format", http.StatusInternalServerError)
		return
	}

	// Check if user has access to this classroom (either instructor or student)
	hasAccess := classroom.InstructorID == uid
	if !hasAccess {
		for _, studentID := range classroom.StudentIDs {
			if studentID == uid {
				hasAccess = true
				break
			}
		}
	}

	if !hasAccess {
		http.Error(w, "Forbidden: you do not have access to this classroom", http.StatusForbidden)
		return
	}

	respondWithJSON(w, http.StatusOK, classroom)
}

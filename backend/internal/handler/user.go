// File: internal/handler/user.go

package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// APIHandler holds dependencies for HTTP handlers.
type APIHandler struct {
	DB         *mongo.Database
	JWT_Secret string
}

// Register handles user registration.
func (h *APIHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		FaceImage string `json:"faceImage"` // Base64 string
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.FaceImage == "" {
		http.Error(w, "Face registration is required", http.StatusBadRequest)
		return
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	usersCollection := h.DB.Collection("users")

	count, err := usersCollection.CountDocuments(context.TODO(), bson.M{"email": req.Email})
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		http.Error(w, "User with this email already exists", http.StatusConflict)
		return
	}

	// Create a new user ID
	userID := primitive.NewObjectID()

	// --- SAVE FACE IMAGE ---
	// Decode Base64
	// Remove data:image/jpeg;base64, prefix if present
	// (Frontend usually sends just the raw string from expo-camera but let's be safe if we add a prefix later)
	// For now, assuming raw base64 from expo-camera
	
	imageBytes, err := base64.StdEncoding.DecodeString(req.FaceImage)
	if err != nil {
		http.Error(w, "Failed to decode face image", http.StatusBadRequest)
		return
	}

	// Ensure uploads directory exists (just in case)
	uploadDir := "uploads/faces"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.MkdirAll(uploadDir, 0755)
	}

	filePath := filepath.Join(uploadDir, userID.Hex()+".jpg")
	err = os.WriteFile(filePath, imageBytes, 0644)
	if err != nil {
		http.Error(w, "Failed to save face image", http.StatusInternalServerError)
		return
	}
	// -----------------------

	// Create a new user with the updated database.User model
	newUser := database.User{
		ID:                userID,
		Name:              req.Name,
		Email:             req.Email,
		Password:          hashedPassword,
		FaceRegistered:    true,
		// Initialize AttendanceHistory as an empty map
		AttendanceHistory: make(map[string][]primitive.ObjectID),
	}

	_, err = usersCollection.InsertOne(context.TODO(), newUser)
	if err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully"})
}

// Login handles user login and token generation.
func (h *APIHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user database.User
	usersCollection := h.DB.Collection("users")

	err := usersCollection.FindOne(context.TODO(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if !auth.CheckPasswordHash(req.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	tokenString, err := auth.GenerateJWT(user.ID.Hex(), user.Name, h.JWT_Secret)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}

// LoginFace handles user login using face verification.
func (h *APIHandler) LoginFace(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email     string `json:"email"`
		FaceImage string `json:"faceImage"` // Base64
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.FaceImage == "" {
		http.Error(w, `{"error": "Email and Face Image are required"}`, http.StatusBadRequest)
		return
	}

	// 1. Find user
	var user database.User
	usersCollection := h.DB.Collection("users")
	err := usersCollection.FindOne(context.TODO(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	if !user.FaceRegistered {
		http.Error(w, `{"error": "Face not registered for this account. Please login with password first."}`, http.StatusBadRequest)
		return
	}

	// 2. FACE VERIFICATION
	imageBytes, err := base64.StdEncoding.DecodeString(req.FaceImage)
	if err != nil {
		http.Error(w, `{"error": "Failed to decode face image"}`, http.StatusBadRequest)
		return
	}

	uploadDir := "uploads/faces"
	registeredFacePath := filepath.Join(uploadDir, user.ID.Hex()+".jpg")
	if _, err := os.Stat(registeredFacePath); os.IsNotExist(err) {
		http.Error(w, `{"error": "Registered face file missing"}`, http.StatusInternalServerError)
		return
	}

	tempFileName := fmt.Sprintf("login_temp_%s_%d.jpg", user.ID.Hex(), time.Now().UnixNano())
	tempFacePath := filepath.Join(uploadDir, tempFileName)
	err = os.WriteFile(tempFacePath, imageBytes, 0644)
	if err != nil {
		http.Error(w, `{"error": "Failed to process face image"}`, http.StatusInternalServerError)
		return
	}
	defer os.Remove(tempFacePath)

	// Run Python Script (Using Miniconda path)
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

	// 3. SUCCESS - Generate JWT
	tokenString, err := auth.GenerateJWT(user.ID.Hex(), user.Name, h.JWT_Secret)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString, "userName": user.Name})
}

// VerifyFace verifies the authenticated user's face without generating a token.
func (h *APIHandler) VerifyFace(w http.ResponseWriter, r *http.Request) {
	// 1. Get User ID from Context
	userIDHex, ok := r.Context().Value(UserIDContextKey).(string)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		FaceImage string `json:"faceImage"` // Base64
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.FaceImage == "" {
		http.Error(w, `{"error": "Face Image is required"}`, http.StatusBadRequest)
		return
	}

	// 2. Check if face file exists
	uploadDir := "uploads/faces"
	registeredFacePath := filepath.Join(uploadDir, userIDHex+".jpg")
	if _, err := os.Stat(registeredFacePath); os.IsNotExist(err) {
		http.Error(w, `{"error": "No registered face found. Please register first."}`, http.StatusBadRequest)
		return
	}

	// 3. Save Temp Image
	imageBytes, err := base64.StdEncoding.DecodeString(req.FaceImage)
	if err != nil {
		http.Error(w, `{"error": "Failed to decode face image"}`, http.StatusBadRequest)
		return
	}

	tempFileName := fmt.Sprintf("verify_temp_%s_%d.jpg", userIDHex, time.Now().UnixNano())
	tempFacePath := filepath.Join(uploadDir, tempFileName)
	err = os.WriteFile(tempFacePath, imageBytes, 0644)
	if err != nil {
		http.Error(w, `{"error": "Failed to process face image"}`, http.StatusInternalServerError)
		return
	}
	defer os.Remove(tempFacePath)

	// 4. Run Python Matcher
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

	// 5. Success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Face verified successfully"})
}

// GetUsersDetails retrieves a list of users by their IDs.
func (h *APIHandler) GetUsersDetails(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserIDs []string `json:"userIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	var objectIDs []primitive.ObjectID
	for _, idHex := range req.UserIDs {
		objID, err := primitive.ObjectIDFromHex(idHex)
		if err == nil {
			objectIDs = append(objectIDs, objID)
		}
	}

	if len(objectIDs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]database.User{})
		return
	}

	usersCollection := h.DB.Collection("users")
	
    // Only return public information (ID, Name, and Email)
    findOptions := options.Find().SetProjection(bson.M{"_id": 1, "name": 1, "email": 1})

	cursor, err := usersCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": objectIDs}}, findOptions)
	if err != nil {
		http.Error(w, `{"error": "Database error while finding users"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var users []database.User
	if err = cursor.All(context.TODO(), &users); err != nil {
		http.Error(w, `{"error": "Failed to decode users"}`, http.StatusInternalServerError)
		return
	}

	if users == nil {
		users = []database.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
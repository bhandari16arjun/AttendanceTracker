// File: internal/handler/user.go

package handler

import (
	"context"
	"encoding/json"
	"net/http"

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
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
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

	// Create a new user with the updated database.User model
	newUser := database.User{
		ID:                primitive.NewObjectID(),
		Name:              req.Name,
		Email:             req.Email,
		Password:          hashedPassword,
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
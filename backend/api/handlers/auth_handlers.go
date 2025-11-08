package handlers

import (
	"encoding/json"
	"net/http"

	"presently/api/models"
	"presently/api/repository"
	"presently/api/utils"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	userRepo *repository.UserRepository
}

// constrcutor
func NewAuthHandler(userRepo *repository.UserRepository) *AuthHandler {
	return &AuthHandler{
		userRepo: userRepo,
	}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}
	if input.Name == "" || input.Email == "" || input.Password == "" {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	exisitingUser, err := h.userRepo.GetUserByEmail(r.Context(), input.Email)
	if err != nil {
		http.Error(w, "Internal server error: failed to check for exisiting credentials", http.StatusInternalServerError)
		return
	}
	if exisitingUser != nil {
		http.Error(w, "user already exists", http.StatusBadRequest)
		return
	}
	// TODO : add email regex check and strong password validation

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)

	if err != nil {
		http.Error(w, "Internal server error: failed to process password", http.StatusInternalServerError)
		return
	}

	newUser := &models.User{
		Name:     input.Name,
		Email:    input.Email,
		Password: string(hashedPassword),
		Role:     "user",
	}

	if err := h.userRepo.CreateUser(r.Context(), newUser); err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}
	response := map[string]string{
		"message": "User registered sucessfully",
		"email":   newUser.Email,
	}
	respondWithJSON(w, http.StatusCreated, response)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	err := json.NewDecoder(r.Body).Decode(&input)

	if err != nil {
		http.Error(w, "Internal server error: failed to decode JSON", http.StatusInternalServerError)
		return
	}

	if input.Email == "" || input.Password == "" {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	exisitingUser, err := h.userRepo.GetUserByEmail(r.Context(), input.Email)
	if err != nil {
		http.Error(w, "Internal server error: failed to fectch user details", http.StatusInternalServerError)
		return
	}
	if exisitingUser == nil {
		http.Error(w, "User is not registered", http.StatusBadRequest)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(exisitingUser.Password), []byte(input.Password)) != nil {
		http.Error(w, "Incorrect Password", http.StatusBadRequest)
		return
	}

	jwtToken, err := utils.GenerateJWT(exisitingUser.ID, exisitingUser.Role)
	if err != nil {
		http.Error(w, "Internal server error: failed to generate jwt token", http.StatusInternalServerError)
		return
	}
	respondWithJSON(w, http.StatusCreated, jwtToken)
}

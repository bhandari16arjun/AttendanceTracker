package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
)

func respondWithJSON(w http.ResponseWriter, statusCode int, payload any) {
	response, err := json.Marshal(payload)

	if err!=nil {
		http.Error(w,"Failed to encode response in JSON",http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if _, err := w.Write(response); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Print(w, err.Error())
	}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func respondWithError(w http.ResponseWriter, statusCode int, message string) {
	json := ErrorResponse{Error: message}
	respondWithJSON(w, statusCode, json)
}

func generateUniqueCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const codeLength = 6
	// Seeding not required as Go 1.20+ has global generator seeding itself
	code := make([]byte, codeLength)
	for i := range code {
		code[i] = charset[rand.Intn(len(charset))]
	}
	return string(code)
}

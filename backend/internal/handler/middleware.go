package handler

import (
	"context"
	"net/http"
	"strings"

	"backend/internal/auth" // Use your module name

	"github.com/golang-jwt/jwt/v5"
)

// A private key for context that is guaranteed to be unique
type contextKey string

const UserIDContextKey = contextKey("userID")

// AuthMiddleware creates a middleware that validates JWT tokens.
func (h *APIHandler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error": "Authorization header required"}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader { // No "Bearer " prefix
			http.Error(w, `{"error": "Invalid token format"}`, http.StatusUnauthorized)
			return
		}

		claims := &auth.Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(h.JWT_Secret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error": "Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Add user ID to the request context
		ctx := context.WithValue(r.Context(), UserIDContextKey, claims.UserID)
		// Call the next handler in the chain
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

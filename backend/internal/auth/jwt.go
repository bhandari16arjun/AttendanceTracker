// File: internal/auth/jwt.go

package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims struct now correctly includes the Name field
type Claims struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"` // The user's full name
	jwt.RegisteredClaims
}

// GenerateJWT function now correctly accepts the user's name
func GenerateJWT(userID string, name string, jwtSecret string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: userID,
		Name:   name, // Set the name in the claims
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

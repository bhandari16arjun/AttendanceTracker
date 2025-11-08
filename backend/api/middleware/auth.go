package middleware

import (
	"context"
	"net/http"
	"presently/api/utils"
	"strings"
)

func JWTAuthentication(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Auth header missing", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		claims, err := utils.ValidateToken(tokenString)

		if err != nil {
			http.Error(w,"Unauthorised",http.StatusUnauthorized)
			return
		}

		userId := claims.UserID
		role := claims.Role

		ctx:= r.Context()
		ctx = context.WithValue(ctx,"userId",userId);
		ctx = context.WithValue(ctx,"role",role);

		next.ServeHTTP(w,r.WithContext(ctx))
	})
}

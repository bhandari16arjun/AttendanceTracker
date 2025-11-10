// File: cmd/api/main.go

package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handler"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}
	log.Println("Configuration loaded successfully")

	db, err := database.Connect(cfg.MongoURI, cfg.DB_Name)
	if err != nil {
		log.Fatalf("Could not connect to the database: %v", err)
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	apiHandler := &handler.APIHandler{
		DB:         db,
		JWT_Secret: cfg.JWT_Secret,
	}

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("API is running!"))
	})

	// --- ALL /api ROUTES ARE GROUPED HERE ---
	r.Route("/api", func(r chi.Router) {
		// Public routes - No middleware needed
		r.Post("/register", apiHandler.Register)
		r.Post("/login", apiHandler.Login)

		// Protected routes - Group them and apply the middleware
		r.Group(func(r chi.Router) {
			r.Use(apiHandler.AuthMiddleware)

			// Classroom Routes
			r.Post("/classes", apiHandler.CreateClass)
			r.Get("/classes", apiHandler.GetMyClasses)
			r.Post("/classes/join", apiHandler.JoinClass)

			r.Post("/classes/{classID}/leave", apiHandler.LeaveClass)

			r.Post("/classes/{classID}/attendance-session", apiHandler.CreateAttendanceSession)
			r.Post("/attendance/mark", apiHandler.MarkAttendance)
		})
	})

	log.Printf("Server starting on port %s...", cfg.ServerPort)
	if err := http.ListenAndServe(":"+cfg.ServerPort, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

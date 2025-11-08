package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"presently/api/handlers"
	"presently/api/middleware"
	"presently/api/repository"
	"presently/config"
	"time"

	gorillaHandlers "github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// The App struct represents the core application object
type App struct {
	Router      *mux.Router
	DB          *mongo.Database
	MongoClient *mongo.Client
}

var userRepo *repository.UserRepository
var attendanceRepo *repository.AttendanceRepository
var classroomRepo *repository.ClassroomRepository

func (a *App) initializeRoutes() {
	// TODO : add rate limits on routes
	fmt.Println("Initialize the app routes")

	// Initialize handlers with repositories
	authHandler := handlers.NewAuthHandler(userRepo)
	classroomHandler := handlers.NewClassroomHandler(classroomRepo)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceRepo, classroomRepo)

	// --- Public routes ---
	a.Router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Presently API is running!"))
	}).Methods("GET")

	// Auth routes
	a.Router.HandleFunc("/auth/register", authHandler.Register).Methods("POST")
	a.Router.HandleFunc("/auth/login", authHandler.Login).Methods("POST")

	// --- Protected routes ---
	protected := a.Router.PathPrefix("/api").Subrouter()
	protected.Use(middleware.JWTAuthentication)

	// Classroom routes
	protected.HandleFunc("/classroom/create", classroomHandler.CreateClassroom).Methods("POST")
	protected.HandleFunc("/classroom/join", classroomHandler.JoinClassroom).Methods("POST")
	protected.HandleFunc("/classroom/my-classes", classroomHandler.GetMyClasses).Methods("GET")
	protected.HandleFunc("/classroom/leave", classroomHandler.LeaveClassroom).Methods("POST")
	protected.HandleFunc("/classroom/details", classroomHandler.GetClassroomDetails).Methods("GET")

	// Attendance routes
	protected.HandleFunc("/attendance/start", attendanceHandler.StartAttendance).Methods("POST")
	protected.HandleFunc("/attendance/mark", attendanceHandler.MarkAttendance).Methods("POST")
	protected.HandleFunc("/attendance/history", attendanceHandler.GetMyHistory).Methods("GET")
}

// Initialize the app ---> database and routes
func (a *App) Initialize() error {
	// config for database
	mongoURI := config.GetConfig().MONGO_URI
	dbName := config.GetConfig().DB_NAME
	// initialise database
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()       // cancel if not connected in 10 seconds

	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(clientOptions)

	if err != nil {
		log.Fatal(err)
		return err
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatal(err)
		return err
	}

	fmt.Println("MongoDB connected sucessfully!")
	a.MongoClient = client
	a.DB = client.Database(dbName)

	// initialise repository
	userRepo = repository.NewUserRepository(a.DB)
	attendanceRepo = repository.NewAttendanceRepository(a.DB)
	classroomRepo = repository.NewClassroomRepository(a.DB)
	// initialise routes
	a.Router = mux.NewRouter() // gorilla mux router
	a.initializeRoutes()
	return nil
}

// Run the app
func (a *App) Run() error {
	port := config.GetConfig().API_PORT
	fmt.Printf("Run the app on port %s\n", port)
	loggedRouter := gorillaHandlers.LoggingHandler(os.Stdout, a.Router)

	//Security
	allowedHeaders := gorillaHandlers.AllowedHeaders([]string{"X-Requested-With", "Content-Type", "Authorization"})
	allowedMethods := gorillaHandlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE"})
	allowedOrigins := gorillaHandlers.AllowedOrigins([]string{"*"}) // TODO: make specific in production code
	return http.ListenAndServe(fmt.Sprintf(":%s", port), gorillaHandlers.CORS(allowedHeaders, allowedMethods, allowedOrigins)(loggedRouter))
}

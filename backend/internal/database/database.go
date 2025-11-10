// File: internal/database/database.go

package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ==================================
//        Data Models (Structs)
// ==================================
// These structs define the shape of our documents in MongoDB.
// `bson` tags map struct fields to document fields.
// `json` tags control how the data is serialized when sent back to the frontend.

// User represents a user document in the "users" collection.
type User struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	Email        string               `bson:"email" json:"email"`
	Password     string               `bson:"password" json:"-"` // The "-" tag prevents this from ever being sent in JSON responses.
	ClassroomIDs []primitive.ObjectID `bson:"classroom_ids" json:"classroomIds"`
}

// Classroom represents a classroom document in the "classrooms" collection.
type Classroom struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	Code         string               `bson:"code" json:"code"`
	InstructorID primitive.ObjectID   `bson:"instructor_id" json:"instructorId"`
	StudentIDs   []primitive.ObjectID `bson:"student_ids" json:"studentIds"`
}

// AttendanceSession represents a temporary token used to start an attendance check.
// These documents are automatically deleted by MongoDB thanks to the TTL index.
type AttendanceSession struct {
	ID          primitive.ObjectID `bson:"_id,omitempty"`
	Token       string             `bson:"token"`
	ClassroomID primitive.ObjectID `bson:"classroom_id"`
	CreatedAt   time.Time          `bson:"created_at"` // This field is used by the TTL index.
}

// AttendanceRecord represents a single student's attendance for a class on a specific date.
type AttendanceRecord struct {
	ID          primitive.ObjectID `bson:"_id,omitempty"`
	UserID      primitive.ObjectID `bson:"user_id"`
	ClassroomID primitive.ObjectID `bson:"classroom_id"`
	Timestamp   time.Time          `bson:"timestamp"`
}

// StudentAttendanceHistory is a struct for the aggregation result for a student's history.
type StudentAttendanceHistory struct {
	ID            primitive.ObjectID `bson:"_id" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"userId"`
	ClassroomID   primitive.ObjectID `bson:"classroom_id" json:"classroomId"`
	Timestamp     time.Time          `bson:"timestamp" json:"timestamp"`
	ClassroomInfo struct {
		Name string `bson:"name" json:"subjectName"` // Match frontend mock data field
		Code string `bson:"code" json:"subjectCode"`
	} `bson:"classroomInfo" json:"classroomInfo"`
}

// ClassAttendanceSummary is a struct for the aggregation result for an instructor's view.
type ClassAttendanceSummary struct {
	UserID        primitive.ObjectID `bson:"_id" json:"userId"`
	Name          string             `bson:"name" json:"name"`
	Email         string             `bson:"email" json:"email"`
	AttendedCount int                `bson:"attendedCount" json:"attendedCount"`
}

// ==================================
//       Database Connection
// ==================================

// Connect opens a connection to the MongoDB database and ensures necessary indexes are created.
func Connect(uri, dbName string) (*mongo.Database, error) {
	// Use the SetServerAPIOptions() method to set the Stable API version
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	clientOptions := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)

	// Set a timeout for the connection attempt
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the primary node to verify the connection.
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("MongoDB connection established")
	db := client.Database(dbName)

	// --- Ensure TTL Index for Attendance Sessions ---
	// This is a critical setup step for our attendance flow.
	// It creates an index that automatically deletes documents from the
	// 'attendance_sessions' collection 60 seconds after their 'created_at' time.
	sessionsCollection := db.Collection("attendance_sessions")
	ttlIndex := mongo.IndexModel{
		Keys:    bson.D{{Key: "created_at", Value: 1}},     // Index on the CreatedAt field
		Options: options.Index().SetExpireAfterSeconds(60), // Documents expire after 60 seconds
	}

	// CreateOne will only create the index if it doesn't already exist.
	_, err = sessionsCollection.Indexes().CreateOne(context.Background(), ttlIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to create TTL index for attendance_sessions: %w", err)
	}
	log.Println("TTL index for 'attendance_sessions' collection ensured.")
	// ---------------------------------------------

	return db, nil
}

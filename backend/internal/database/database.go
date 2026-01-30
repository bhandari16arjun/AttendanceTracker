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

// User represents a user in the system (student or instructor).
type User struct {
	ID                primitive.ObjectID              `bson:"_id,omitempty" json:"id"`
	Name              string                          `bson:"name" json:"name"`
	Email             string                          `bson:"email" json:"email"`
	Password          string                          `bson:"password" json:"-"`
	// map[ClassroomID] -> []LectureID
	AttendanceHistory map[string][]primitive.ObjectID `bson:"attendance_history" json:"attendanceHistory,omitempty"`
}

// Classroom represents a course or subject.
type Classroom struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	Code         string               `bson:"code" json:"code"`
	InstructorID primitive.ObjectID   `bson:"instructor_id" json:"instructorId"`
	// map[StudentID] -> No. of lectures attended
	EnrolledStudents map[string]int       `bson:"enrolled_students" json:"enrolledStudents"`
	LectureIDs       []primitive.ObjectID `bson:"lecture_ids" json:"lectureIds"`
}

// Lecture represents a single lecture session within a classroom.
type Lecture struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	ClassroomID primitive.ObjectID   `bson:"classroom_id" json:"classroomId"`
	Date        time.Time            `bson:"date" json:"date"`
	AttendedBy  []primitive.ObjectID `bson:"attended_by" json:"attendedBy"` // List of StudentIDs
}

// AttendanceSession is a short-lived document to validate attendance marking.
type AttendanceSession struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Token     string             `bson:"token"`
	LectureID primitive.ObjectID `bson:"lecture_id"`
	CreatedAt time.Time          `bson:"created_at"`
}

// AttendanceRecord is the raw log of a single attendance event.
type AttendanceRecord struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	LectureID primitive.ObjectID `bson:"lecture_id"`
	SessionID primitive.ObjectID `bson:"session_id"`
	Timestamp time.Time          `bson:"timestamp"`
}


// ==================================
//       Database Connection
// ==================================

// Connect initializes the connection to the MongoDB database.
func Connect(uri, dbName string) (*mongo.Database, error) {
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	clientOptions := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("MongoDB connection established")
	db := client.Database(dbName)

	// Ensure TTL Index for Attendance Sessions to auto-delete them after a short period.
	sessionsCollection := db.Collection("attendance_sessions")
	ttlIndex := mongo.IndexModel{
		Keys:    bson.D{{Key: "created_at", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(60), // Tokens expire after 60 seconds
	}
	_, err = sessionsCollection.Indexes().CreateOne(context.Background(), ttlIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to create TTL index for attendance_sessions: %w", err)
	}
	log.Println("TTL index for 'attendance_sessions' collection ensured.")

	// Ensure a unique compound index on attendance records to prevent duplicate check-ins
	// for the same user for the same lecture.
	recordsCollection := db.Collection("attendance_records")
	uniqueIndex := mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "lecture_id", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}
	_, err = recordsCollection.Indexes().CreateOne(context.Background(), uniqueIndex)
	if err != nil {
		// Note: This may error if the index already exists with a different configuration.
		// In a real production app, you'd handle this more gracefully.
		log.Printf("Could not create unique index on attendance_records (may already exist with old config): %v", err)
	} else {
		log.Println("Unique index for 'attendance_records' (user_id, lecture_id) collection ensured.")
	}

	return db, nil
}



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

type User struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	Email        string               `bson:"email" json:"email"`
	Password     string               `bson:"password" json:"-"`
	ClassroomIDs []primitive.ObjectID `bson:"classroom_ids" json:"classroomIds"`
}

type Classroom struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	Code         string               `bson:"code" json:"code"`
	InstructorID primitive.ObjectID   `bson:"instructor_id" json:"instructorId"`
	StudentIDs   []primitive.ObjectID `bson:"student_ids" json:"studentIds"`
}

type AttendanceSession struct {
	ID          primitive.ObjectID `bson:"_id,omitempty"`
	Token       string             `bson:"token"`
	ClassroomID primitive.ObjectID `bson:"classroom_id"`
	// CORRECTED: Added the bson tag to match the TTL index
	CreatedAt time.Time `bson:"created_at"`
}

type AttendanceRecord struct {
	ID          primitive.ObjectID `bson:"_id,omitempty"`
	UserID      primitive.ObjectID `bson:"user_id"`
	ClassroomID primitive.ObjectID `bson:"classroom_id"`
	Timestamp   time.Time          `bson:"timestamp"`
}

type StudentAttendanceHistory struct {
	ID            primitive.ObjectID `bson:"_id" json:"id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"userId"`
	ClassroomID   primitive.ObjectID `bson:"classroom_id" json:"classroomId"`
	Timestamp     time.Time          `bson:"timestamp" json:"timestamp"`
	ClassroomInfo struct {
		Name string `bson:"name" json:"subjectName"`
		Code string `bson:"code" json:"subjectCode"`
	} `bson:"classroomInfo" json:"classroomInfo"`
}

type ClassAttendanceSummary struct {
	UserID        primitive.ObjectID `bson:"_id" json:"userId"`
	Name          string             `bson:"name" json:"name"`
	Email         string             `bson:"email" json:"email"`
	AttendedCount int                `bson:"attendedCount" json:"attendedCount"`
}

// ==================================
//       Database Connection
// ==================================

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

	sessionsCollection := db.Collection("attendance_sessions")
	ttlIndex := mongo.IndexModel{
		Keys:    bson.D{{Key: "created_at", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(60),
	}

	_, err = sessionsCollection.Indexes().CreateOne(context.Background(), ttlIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to create TTL index for attendance_sessions: %w", err)
	}
	log.Println("TTL index for 'attendance_sessions' collection ensured.")

	return db, nil
}

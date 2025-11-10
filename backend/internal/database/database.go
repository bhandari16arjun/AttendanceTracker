package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

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

func Connect(uri, dbName string) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("MongoDB connection established")
	return client.Database(dbName), nil
}

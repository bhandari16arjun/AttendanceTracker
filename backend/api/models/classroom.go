package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Classroom struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name         string               `bson:"name" json:"name"`
	InstructorID primitive.ObjectID   `bson:"instructorId" json:"instructorId"`
	StudentIDs   []primitive.ObjectID `bson:"studentIds" json:"studentIds"`
	UniqueCode   string               `bson:"uniqueCode" json:"uniqueCode"`
}

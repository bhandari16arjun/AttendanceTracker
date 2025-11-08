package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AttendanceSession struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ClassroomID primitive.ObjectID `bson:"classroomId" json:"classroomId"`
	StartTime   time.Time          `bson:"startTime" json:"startTime"`
	EndTime     time.Time          `bson:"endTime" json:"endTime"`
	QRCodeData  string             `bson:"qrCodeData" json:"qrCodeData"` //session ID
}

type AttendanceRecord struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SessionID primitive.ObjectID `bson:"sessionId" json:"sessionId"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
	Status    string             `bson:"status" json:"status"` // PRESENT or ABSENT
}

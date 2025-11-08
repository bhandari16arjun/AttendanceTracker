package repository

import (
	"context"
	"presently/api/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type AttendanceRepository struct {
	sessionCollection *mongo.Collection
	recordCollection  *mongo.Collection
}

func NewAttendanceRepository(db *mongo.Database) *AttendanceRepository {
	return &AttendanceRepository{
		sessionCollection: db.Collection("sessions"),
		recordCollection:  db.Collection("records"),
	}
}

// Attendance session
func (r *AttendanceRepository) CreateSession(ctx context.Context, session *models.AttendanceSession) error {
	_, err := r.sessionCollection.InsertOne(ctx, session)
	return err
}

func (r *AttendanceRepository) GetSessionById(ctx context.Context, sessionId primitive.ObjectID) (*models.AttendanceSession, error) {
	filter := bson.M{"_id": sessionId}
	var session models.AttendanceSession
	err := r.sessionCollection.FindOne(ctx, filter).Decode(&session)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// Attendance record
func (r *AttendanceRepository) CreateRecord(ctx context.Context, record *models.AttendanceRecord) error {
	_, err := r.recordCollection.InsertOne(ctx, record)
	return err
}

func (r *AttendanceRepository) FindRecordBySessionAndUser(ctx context.Context, sessionId, userId primitive.ObjectID) (*models.AttendanceRecord,error) {
	filter := bson.M{"sessionId": sessionId, "userId": userId}
	var record models.AttendanceRecord
	err := r.recordCollection.FindOne(ctx, filter).Decode(&record)
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *AttendanceRepository) GetRecordsByStudent(ctx context.Context, userId primitive.ObjectID) ([]*models.AttendanceRecord, error) {
	filter := bson.M{"userId": userId}
	cursor, err := r.recordCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var records []*models.AttendanceRecord
	for cursor.Next(ctx) {
		var record models.AttendanceRecord
		if err := cursor.Decode(&record); err != nil {
			return nil, err
		}
		records = append(records, &record)
	}
	return records, nil
}
// TODO: optimize this function with aggregation pipeline
func (r *AttendanceRepository) GetRecordsByClassroom(ctx context.Context, classroomId primitive.ObjectID) ([]*models.AttendanceRecord, error) {
	// First, find all sessions for the given classroom
	sessionFilter := bson.M{"classroomId": classroomId}
	sessionCursor, err := r.sessionCollection.Find(ctx, sessionFilter)
	if err != nil {
		return nil, err
	}
	defer sessionCursor.Close(ctx)

	var sessionIds []primitive.ObjectID
	for sessionCursor.Next(ctx) {
		var session models.AttendanceSession
		if err := sessionCursor.Decode(&session); err != nil {
			return nil, err
		}
		sessionIds = append(sessionIds, session.ID)
	}

	// Now, find all records for the retrieved session IDs
	recordFilter := bson.M{"sessionId": bson.M{"$in": sessionIds}}
	recordCursor, err := r.recordCollection.Find(ctx, recordFilter)
	if err != nil {
		return nil, err
	}
	defer recordCursor.Close(ctx)

	var records []*models.AttendanceRecord
	for recordCursor.Next(ctx) {
		var record models.AttendanceRecord
		if err := recordCursor.Decode(&record); err != nil {
			return nil, err
		}
		records = append(records, &record)
	}
	return records, nil
}

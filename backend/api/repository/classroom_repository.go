package repository

import (
	"context"
	"presently/api/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ClassroomRepository struct {
	collection *mongo.Collection
}

func NewClassroomRepository(db *mongo.Database) *ClassroomRepository {
	return &ClassroomRepository{
		collection: db.Collection("classroom"),
	}
}

func (r *ClassroomRepository) CreateNewClassroom(ctx context.Context, classroom *models.Classroom) error {
	_, err := r.collection.InsertOne(ctx, classroom)
	return err
}
func (r *ClassroomRepository) GetClassroomById(ctx context.Context, classroomId primitive.ObjectID) (*models.Classroom, error) {
	filter := bson.M{"_id": classroomId}
	var classroom models.Classroom
	err := r.collection.FindOne(ctx, filter).Decode(&classroom)
	if err != nil {
		return nil, err
	}
	return &classroom, nil
}

func (r *ClassroomRepository) GetClassroomByCode(ctx context.Context, code string) (*models.Classroom, error) {
	filter := bson.M{"uniqueCode": code}
	var classroom models.Classroom
	err := r.collection.FindOne(ctx, filter).Decode(&classroom)
	if err != nil {
		return nil, err
	}
	return &classroom, nil
}

func (r *ClassroomRepository) AddStudentToClassroom(ctx context.Context, classroomId, studentId primitive.ObjectID) error {
	filter := bson.M{"_id": classroomId}
	update := bson.M{"$push": bson.M{"studentIds": studentId}}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}
func (r*ClassroomRepository) RemoveStudentFromClassroom(ctx context.Context, classroomId, studentId primitive.ObjectID) error {
	filter := bson.M{"_id": classroomId}
	update := bson.M{"$pull": bson.M{"studentIds": studentId}}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}
func (r *ClassroomRepository) GetClassroomsByInstructor(ctx context.Context, instructorId primitive.ObjectID) ([]*models.Classroom, error) {
	filter := bson.M{"instructorId": instructorId}
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var classrooms []*models.Classroom
	for cursor.Next(ctx) {
		var classroom models.Classroom
		if err := cursor.Decode(&classroom); err != nil {
			return nil, err
		}
		classrooms = append(classrooms, &classroom)
	}
	// lastly check for any errors during iteration
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return classrooms, nil
}

func (r *ClassroomRepository) GetClassroomsByStudent(ctx context.Context, studentId primitive.ObjectID) ([]*models.Classroom, error) {
	filter := bson.M{"studentIds": studentId}
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var classrooms []*models.Classroom
	for cursor.Next(ctx) {
		var classroom models.Classroom
		if err := cursor.Decode(&classroom); err != nil {
			return nil, err
		}
		classrooms = append(classrooms, &classroom)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return classrooms, nil
}
package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"backend/internal/database"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateClass handles the creation of a new classroom.
func (h *APIHandler) CreateClass(w http.ResponseWriter, r *http.Request) {
		// 1. Retrieve the user ID from the context (set by AuthMiddleware)
		instructorIDHex, ok := r.Context().Value(UserIDContextKey).(string)
		if !ok {
			http.Error(w, `{"error": "Could not retrieve user ID from token"}`, http.StatusInternalServerError)
			return
		}
		instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)
	
			// 2. Decode the request body
			var req struct {
				Name string `json:"name"`
				Code string `json:"code"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
				return
			}
	
			classroomsCollection := h.DB.Collection("classrooms")
	
			// 3. Create the new classroom document with the new structure
			newClass := database.Classroom{
				ID:           primitive.NewObjectID(),
				Name:         req.Name,
				Code:         req.Code,
				InstructorID: instructorID,
				EnrolledStudents: make(map[string]int),
				LectureIDs: []primitive.ObjectID{},
			}
	
			// 4. Insert the new classroom into the database
			_, err := classroomsCollection.InsertOne(context.TODO(), newClass)
			if err != nil {
				http.Error(w, `{"error": "Failed to create classroom"}`, http.StatusInternalServerError)
				return
			}
	
			// 5. Respond with the created classroom object
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(newClass)
    }

// ClassroomWithPercentage embeds a Classroom and adds the attendance percentage for the user.
type ClassroomWithPercentage struct {
	database.Classroom
	AttendancePercentage float64 `json:"attendancePercentage"`
}

// GetMyEnrolledClasses retrieves all classrooms a user is enrolled in as a student,
// along with their attendance percentage for each class.
func (h *APIHandler) GetMyEnrolledClasses(w http.ResponseWriter, r *http.Request) {
	// 1. Get the user ID from the authentication token.
	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	usersCollection := h.DB.Collection("users")
	classroomsCollection := h.DB.Collection("classrooms")

	// 2. Find the user document to access their history.
	var user database.User
	err := usersCollection.FindOne(context.TODO(), bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
		return
	}

	// 3. Extract the classroom IDs from the keys of the user's AttendanceHistory map.
	var classroomIDs []primitive.ObjectID
	if user.AttendanceHistory != nil {
		for classIDHex := range user.AttendanceHistory {
			classID, err := primitive.ObjectIDFromHex(classIDHex)
			if err == nil {
				classroomIDs = append(classroomIDs, classID)
			}
		}
	}

	// 4. If the user is in no classrooms, return an empty list.
	if len(classroomIDs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]ClassroomWithPercentage{})
		return
	}

	// 5. Find all classrooms where the _id is in the list we just built.
	cursor, err := classroomsCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": classroomIDs}})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch classrooms"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var classrooms []database.Classroom
	if err = cursor.All(context.TODO(), &classrooms); err != nil {
		http.Error(w, `{"error": "Failed to decode classrooms"}`, http.StatusInternalServerError)
		return
	}

	// 6. Calculate percentage for each class and build the final response.
	var results []ClassroomWithPercentage
	for _, classroom := range classrooms {
		if classroom.InstructorID == userID {
			continue
		}

		totalLectures := len(classroom.LectureIDs)
		
		// Create a set of the user's attended lecture IDs for this class
		attendedSet := make(map[primitive.ObjectID]bool)
		if lectures, ok := user.AttendanceHistory[classroom.ID.Hex()]; ok {
			for _, lID := range lectures {
				attendedSet[lID] = true
			}
		}

		// Count how many of the CLASSROOM's lectures the user has attended.
		// This ensures we don't count "ghost" lectures (e.g. deleted ones) that might remain in user history.
		verifiedAttendedCount := 0
		for _, classLectureID := range classroom.LectureIDs {
			if attendedSet[classLectureID] {
				verifiedAttendedCount++
			}
		}

		var percentage float64
		if totalLectures > 0 {
			percentage = (float64(verifiedAttendedCount) / float64(totalLectures)) * 100
		} else {
			percentage = 0 
		}

		results = append(results, ClassroomWithPercentage{
			Classroom:            classroom,
			AttendancePercentage: percentage,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GetMyTaughtClasses retrieves all classrooms where the user is the instructor.
func (h *APIHandler) GetMyTaughtClasses(w http.ResponseWriter, r *http.Request) {
	// 1. Get the user ID from the authentication token.
	instructorIDHex, ok := r.Context().Value(UserIDContextKey).(string)
	if !ok {
		http.Error(w, `{"error": "Could not retrieve user ID from token"}`, http.StatusInternalServerError)
		return
	}
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	classroomsCollection := h.DB.Collection("classrooms")

	// 2. Find all classrooms where the instructor_id matches the current user's ID.
	cursor, err := classroomsCollection.Find(context.TODO(), bson.M{"instructor_id": instructorID})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch taught classes"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	// 3. Decode the results into a slice of Classroom objects.
	var classrooms []database.Classroom
	if err = cursor.All(context.TODO(), &classrooms); err != nil {
		http.Error(w, `{"error": "Failed to decode classrooms"}`, http.StatusInternalServerError)
		return
	}

	if classrooms == nil {
		classrooms = []database.Classroom{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(classrooms)
}

// GetClassroomDetails retrieves a single classroom by its ID.
func (h *APIHandler) GetClassroomDetails(w http.ResponseWriter, r *http.Request) {
	// 1. Get classID from the URL parameter.
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid class ID format"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")

	var classroom database.Classroom
	err = classroomsCollection.FindOne(context.TODO(), bson.M{"_id": classID}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Classroom not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error while finding classroom"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(classroom)
}

// GetLectureDetails retrieves a single lecture by its ID.
func (h *APIHandler) GetLectureDetails(w http.ResponseWriter, r *http.Request) {
	// 1. Get lectureID from the URL parameter.
	lectureIDHex := chi.URLParam(r, "lectureID")
	lectureID, err := primitive.ObjectIDFromHex(lectureIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid lecture ID format"}`, http.StatusBadRequest)
		return
	}

	lecturesCollection := h.DB.Collection("lectures")

	var lecture database.Lecture
	err = lecturesCollection.FindOne(context.TODO(), bson.M{"_id": lectureID}).Decode(&lecture)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Lecture not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error while finding lecture"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lecture)
}

// JoinClass allows a student to join a classroom using a code.
func (h *APIHandler) JoinClass(w http.ResponseWriter, r *http.Request) {
	// 1. Get student ID from the authentication token
	studentIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	studentID, _ := primitive.ObjectIDFromHex(studentIDHex)

	// 2. Get the classroom code from the request body
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body, expected 'code'"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	usersCollection := h.DB.Collection("users")

	// 3. Find the classroom by its unique code
	var classroom database.Classroom
	err := classroomsCollection.FindOne(context.TODO(), bson.M{"code": req.Code}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Classroom with that code not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "Database error while finding classroom"}`, http.StatusInternalServerError)
		return
	}
	
	if classroom.InstructorID == studentID {
		http.Error(w, `{"error": "You cannot join your own class as a student"}`, http.StatusBadRequest)
		return
	}

	updateClassroom := bson.M{
		"$set": bson.M{
			"enrolled_students." + studentID.Hex(): 0,
		},
	}
	_, err = classroomsCollection.UpdateOne(context.TODO(), bson.M{"_id": classroom.ID}, updateClassroom)
	if err != nil {
		http.Error(w, `{"error": "Failed to add student to classroom"}`, http.StatusInternalServerError)
		return
	}

	updateUser := bson.M{
		"$set": bson.M{
			"attendance_history." + classroom.ID.Hex(): []primitive.ObjectID{},
		},
	}
	_, err = usersCollection.UpdateOne(context.TODO(), bson.M{"_id": studentID}, updateUser)
	if err != nil {
		http.Error(w, `{"error": "Failed to add classroom to user's history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully joined classroom"})
}

// StudentAttendanceDetailsResponse defines the structure for the detailed attendance response.
type StudentAttendanceDetailsResponse struct {
	AttendedLectureDates []time.Time `json:"attendedLectureDates"`
	TotalLectureDates    []time.Time `json:"totalLectureDates"`
}

// GetStudentClassAttendanceDetails retrieves the specific dates a student attended a class
// compared to all the dates lectures were held for that class.
func (h *APIHandler) GetStudentClassAttendanceDetails(w http.ResponseWriter, r *http.Request) {
	// 1. Get classID and userID from the URL parameters.
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid class ID format"}`, http.StatusBadRequest)
		return
	}
	userIDHex := chi.URLParam(r, "userID")
	userID, err := primitive.ObjectIDFromHex(userIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid user ID format"}`, http.StatusBadRequest)
		return
	}

	usersCollection := h.DB.Collection("users")
	classroomsCollection := h.DB.Collection("classrooms")
	lecturesCollection := h.DB.Collection("lectures")

	var user database.User
	if err := usersCollection.FindOne(context.TODO(), bson.M{"_id": userID}).Decode(&user); err != nil {
		http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
		return
	}

	var classroom database.Classroom
	if err := classroomsCollection.FindOne(context.TODO(), bson.M{"_id": classID}).Decode(&classroom); err != nil {
		http.Error(w, `{"error": "Classroom not found"}`, http.StatusNotFound)
		return
	}

	totalLectureIDs := classroom.LectureIDs
	if len(totalLectureIDs) == 0 { // No lectures in this class yet
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(StudentAttendanceDetailsResponse{
			AttendedLectureDates: []time.Time{},
			TotalLectureDates:    []time.Time{},
		})
		return
	}

	cursor, err := lecturesCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": totalLectureIDs}})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch lecture details"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var allLectures []database.Lecture
	if err = cursor.All(context.TODO(), &allLectures); err != nil {
		http.Error(w, `{"error": "Failed to decode lecture details"}`, http.StatusInternalServerError)
		return
	}

	attendedSet := make(map[primitive.ObjectID]bool)
	if attendedLectureIDs, ok := user.AttendanceHistory[classID.Hex()]; ok {
		for _, id := range attendedLectureIDs {
			attendedSet[id] = true
		}
	}

	var attendedDates []time.Time
	var totalDates []time.Time
	for _, lecture := range allLectures {
		totalDates = append(totalDates, lecture.Date)
		if attendedSet[lecture.ID] {
			attendedDates = append(attendedDates, lecture.Date)
		}
	}

	response := StudentAttendanceDetailsResponse{
		AttendedLectureDates: attendedDates,
		TotalLectureDates:    totalDates,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateLecture handles the creation of a new lecture for a specific classroom.
func (h *APIHandler) CreateLecture(w http.ResponseWriter, r *http.Request) {
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID format"}`, http.StatusBadRequest)
		return
	}

	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	userID, _ := primitive.ObjectIDFromHex(userIDHex)

	classroomsCollection := h.DB.Collection("classrooms")
	var classroom database.Classroom
	err = classroomsCollection.FindOne(context.TODO(), bson.M{"_id": classID, "instructor_id": userID}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error": "Error finding classroom"}`, http.StatusInternalServerError)
		return
	}

	newLecture := database.Lecture{
		ID:                primitive.NewObjectID(),
		ClassroomID:       classID,
		Date:              time.Now(),
		AttendedBy:        []primitive.ObjectID{},
		LiveDetectedUsers: []primitive.ObjectID{},
	}

	lecturesCollection := h.DB.Collection("lectures")
	_, err = lecturesCollection.InsertOne(context.TODO(), newLecture)
	if err != nil {
		http.Error(w, `{"error": "Failed to create lecture"}`, http.StatusInternalServerError)
		return
	}

	_, err = classroomsCollection.UpdateOne(
		context.TODO(),
		bson.M{"_id": classID},
		bson.M{"$addToSet": bson.M{"lecture_ids": newLecture.ID}},
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update classroom with new lecture"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newLecture)
}

// GetLecturesForClass retrieves all lectures for a given class, sorted by date.
func (h *APIHandler) GetLecturesForClass(w http.ResponseWriter, r *http.Request) {
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid class ID format"}`, http.StatusBadRequest)
		return
	}

	lecturesCollection := h.DB.Collection("lectures")

	findOptions := options.Find()
	findOptions.SetSort(bson.D{{"date", -1}}) // Newest first

	cursor, err := lecturesCollection.Find(context.TODO(), bson.M{"classroom_id": classID}, findOptions)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch lectures for class"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var lectures []database.Lecture
	if err = cursor.All(context.TODO(), &lectures); err != nil {
		http.Error(w, `{"error": "Failed to decode lectures"}`, http.StatusInternalServerError)
		return
	}

	if lectures == nil {
		lectures = []database.Lecture{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lectures)
}

// StudentAnalytics defines the analytics data for a single student in a class.
type StudentAnalytics struct {
	UserID               string  `json:"userId"`
	Name                 string  `json:"name"`
	Email                string  `json:"email"`
	AttendedLecturesCount int     `json:"attendedLecturesCount"`
	AttendancePercentage float64 `json:"attendancePercentage"`
}

// ClassAnalyticsResponse defines the structure for the class analytics response.
type ClassAnalyticsResponse struct {
	TotalLecturesCount int                `json:"totalLecturesCount"`
	Students           []StudentAnalytics `json:"students"`
}

// GetClassAnalytics retrieves a full attendance report for a class.
func (h *APIHandler) GetClassAnalytics(w http.ResponseWriter, r *http.Request) {
	// 1. Verify user is the instructor for this class
	instructorIDHex, _ := r.Context().Value(UserIDContextKey).(string)
	instructorID, _ := primitive.ObjectIDFromHex(instructorIDHex)

	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID"}`, http.StatusBadRequest)
		return
	}

	classroomsCollection := h.DB.Collection("classrooms")
	var classroom database.Classroom
	err = classroomsCollection.FindOne(context.TODO(), bson.M{"_id": classID, "instructor_id": instructorID}).Decode(&classroom)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, `{"error": "Forbidden: You are not the instructor of this class"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error": "Error finding classroom"}`, http.StatusInternalServerError)
		return
	}

	// 2. Prepare for fetching student details
	studentIDs := []primitive.ObjectID{}
	for idHex := range classroom.EnrolledStudents {
		studentID, err := primitive.ObjectIDFromHex(idHex)
		if err == nil {
			studentIDs = append(studentIDs, studentID)
		}
	}

	// 3. Fetch all student user documents in one query
	usersCollection := h.DB.Collection("users")
	cursor, err := usersCollection.Find(context.TODO(), bson.M{"_id": bson.M{"$in": studentIDs}})
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch student details"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	// Create a map for easy lookup of user details by ID
	userMap := make(map[string]database.User)
	for cursor.Next(context.TODO()) {
		var user database.User
		if err := cursor.Decode(&user); err == nil {
			userMap[user.ID.Hex()] = user
		}
	}


	// 4. Build the response
	totalLectures := len(classroom.LectureIDs)
	studentAnalytics := []StudentAnalytics{}

	for idHex, attendedCount := range classroom.EnrolledStudents {
		user, ok := userMap[idHex]
		if !ok {
			continue // Skip if user details weren't found for some reason
		}

		var percentage float64
		if totalLectures > 0 {
			percentage = (float64(attendedCount) / float64(totalLectures)) * 100
		}

		studentAnalytics = append(studentAnalytics, StudentAnalytics{
			UserID:               idHex,
			Name:                 user.Name,
			Email:                user.Email,
			AttendedLecturesCount: attendedCount,
			AttendancePercentage: percentage,
		})
	}

	response := ClassAnalyticsResponse{
		TotalLecturesCount: totalLectures,
		Students:           studentAnalytics,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// // ... (at the end of the file)
// // LeaveClass allows a user to leave a classroom.
// func (h *APIHandler) LeaveClass(w http.ResponseWriter, r *http.Request) {
// 	userIDHex, _ := r.Context().Value(UserIDContextKey).(string)
// 	userID, _ := primitive.ObjectIDFromHex(userIDHex)
// 	// Get classID from the URL parameter
// 	classIDHex := chi.URLParam(r, "classID")
// 	classID, err := primitive.ObjectIDFromHex(classIDHex)
// 	if err != nil {
// 		http.Error(w, `{"error": "Invalid classroom ID format"}`, http.StatusBadRequest)
// 		return
// 	}
// 	classroomsCollection := h.DB.Collection("classrooms")
// 	usersCollection := h.DB.Collection("users")
// 	// Use $pull to remove an item from an array
// 	// Remove student from the classroom's student list
// 	_, err = classroomsCollection.UpdateOne(
// 		context.TODO(),
// 		bson.M{"_id": classID},
// 		bson.M{"$pull": bson.M{"student_ids": userID}},
// 	)
// 	if err != nil {
// 		http.Error(w, `{"error": "Failed to remove student from classroom"}`, http.StatusInternalServerError)
// 		return
// 	}
// 	// Remove classroom from the student's classroom list
// 	_, err = usersCollection.UpdateOne(
// 		context.TODO(),
// 		bson.M{"_id": userID},
// 		bson.M{"$pull": bson.M{"classroom_ids": classID}},
// 	)
// 	if err != nil {
// 		http.Error(w, `{"error": "Failed to remove classroom from user"}`, http.StatusInternalServerError)
// 		return
// 	}
// 	w.Header().Set("Content-Type", "application/json")
// 	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully left classroom"})
// }

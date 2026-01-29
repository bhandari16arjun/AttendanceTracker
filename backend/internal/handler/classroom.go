package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time" // Added

	"backend/internal/database" // Use your module name

	"github.com/go-chi/chi/v5" // Uncommented
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateClass handles the creation of a new classroom.
// CreateClass handles the creation of a new classroom based on the updated model.
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
				// Initialize EnrolledStudents with the instructor, who has attended 0 lectures.
				EnrolledStudents: make(map[string]int),
				// Initialize LectureIDs as an empty slice.
				LectureIDs: []primitive.ObjectID{},
			}
	
			// 4. Insert the new classroom into the database
			_, err := classroomsCollection.InsertOne(context.TODO(), newClass)
			if err != nil {
				// In a real app, you'd check for duplicate code errors specifically
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
		// As per requirement, filter out classes where the user is the instructor.
		if classroom.InstructorID == userID {
			continue
		}

		totalLectures := len(classroom.LectureIDs)
		
		attendedLectures := 0
		if lectures, ok := user.AttendanceHistory[classroom.ID.Hex()]; ok {
			attendedLectures = len(lectures)
		}

		var percentage float64
		if totalLectures > 0 {
			percentage = (float64(attendedLectures) / float64(totalLectures)) * 100
		} else {
			// If no lectures have been held, percentage is 0. 
			// You could also set this to 100 based on business rules.
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

	// If no classes are found, return an empty array instead of null.
	if classrooms == nil {
		classrooms = []database.Classroom{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(classrooms)
}

// JoinClass allows a student to join a classroom using a code.
// JoinClass allows a student to join a classroom using a code, updating the new data models.
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
	

	// 4. Prevent the instructor from joining their own class as a student
	if classroom.InstructorID == studentID {
		http.Error(w, `{"error": "You cannot join your own class as a student"}`, http.StatusBadRequest)
		return
	}

	// 5. Update the Classroom document to add the new student
	// Using dot notation with $set adds the student to the 'EnrolledStudents' map with 0 lectures attended.
	// This operation is idempotent; running it again won't cause duplicates.
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

	// 6. Update the User document to add the new classroom to their history
	// This adds the classroom to the user's 'AttendanceHistory' map with an empty list of attended lectures.
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

	// 2. Fetch the user and classroom documents.
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

	// 3. Get the list of all lecture IDs for the class.
	totalLectureIDs := classroom.LectureIDs
	if len(totalLectureIDs) == 0 { // No lectures in this class yet
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(StudentAttendanceDetailsResponse{
			AttendedLectureDates: []time.Time{},
			TotalLectureDates:    []time.Time{},
		})
		return
	}


	// 4. Fetch all lecture documents for this class to get their dates.
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

	// 5. Get the list of attended lecture IDs for this class from the user's history
	//    and create a map for efficient lookup.
	attendedSet := make(map[primitive.ObjectID]bool)
	if attendedLectureIDs, ok := user.AttendanceHistory[classID.Hex()]; ok {
		for _, id := range attendedLectureIDs {
			attendedSet[id] = true
		}
	}

	// 6. Build the lists of dates.
	var attendedDates []time.Time
	var totalDates []time.Time
	for _, lecture := range allLectures {
		totalDates = append(totalDates, lecture.Date)
		if attendedSet[lecture.ID] {
			attendedDates = append(attendedDates, lecture.Date)
		}
	}

	// 7. Construct and send the response.
	response := StudentAttendanceDetailsResponse{
		AttendedLectureDates: attendedDates,
		TotalLectureDates:    totalDates,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateLecture handles the creation of a new lecture for a specific classroom.
func (h *APIHandler) CreateLecture(w http.ResponseWriter, r *http.Request) {
	// Get classID from the URL parameter
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid classroom ID format"}`, http.StatusBadRequest)
		return
	}

	// Basic check to ensure the user is the instructor of this class
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

	// For this implementation, we'll create a lecture with the current time.
	// A more robust version might take a title/date in the request body.
	newLecture := database.Lecture{
		ID:          primitive.NewObjectID(),
		ClassroomID: classID,
		Date:        time.Now(),
		AttendedBy:  []primitive.ObjectID{},
	}

	lecturesCollection := h.DB.Collection("lectures")
	_, err = lecturesCollection.InsertOne(context.TODO(), newLecture)
	if err != nil {
		http.Error(w, `{"error": "Failed to create lecture"}`, http.StatusInternalServerError)
		return
	}

	// Add the lecture ID to the classroom's list of lectures
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
	// 1. Get classID from the URL parameter.
	classIDHex := chi.URLParam(r, "classID")
	classID, err := primitive.ObjectIDFromHex(classIDHex)
	if err != nil {
		http.Error(w, `{"error": "Invalid class ID format"}`, http.StatusBadRequest)
		return
	}

	lecturesCollection := h.DB.Collection("lectures")

	// 2. Find all lectures for the given classroom ID, sort by date descending.
	findOptions := options.Find()
	findOptions.SetSort(bson.D{{"date", -1}}) // Newest first

	cursor, err := lecturesCollection.Find(context.TODO(), bson.M{"classroom_id": classID}, findOptions)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch lectures for class"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	// 3. Decode the results.
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

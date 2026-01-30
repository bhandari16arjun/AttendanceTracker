// types/index.ts

export interface User {
  id: string;
  name: string;
  email: string;
  attendanceHistory?: Record<string, string[]>; // map[ClassroomID.Hex()] -> []LectureID.Hex()
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  enrolledStudents?: Record<string, number>; // map[StudentID.Hex()] -> No of Lectures Attended
  lectureIds?: string[]; // list of LectureIDs
}

export interface Lecture {
  id: string;
  classroomId: string;
  date: string; // ISO date string
  attendedBy?: string[]; // List of StudentIDs.Hex()
}

export interface ClassroomWithPercentage extends Classroom {
  attendancePercentage: number;
}

export interface StudentAnalytics {
  userId: string;
  name: string;
  email: string;
  attendedLecturesCount: number;
  attendancePercentage: number;
}

export interface ClassAnalyticsResponse {
  totalLecturesCount: number;
  students: StudentAnalytics[];
}

// AttendanceSummary and AttendanceHistoryRecord interfaces removed as per backend changes.
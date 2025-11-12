// types/index.ts

export interface Classroom {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  studentIds: string[];
}

export interface AttendanceSummary {
  userId: string;
  name:string;
  email: string;
  attendedCount: number;
}

// NEW TYPE
export interface AttendanceHistoryRecord {
  id: string;
  userId: string;
  classroomId: string;
  timestamp: string; // ISO date string
  classroomInfo: {
    subjectName: string;
    subjectCode: string;
  };
}
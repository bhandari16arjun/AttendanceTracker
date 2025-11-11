// types/index.ts

export interface Classroom {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  studentIds: string[];
}

// NEW TYPE
export interface AttendanceSummary {
  userId: string;
  name: string;
  email: string;
  attendedCount: number;
}
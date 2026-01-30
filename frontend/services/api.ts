// services/api.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

// !! IMPORTANT !!
// This should still be your computer's local IP address.
const API_BASE_URL = 'http://10.125.31.140:3000/api';

/**
 * A helper function to create authenticated headers for API requests.
 * It retrieves the JWT from AsyncStorage.
 */
async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('userToken');
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * A centralized object for all API calls.
 */
export const api = {
  // --- AUTH ---
  register: (data: { name?: string; email?: string; password?: string }) => {
    return fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  login: (data: { email?: string; password?: string }) => {
    return fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // --- CLASSROOMS ---
  getClassroomDetails: async (classId: string) => {
    return fetch(`${API_BASE_URL}/classes/${classId}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  getClassAnalytics: async (classId: string) => {
    return fetch(`${API_BASE_URL}/classes/${classId}/analytics`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  createClass: async (data: { name: string; code: string }) => {
    return fetch(`${API_BASE_URL}/classes`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  getMyEnrolledClasses: async () => {
    return fetch(`${API_BASE_URL}/classes/enrolled`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  getMyTaughtClasses: async () => {
    return fetch(`${API_BASE_URL}/classes/taught`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  joinClass: async (data: { code: string }) => {
    return fetch(`${API_BASE_URL}/classes/join`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  leaveClass: async (classID: string) => {
    return fetch(`${API_BASE_URL}/classes/${classID}/leave`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
  },

  // --- LECTURES ---
  getLectureDetails: async (lectureId: string) => {
    return fetch(`${API_BASE_URL}/lectures/${lectureId}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  createLecture: async (classId: string) => {
    return fetch(`${API_BASE_URL}/classes/${classId}/lectures`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      // No body needed as per the current backend implementation
    });
  },
  getLecturesForClass: async (classId: string) => {
    return fetch(`${API_BASE_URL}/classes/${classId}/lectures`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },

  // --- ATTENDANCE ---
  createAttendanceSession: async (lectureId: string) => {
    return fetch(`${API_BASE_URL}/lectures/${lectureId}/attendance-session`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
  },
  markAttendance: async (data: { attendanceToken: string }) => {
    return fetch(`${API_BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  getClassAttendance: async (classID: string) => {
    return fetch(`${API_BASE_URL}/classes/${classID}/attendance`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  getMyAttendanceHistory: async () => {
    return fetch(`${API_BASE_URL}/attendance/history`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  getStudentClassAttendanceDetails: async (classId: string, userId: string) => {
    return fetch(`${API_BASE_URL}/classes/${classId}/students/${userId}/attendance`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },

  // --- USERS ---
  getUsersDetails: async (userIds: string[]) => {
    return fetch(`${API_BASE_URL}/users/details`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ userIds }),
    });
  },
};
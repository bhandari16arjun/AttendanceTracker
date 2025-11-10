import AsyncStorage from '@react-native-async-storage/async-storage';

// !! IMPORTANT !!
// Replace this with your computer's local IP address.
const API_BASE_URL = 'http://10.10.15.162:3000/api';

/**
 * A helper function to create authenticated headers for API requests.
 * It retrieves the JWT from AsyncStorage.
 */
async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
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
};
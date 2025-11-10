import AsyncStorage from '@react-native-async-storage/async-storage';

// !! IMPORTANT !!
// Replace this with your computer's local IP address.
const API_BASE_URL = 'http://10.10.15.162:3000/api';

// A helper function to create authenticated headers
async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// You can add all your API functions here
export const api = {
  register: async (data: any) => {
    return fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  login: async (data: any) => {
    return fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  getMyClasses: async () => {
    return fetch(`${API_BASE_URL}/classes`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
  },
  createClass: async (data: any) => {
    return fetch(`${API_BASE_URL}/classes`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  joinClass: async (data: any) => {
    return fetch(`${API_BASE_URL}/classes/join`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  // Add more functions as we go...
};
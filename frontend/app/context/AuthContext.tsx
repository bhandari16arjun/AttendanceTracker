// app/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode'; // Import the new library
import { api } from '@/services/api';

// Define the shape of the context data
interface AuthContextData {
  token: string | null;
  userId: string | null; // NEW: Add userId to our context
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Create the provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // NEW: State for userId
  const [isLoading, setIsLoading] = useState(true);

  // Check for a token in storage on initial app load
  useEffect(() => {
    async function loadToken() {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        if (storedToken) {
          setToken(storedToken);
          const decodedToken: { user_id: string } = jwtDecode(storedToken); // Decode token
          setUserId(decodedToken.user_id); // Set userId from decoded token
        }
      } catch (e) {
        console.error("Failed to load or decode token:", e);
        // If token is invalid, clear it
        await AsyncStorage.removeItem('userToken');
      } finally {
        setIsLoading(false);
      }
    }
    loadToken();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }
    const data = await response.json();
    const newToken = data.token;
    
    setToken(newToken);
    const decodedToken: { user_id: string } = jwtDecode(newToken); // Decode new token
    setUserId(decodedToken.user_id); // Set userId
    await AsyncStorage.setItem('userToken', newToken);
  };

  const signOut = async () => {
    setToken(null);
    setUserId(null); // Clear userId on sign out
    await AsyncStorage.removeItem('userToken');
  };

  return (
    <AuthContext.Provider value={{ token, userId, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useAuth = () => {
  return useContext(AuthContext);
};
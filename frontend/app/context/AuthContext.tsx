// app/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { api } from '@/services/api';
import { useNetInfo } from '@react-native-community/netinfo';
import { getQueue, removeFromQueue } from '@/services/offlineQueueService';

interface DecodedToken {
  user_id: string;
  name: string;
}

interface AuthContextData {
  token: string | null;
  userId: string | null;
  userName: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const netInfo = useNetInfo();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function loadToken() {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        if (storedToken) {
          setToken(storedToken);
          const decodedToken: DecodedToken = jwtDecode(storedToken);
          setUserId(decodedToken.user_id);
          setUserName(decodedToken.name);
        }
      } catch (e) {
        console.error("Failed to load or decode token:", e);
        await AsyncStorage.removeItem('userToken');
      } finally {
        setIsLoading(false);
      }
    }
    loadToken();
  }, []);

  // Effect to trigger synchronization when connection is restored
  useEffect(() => {
    const processOfflineQueue = async () => {
      // Only run if we are connected, not already syncing, and the user is logged in
      if (isSyncing || !netInfo.isConnected || !token) {
        return;
      }

      setIsSyncing(true);
      console.log('Connection detected. Checking offline queue...');
      
      const queue = await getQueue();
      if (queue.length > 0) {
        console.log(`Syncing ${queue.length} items...`);
        
        for (const item of queue) {
          try {
            const response = await api.markAttendance({ attendanceToken: item.attendanceToken });
            // A 409 Conflict "Already Marked" is a success in this context
            if (response.ok || response.status === 409) { 
              console.log(`Item ${item.id} synced successfully.`);
              await removeFromQueue(item.id);
            } else {
              console.warn(`Failed to sync item ${item.id}. Server responded with ${response.status}. Will retry on next connection.`);
            }
          } catch (error) {
            console.error(`A network error occurred while syncing item ${item.id}. Will retry later.`, error);
            // Stop syncing on a hard network error to retry when connection is stable
            break; 
          }
        }
        console.log('Sync process finished.');
      } else {
        console.log('Offline queue is empty.');
      }
      setIsSyncing(false);
    };

    // Add a small delay to avoid firing immediately on app load
    const timer = setTimeout(() => {
      processOfflineQueue();
    }, 3000);

    return () => clearTimeout(timer);

  }, [netInfo.isConnected, token, isSyncing]);

  const signIn = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }
    const data = await response.json();
    const newToken = data.token;
    
    setToken(newToken);
    const decodedToken: DecodedToken = jwtDecode(newToken);
    setUserId(decodedToken.user_id);
    setUserName(decodedToken.name);
    await AsyncStorage.setItem('userToken', newToken);
  };

  const signOut = async () => {
    setToken(null);
    setUserId(null);
    setUserName(null);
    await AsyncStorage.removeItem('userToken');
  };

  return (
    <AuthContext.Provider value={{ token, userId, userName, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
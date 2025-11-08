import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Simulate layout readiness (you can remove this if not needed)
    setIsReady(true);

    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        router.replace('/home');
      } else {
        router.replace('/register');
      }
    };

    if (isReady) {
      checkLoginStatus();
    }
  }, [isReady]);

  return null; 
}
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Camera, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

cssInterop(LinearGradient, { className: 'style' });

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (lockoutTime > 0) {
      setIsLockedOut(true);
      const timer = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsLockedOut(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const handleFailedAttempt = () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    
    if (newAttempts >= 5) {
      const penalty = newAttempts === 5 ? 30 : 60;
      setLockoutTime(penalty);
      setFailedAttempts(0);
      Alert.alert("Too many failed attempts", `Please wait ${penalty} seconds before trying again.`);
    }
  };

  const handlePasswordAuth = async () => {
    if (isLockedOut || isLoading) return;
    setIsLoading(true);

    try {
      const response = await api.login({ email, password });
      if (!response.ok) {
        handleFailedAttempt();
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid credentials');
      }

      const data = await response.json();
      await AsyncStorage.setItem('userToken', data.token);

      setFailedAttempts(0);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceAuth = () => {
    if (isLockedOut) return;
    Alert.alert("Face Auth", "This feature is not yet implemented.");
  };

  return (
    <LinearGradient 
      colors={['#3498DB', '#2C3E50']} 
      className="flex-1 p-6"
    >
      <View className="flex-1 justify-center">
        <View className="mb-8 items-center">
          <View className="bg-white p-4 rounded-full mb-4 shadow-lg">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1573496358961-3c82861ab8f4?w=200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fEJ1c2luZXNzd29tYW4lMjBwcm9mZXNzaW9uYWwlMjBleGVjdXRpdmV8ZW58MHx8MHx8fDA%3D' }}
              className="w-24 h-24 rounded-full"
            />
          </View>
          <Text className="text-2xl font-bold text-white">Welcome Back</Text>
          <Text className="text-white opacity-90 mt-1">Sign in to continue</Text>
        </View>
        
        {isLockedOut ? (
          <View className="bg-red-100 rounded-2xl p-6 items-center mb-6 shadow">
            <Text className="text-red-600 font-bold text-lg mb-2">Too Many Failed Attempts</Text>
            <Text className="text-red-600">Please wait {lockoutTime} seconds before trying again</Text>
          </View>
        ) : null}
        
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
          <View className="flex-row items-center border border-gray-300 rounded-xl p-4 mb-4 bg-gray-50">
            <User size={20} color="#3498DB" />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="flex-1 ml-3 text-[#2C3E50]"
            />
          </View>
          
          <View className="flex-row items-center border border-gray-300 rounded-xl p-4 mb-6 bg-gray-50">
            <Lock size={20} color="#3498DB" />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              className="flex-1 ml-3 text-[#2C3E50]"
            />
            <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={20} color="#7F8C8D" /> : <Eye size={20} color="#7F8C8D" />}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className="bg-[#3498DB] rounded-xl p-4 items-center mb-4 shadow"
            onPress={handlePasswordAuth}
            disabled={isLockedOut || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold text-lg">Sign In with Password</Text>
            }
          </TouchableOpacity>
          
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="text-gray-500 mx-4">OR</Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>
          
          <TouchableOpacity 
            className="flex-row bg-[#3498DB] rounded-xl p-4 items-center justify-center shadow"
            onPress={handleFaceAuth}
            disabled={isLockedOut}
          >
            <Camera size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">Sign In with Face ID</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-center">
          <Text className="text-white opacity-90">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text className="text-white font-bold">Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}
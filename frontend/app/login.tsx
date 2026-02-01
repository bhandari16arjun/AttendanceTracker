// app/login.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Camera as CameraIcon, Lock, User, Eye, EyeOff, X, Smile } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';
import { useAuth } from '@/app/context/AuthContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';

cssInterop(LinearGradient, { className: 'style' });

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithFace } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Face Login State
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState("Position your face");
  const [eyesOpen, setEyesOpen] = useState(true);

  const handlePasswordAuth = async () => {
    if (!email || !password) {
        Alert.alert("Error", "Please enter email and password");
        return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFaceLogin = async () => {
    if (!email) {
        Alert.alert("Email Required", "Please enter your email first to use Face ID.");
        return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed for Face ID.");
        return;
      }
    }
    setDetectionStatus("Position your face");
    setIsCameraVisible(true);
    setEyesOpen(true);
  };

  // Polling for Face Detection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const detectFaceLoop = async () => {
        if (!isCameraVisible || isVerifying || !cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.1,
                base64: false, 
                skipProcessing: true,
                shutterSound: false,
            });

            if (photo?.uri) {
                const result = await FaceDetector.detectFacesAsync(photo.uri, {
                    mode: FaceDetector.FaceDetectorMode.fast,
                    detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
                    runClassifications: FaceDetector.FaceDetectorClassifications.all,
                });

                if (result.faces.length > 0) {
                    const face = result.faces[0];
                    const rightEye = face.rightEyeOpenProbability;
                    const leftEye = face.leftEyeOpenProbability;
                    const IS_OPEN = 0.8;
                    const IS_CLOSED = 0.3;

                    if (eyesOpen && (rightEye < IS_CLOSED && leftEye < IS_CLOSED)) {
                        setEyesOpen(false);
                        setDetectionStatus("Blink detected! Open eyes...");
                    } else if (!eyesOpen && (rightEye > IS_OPEN && leftEye > IS_OPEN)) {
                        setEyesOpen(true);
                        setDetectionStatus("Verifying Identity...");
                        await captureAndLogin();
                    } else if (eyesOpen) {
                        setDetectionStatus("Please Blink to Login");
                    }
                } else {
                    setDetectionStatus("No face detected");
                }
            }
        } catch (e) {}
    };

    if (isCameraVisible) {
        interval = setInterval(detectFaceLoop, 800);
    }
    return () => clearInterval(interval);
  }, [isCameraVisible, isVerifying, eyesOpen]);

  const captureAndLogin = async () => {
    if (cameraRef.current && !isVerifying) {
        setIsVerifying(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: false,
            });
            
            if (photo?.base64) {
                 await signInWithFace(email, photo.base64);
                 setIsCameraVisible(false);
            }
        } catch (error: any) {
            Alert.alert("Face Login Failed", error.message);
        } finally {
            setIsVerifying(false);
        }
    }
  };

  return (
    <LinearGradient colors={['#3498DB', '#2C3E50']} className="flex-1 p-6">
      <View className="flex-1 justify-center">
        <View className="mb-8 items-center">
          <View className="bg-white p-4 rounded-full mb-4 shadow-lg">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1573496358961-3c82861ab8f4?w=200&auto-format&fit-crop&q=60' }}
              className="w-24 h-24 rounded-full"
            />
          </View>
          <Text className="text-2xl font-bold text-white">Welcome Back</Text>
          <Text className="text-white opacity-90 mt-1">Sign in to continue</Text>
        </View>
        
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
            className={`rounded-xl p-4 items-center mb-4 shadow ${isLoading ? 'bg-gray-400' : 'bg-[#3498DB]'}`}
            onPress={handlePasswordAuth}
            disabled={isLoading}
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
            className="flex-row bg-green-600 rounded-xl p-4 items-center justify-center shadow"
            onPress={handleStartFaceLogin}
          >
            <CameraIcon size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">Login with Face ID</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-center">
          <Text className="text-white opacity-90">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text className="text-white font-bold">Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Face Login Modal */}
      <Modal visible={isCameraVisible} animationType="slide">
          <View className="flex-1 bg-black">
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
              <View className="absolute top-12 left-4 z-10">
                  <TouchableOpacity onPress={() => setIsCameraVisible(false)} className="bg-black/50 p-2 rounded-full">
                      <X color="white" size={30} />
                  </TouchableOpacity>
              </View>
              <View className="absolute bottom-0 w-full bg-black/70 p-8 items-center rounded-t-3xl">
                  {isVerifying ? (
                      <ActivityIndicator size="large" color="#FFD700" />
                  ) : (
                      <Smile size={40} color="#FFD700" className="mb-4" />
                  )}
                  <Text className="text-white text-xl font-bold mb-2">Face Login</Text>
                  <Text className={`text-lg font-bold ${detectionStatus.includes("Verifying") ? "text-green-400" : "text-yellow-400"}`}>
                      {detectionStatus}
                  </Text>
                  <Text className="text-gray-400 text-center mt-4 text-xs">Blink your eyes to log in securely.</Text>
              </View>
          </View>
      </Modal>
    </LinearGradient>
  );
}
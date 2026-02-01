// app/register.tsx

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Camera as CameraIcon, Lock, User, Eye, EyeOff, CheckCircle, X, Smile } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import { api } from '@/services/api';

cssInterop(LinearGradient, { className: 'style' });

export default function RegisterScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const [eyesOpen, setEyesOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Polling for Face Detection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const detectFaceLoop = async () => {
        if (!isCameraVisible || isTakingPicture || !cameraRef.current) return;

        try {
            // Take a small, fast snapshot for detection
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.1,
                base64: false, // We only need URI for detection
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
                    
                    // Blink Logic
                    const IS_OPEN = 0.8;
                    const IS_CLOSED = 0.3;

                    if (eyesOpen && (rightEye < IS_CLOSED && leftEye < IS_CLOSED)) {
                        setEyesOpen(false);
                        setDetectionStatus("Blink detected! Open eyes...");
                    } else if (!eyesOpen && (rightEye > IS_OPEN && leftEye > IS_OPEN)) {
                        setEyesOpen(true);
                        setDetectionStatus("Capturing...");
                        await captureFinalPhoto();
                    } else if (eyesOpen) {
                        setDetectionStatus("Please Blink to capture");
                    }
                } else {
                    setDetectionStatus("No face detected");
                }
            }
        } catch (e) {
            // Ignore errors during polling
        }
    };

    if (isCameraVisible) {
        interval = setInterval(detectFaceLoop, 800); // Check every 800ms
    }

    return () => clearInterval(interval);
  }, [isCameraVisible, isTakingPicture, eyesOpen]);


  const handleStartCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to register your face.");
        return;
      }
    }
    setFaceImage(null);
    setDetectionStatus("Position your face");
    setIsCameraVisible(true);
    setEyesOpen(true);
  };

  const captureFinalPhoto = async () => {
    if (cameraRef.current && !isTakingPicture) {
        setIsTakingPicture(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
                skipProcessing: false,
            });
            if (photo?.base64) {
                setFaceImage(photo.base64);
                setIsCameraVisible(false);
                Alert.alert("Success", "Live face captured successfully!");
            }
        } catch (error) {
            console.log("Capture failed", error);
        } finally {
            setIsTakingPicture(false);
        }
    }
  };

  const handleRegistration = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (!faceImage) {
      Alert.alert("Error", "Face registration is required");
      return;
    }
    
    setIsLoading(true);
    try {
      const registrationData = { name, email, password, faceImage };
      const response = await api.register(registrationData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed.');
      }
      Alert.alert("Success", "Registration completed! You can now log in.");
      router.push('/login');
    } catch (error: any) {
         Alert.alert("Registration Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#f0f2f5', '#e1e5ea']} className="flex-1 p-6">
      <View className="flex-1 justify-center">
        <View className="mb-8 items-center">
          <View className="bg-white p-4 rounded-full mb-4 shadow-sm">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1573496358961-3c82861ab8f4?w=200&auto-format&fit-crop&q=60' }}
              className="w-24 h-24 rounded-full"
            />
          </View>
          <Text className="text-2xl font-bold text-[#1a2980]">Create Account</Text>
          <Text className="text-[#7F8C8D] mt-1">Register to get started</Text>
        </View>
        
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <User size={20} color="#1a2980" />
            <TextInput placeholder="Full Name" value={name} onChangeText={setName} className="flex-1 ml-3 text-[#2C3E50] font-medium" />
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <User size={20} color="#1a2980" />
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize='none' className="flex-1 ml-3 text-[#2C3E50] font-medium" />
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <Lock size={20} color="#1a2980" />
            <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!passwordVisible} className="flex-1 ml-3 text-[#2C3E50] font-medium" />
            <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={20} color="#7F8C8D" /> : <Eye size={20} color="#7F8C8D" />}
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-6">
            <Lock size={20} color="#1a2980" />
            <TextInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!confirmPasswordVisible} className="flex-1 ml-3 text-[#2C3E50] font-medium" />
            <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
              {confirmPasswordVisible ? <EyeOff size={20} color="#7F8C8D" /> : <Eye size={20} color="#7F8C8D" />}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className={`flex-row items-center justify-center rounded-xl p-4 mb-4 ${faceImage ? 'bg-green-500' : 'bg-[#1a2980]'}`}
            onPress={handleStartCamera}
          >
            <CameraIcon size={20} color="white" />
            <Text className="text-white font-bold text-lg ml-2">{faceImage ? 'Face Registered' : 'Register Face'}</Text>
            {faceImage && <CheckCircle size={20} color="white" className="ml-2" />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`rounded-xl p-4 items-center ${(!faceImage || isLoading) ? 'bg-gray-400' : 'bg-[#1a2980]'}`}
            onPress={handleRegistration}
            disabled={!faceImage || isLoading}
          >
            {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Register</Text>}
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-center mt-4">
          <Text className="text-[#7F8C8D]">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text className="text-[#1a2980] font-bold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isCameraVisible} animationType="slide">
          <View className="flex-1 bg-black">
              <CameraView 
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill} 
                  facing="front"
              />
              <View className="absolute top-12 left-4 z-10">
                  <TouchableOpacity onPress={() => setIsCameraVisible(false)} className="bg-black/50 p-2 rounded-full">
                      <X color="white" size={30} />
                  </TouchableOpacity>
              </View>
              
              <View className="absolute bottom-0 w-full bg-black/70 p-8 items-center rounded-t-3xl">
                  <Smile size={40} color="#FFD700" className="mb-4" />
                  <Text className="text-white text-xl font-bold mb-2">Liveness Check</Text>
                  <Text className={`text-lg font-bold ${detectionStatus.includes("Capturing") ? "text-green-400" : "text-yellow-400"}`}>{detectionStatus}</Text>
                  <Text className="text-gray-400 text-center mt-4 text-xs">Blink your eyes to take the photo automatically.</Text>
              </View>
          </View>
      </Modal>
    </LinearGradient>
  );
}
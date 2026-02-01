// app/face-auth-qr.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Camera as CameraIcon, UserCheck, QrCode, CheckCircle, XCircle, ArrowLeft, Smile } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import * as FaceDetector from 'expo-face-detector';
import { api } from '@/services/api';

type AuthStep = 'face-auth' | 'qr-scan' | 'submitting' | 'success' | 'failure';

export default function FaceAuthQRScreen() {
  const router = useRouter();
  const [authStep, setAuthStep] = useState<AuthStep>('face-auth');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  // State
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  
  // Blink Detection State
  const [detectionStatus, setDetectionStatus] = useState("Position your face");
  const [eyesOpen, setEyesOpen] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
        requestPermission();
    }
  }, [permission]);

  // Polling for Face Detection (Only active in 'face-auth' step)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const detectFaceLoop = async () => {
        // Stop if not in face-auth step, or if capturing, or if camera ref is missing
        if (authStep !== 'face-auth' || isCapturing || !cameraRef.current) return;

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
                        setDetectionStatus("Capturing...");
                        await captureFace();
                    } else if (eyesOpen) {
                        setDetectionStatus("Please Blink to capture");
                    }
                } else {
                    setDetectionStatus("No face detected");
                }
            }
        } catch (e) {}
    };

    if (authStep === 'face-auth') {
        interval = setInterval(detectFaceLoop, 800);
    }

    return () => clearInterval(interval);
  }, [authStep, isCapturing, eyesOpen]);

  const captureFace = async () => {
    if (cameraRef.current && !isCapturing) {
        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: false,
            });
            
            if (photo?.base64) {
                 setDetectionStatus("Verifying Identity...");
                 // 1. Verify Face with Backend
                 const response = await api.verifyFace(photo.base64);
                 
                 if (response.ok) {
                     setFaceImage(photo.base64);
                     setAuthStep('qr-scan'); // Proceed to QR
                 } else {
                     Alert.alert("Unauthorized", "Face verification failed. You are not authorized.", [
                         { text: "OK", onPress: () => router.back() }
                     ]);
                 }
            }
        } catch (error) {
            Alert.alert("Error", "Failed to capture or verify face");
            setIsCapturing(false); // Only reset if technical error, otherwise we leave
        }
        // If success, we moved step. If fail, we routed back.
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || !faceImage) return;
    setScanned(true);
    setAuthStep('submitting');
    
    try {
      const response = await api.markAttendance({ 
          attendanceToken: data,
          faceImage: faceImage 
      });

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 409) { 
            setFailureMessage("You have already marked attendance for this session.");
        } else {
            setFailureMessage(err.error || 'Failed to mark attendance.');
        }
        throw new Error("Attendance submission failed");
      }
      setAuthStep('success');
      setTimeout(() => router.replace('/home'), 2000);
    } catch (error: any) {
      setAuthStep('failure');
    }
  };
  
  const renderContent = () => {
    switch (authStep) {
      case 'face-auth':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg h-[450px]">
            <UserCheck color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4 mb-2">Face Verification</Text>
            <Text className={`text-lg font-bold mb-4 ${detectionStatus.includes("Capturing") ? "text-green-500" : "text-orange-500"}`}>
                {detectionStatus}
            </Text>
            
            <View className="w-64 h-64 bg-black rounded-xl overflow-hidden relative">
              <CameraView 
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill} 
                  facing="front"
              />
              {isCapturing && (
                  <View className="absolute inset-0 bg-black/50 items-center justify-center">
                      <ActivityIndicator size="large" color="white" />
                  </View>
              )}
            </View>
            <Text className="text-gray-400 text-xs mt-4">Blink to verify liveness and capture.</Text>
          </View>
        );

      case 'qr-scan':
        if (!permission?.granted) return <Text>Requesting camera permission...</Text>;
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg h-[450px]">
            <QrCode color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Scan QR Code</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">Face Verified ✅. Now scan the code.</Text>
            <View className="w-64 h-64 bg-gray-200 rounded-xl overflow-hidden">
              <CameraView
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                style={StyleSheet.absoluteFillObject}
                facing="back"
              />
            </View>
          </View>
        );

      case 'submitting':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <ActivityIndicator size="large" color="#3498DB" />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Verifying...</Text>
            <Text className="text-gray-600 text-center mt-2">Checking Face Match & Token.</Text>
          </View>
        );

      case 'success':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <CheckCircle color="#2ECC71" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Attendance Marked!</Text>
            <Text className="text-gray-600 text-center mt-2">Redirecting to home...</Text>
          </View>
        );
      
      case 'failure':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <XCircle color="#E74C3C" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Submission Failed</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">{failureMessage}</Text>
            <View className="flex-row w-full mt-4">
              <TouchableOpacity className="bg-gray-200 rounded-full py-3 px-4 flex-1 mr-2 items-center" onPress={() => router.replace('/home')}>
                <Text className="text-gray-700 font-bold">Back to Home</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-[#3498DB] rounded-full py-3 px-4 flex-1 ml-2 items-center" onPress={() => { setScanned(false); setAuthStep('qr-scan'); }}>
                <Text className="text-white font-bold">Try QR Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="bg-[#2C3E50] p-4 pt-12 rounded-b-3xl">
        <View className="flex-row items-center">
          <TouchableOpacity className="p-2" onPress={() => router.back()}><ArrowLeft color="white" size={24} /></TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1 text-center">Mark Attendance</Text>
          <View className="w-10" />
        </View>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        {renderContent()}
      </View>
    </View>
  );
}
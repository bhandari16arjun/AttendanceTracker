// app/face-auth-qr.tsx (Final Corrected Version)

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
// MODIFIED: Added 'Camera as CameraIcon' to the lucide-react-native import
import { Camera as CameraIcon, UserCheck, QrCode, CheckCircle, XCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
// This import is also correct
import { Camera, CameraView } from 'expo-camera'; 
import { api } from '@/services/api';

type AuthStep = 'face-auth' | 'qr-scan' | 'submitting' | 'success' | 'failure';

export default function FaceAuthQRScreen() {
  const router = useRouter();
  const [authStep, setAuthStep] = useState<AuthStep>('face-auth');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  useEffect(() => {
    const getCameraPermissions = async () => {
      // This call is correct
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const handleFaceAuth = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setAuthStep('qr-scan');
    }, 1500);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setAuthStep('submitting');
    
    try {
      const response = await api.markAttendance({ attendanceToken: data });
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
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <UserCheck color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Face Authentication</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">Please position your face in the frame for authentication.</Text>
            <View className="w-64 h-64 bg-gray-200 rounded-xl items-center justify-center mb-6">
              {/* MODIFIED: Use the aliased 'CameraIcon' component */}
              <CameraIcon color="#2C3E50" size={48} />
              <Text className="text-[#2C3E50] mt-2">Camera View (Mock)</Text>
            </View>
            <TouchableOpacity className="bg-[#3498DB] rounded-full py-3 px-8 flex-row items-center" onPress={handleFaceAuth} disabled={isAuthenticating}>
              {isAuthenticating ? <ActivityIndicator color="white" /> : <><UserCheck color="white" size={20} /><Text className="text-white font-bold ml-2">Authenticate Face</Text></>}
            </TouchableOpacity>
          </View>
        );

      case 'qr-scan':
        if (hasPermission === null) return <Text>Requesting for camera permission...</Text>;
        if (hasPermission === false) return <Text>No access to camera. Please enable it in settings.</Text>;
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <QrCode color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Scan QR Code</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">Position the instructor's QR code in the frame.</Text>
            <View className="w-64 h-64 bg-gray-200 rounded-xl overflow-hidden">
              <CameraView
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          </View>
        );

      case 'submitting':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <ActivityIndicator size="large" color="#3498DB" />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Submitting...</Text>
            <Text className="text-gray-600 text-center mt-2">Marking your attendance.</Text>
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
                <Text className="text-white font-bold">Try Again</Text>
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
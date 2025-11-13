// app/face-auth-qr.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { QrCode, CheckCircle, XCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import { api } from '@/services/api';
import { useNetInfo } from '@react-native-community/netinfo';
import { addToQueue } from '@/services/offlineQueueService';

type AuthStep = 'face-auth' | 'qr-scan' | 'submitting' | 'success' | 'failure';

export default function FaceAuthQRScreen() {
  const router = useRouter();
  const netInfo = useNetInfo();
  const [authStep, setAuthStep] = useState<AuthStep>('face-auth');
  const [scanned, setScanned] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Mock face auth step
  useEffect(() => {
    if (authStep === 'face-auth') {
      setTimeout(() => {
        setAuthStep('qr-scan');
      }, 1000); // Auto-skip after 1 second
    }
  }, [authStep]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setAuthStep('submitting');
    
    const isConnected = netInfo.isConnected;
    console.log(`Scanning. Is connected: ${isConnected}`);

    // OFFLINE-FIRST LOGIC
    if (isConnected) {
      // ONLINE: Submit directly to the server
      try {
        const response = await api.markAttendance({ attendanceToken: data });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to mark attendance.');
        }
        setSuccessMessage('Attendance Marked Successfully!');
        setAuthStep('success');
      } catch (error: any) {
        setFailureMessage(error.message);
        setAuthStep('failure');
      }
    } else {
      // OFFLINE: Add to local queue
      try {
        await addToQueue(data);
        setSuccessMessage('Attendance saved offline. It will sync when you are back online.');
        setAuthStep('success');
      } catch (error: any) {
        setFailureMessage("Failed to save attendance locally.");
        setAuthStep('failure');
      }
    }
    // Redirect after a delay to allow user to see the message
    setTimeout(() => router.replace('/home'), 2500);
  };
  
  const renderContent = () => {
    switch (authStep) {
      case 'face-auth':
        return (
          <View className="items-center">
            <ActivityIndicator size="large" color="#3498DB" />
            <Text className="mt-4 text-gray-500">Verifying (Mock)...</Text>
          </View>
        );

      case 'qr-scan':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            {netInfo.isConnected === false && <Text className="mb-4 font-bold text-orange-500">OFFLINE MODE</Text>}
            <QrCode color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Scan QR Code</Text>
            <View className="w-64 h-64 bg-gray-200 rounded-xl overflow-hidden mt-6">
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
          <View className="items-center">
            <ActivityIndicator size="large" color="#3498DB" />
            <Text className="mt-4 text-gray-500">Submitting...</Text>
          </View>
        );

      case 'success':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <CheckCircle color="#2ECC71" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Success!</Text>
            <Text className="text-gray-600 text-center mt-2">{successMessage}</Text>
          </View>
        );
      
      case 'failure':
        return (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <XCircle color="#E74C3C" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Failed</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">{failureMessage}</Text>
            <TouchableOpacity className="bg-gray-200 rounded-full py-3 px-8 items-center" onPress={() => router.replace('/home')}>
              <Text className="text-gray-700 font-bold">Back to Home</Text>
            </TouchableOpacity>
          </View>
        );
    }
    return null;
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
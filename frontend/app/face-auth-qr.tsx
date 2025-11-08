import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { Camera, UserCheck, QrCode, CheckCircle, XCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const FaceAuthQRScreen = () => {
  const [authStep, setAuthStep] = useState<'face-auth' | 'qr-scan' | 'success' | 'failure'>('face-auth');
  const [previousStep, setPreviousStep] = useState<'face-auth' | 'qr-scan' | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const router = useRouter();

  // Mock face authentication
  const handleFaceAuth = () => {
    setIsAuthenticating(true);
    setPreviousStep('face-auth');
    
    setTimeout(() => {
      setIsAuthenticating(false);
      const isSuccess = Math.random() > 0.2;
      
      if (isSuccess) {
        setAuthStep('qr-scan');
      } else {
        setAuthStep('failure');
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      }
    }, 2000);
  };

  // Mock QR scanning
  const handleScanQR = () => {
    setIsScanning(true);
    setPreviousStep('qr-scan');
    
    setTimeout(() => {
      setIsScanning(false);
      const isSuccess = Math.random() > 0.2;
      
      if (isSuccess) {
        setAuthStep('success');
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      } else {
        setAuthStep('failure');
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      }
    }, 1500);
  };

  const handleRetry = () => {
    setAuthStep(previousStep || 'face-auth');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-[#2C3E50] p-4 rounded-b-3xl">
        <View className="flex-row items-center">
          <TouchableOpacity 
            className="p-2"
            onPress={handleGoBack}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1 text-center">
            {authStep === 'face-auth' ? 'Face Authentication' : 
             authStep === 'qr-scan' ? 'Scan QR Code' : 
             authStep === 'success' ? 'Success' : 'Authentication Failed'}
          </Text>
          <View className="w-10" />
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        {authStep === 'face-auth' && (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <UserCheck color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Face Authentication</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">
              Please position your face in the frame for authentication
            </Text>
            
            <View className="w-64 h-64 bg-gray-200 rounded-xl items-center justify-center mb-6">
              <Camera color="#2C3E50" size={48} />
              <Text className="text-[#2C3E50] mt-2">Camera View</Text>
            </View>
            
            <TouchableOpacity 
              className="bg-[#3498DB] rounded-full py-3 px-8 flex-row items-center"
              onPress={handleFaceAuth}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <UserCheck color="white" size={20} />
                  <Text className="text-white font-bold ml-2">Authenticate Face</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {authStep === 'qr-scan' && (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <QrCode color="#3498DB" size={64} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Scan QR Code</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">
              Position the QR code in the frame to mark attendance
            </Text>
            
            <View className="w-64 h-64 bg-gray-200 rounded-xl items-center justify-center mb-6">
              <View className="border-4 border-dashed border-[#3498DB] w-48 h-48 rounded-lg items-center justify-center">
                <QrCode color="#3498DB" size={32} />
              </View>
            </View>
            
            <TouchableOpacity 
              className="bg-[#2ECC71] rounded-full py-3 px-8 flex-row items-center"
              onPress={handleScanQR}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <QrCode color="white" size={20} />
                  <Text className="text-white font-bold ml-2">Scan QR Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {authStep === 'success' && (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <CheckCircle color="#2ECC71" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Attendance Submitted</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">
              Your attendance has been successfully recorded and is pending confirmation.
            </Text>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text className="text-gray-500 mt-4">Returning to home...</Text>
          </View>
        )}

        {authStep === 'failure' && (
          <View className="w-full bg-white rounded-2xl p-6 items-center shadow-lg">
            <XCircle color="#E74C3C" size={80} />
            <Text className="text-[#2C3E50] text-2xl font-bold mt-4">Authentication Failed</Text>
            <Text className="text-gray-600 text-center mt-2 mb-6">
              {previousStep === 'face-auth' && 'Face recognition did not match.'}
              {previousStep === 'qr-scan' && 'QR code scan failed.'}
              Please try again or contact support.
            </Text>
            
            <View className="flex-row w-full mt-4">
              <TouchableOpacity 
                className="bg-gray-200 rounded-full py-3 px-4 flex-1 mr-2 items-center"
                onPress={handleGoBack}
              >
                <Text className="text-gray-700 font-bold">Back to Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="bg-[#3498DB] rounded-full py-3 px-4 flex-1 ml-2 items-center"
                onPress={handleRetry}
              >
                <Text className="text-white font-bold">Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View className="bg-white mx-4 mb-6 rounded-xl p-4 shadow-sm">
        <Text className="text-[#2C3E50] font-bold mb-2">Process:</Text>
        <Text className="text-gray-600 text-sm">
          1. Authenticate your face to verify identity{'\n'}
          2. Scan the QR code provided by your instructor{'\n'}
          3. Attendance will be recorded and pending confirmation
        </Text>
      </View>
    </View>
  );
};

export default FaceAuthQRScreen;
// app/qr-scanner.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ChevronLeft, RotateCcw, QrCode } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg'; // Import the new library
import { api } from '@/services/api';

const QR_REFRESH_INTERVAL = 30; // seconds

export default function QRScannerScreen() {
  const router = useRouter();
  const { classId, className } = useLocalSearchParams<{ classId: string; className: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [attendanceToken, setAttendanceToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QR_REFRESH_INTERVAL);

  const generateNewToken = async () => {
    if (!classId) return;
    setIsLoading(true);
    setAttendanceToken(null);
    try {
      const response = await api.createAttendanceSession(classId);
      if (!response.ok) {
        throw new Error("Failed to create attendance session");
      }
      const data = await response.json();
      setAttendanceToken(data.attendanceToken);
      setTimeLeft(QR_REFRESH_INTERVAL);
    } catch (error: any) {
      Alert.alert("Error", error.message, [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate token on initial load
  useEffect(() => {
    generateNewToken();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!attendanceToken) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateNewToken(); // Auto-refresh the token
          return QR_REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attendanceToken]);


  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-[#2C3E50] p-4 pt-12 rounded-b-3xl">
        <View className="flex-row items-center">
          <TouchableOpacity className="p-2" onPress={() => router.back()}>
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1 text-center">Take Attendance</Text>
          <View className="w-10" />
        </View>
        <View className="mt-4 mb-2">
          <Text className="text-white text-center text-lg">Scan this QR code for attendance</Text>
          <Text className="text-white/80 text-center mt-1">Code refreshes in {timeLeft}s</Text>
        </View>
      </View>

      {/* QR Code Section */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-white rounded-2xl p-6 shadow-lg w-full items-center">
          <View className="w-64 h-64 items-center justify-center mb-6">
            {isLoading || !attendanceToken ? (
              <ActivityIndicator size="large" color="#2C3E50" />
            ) : (
              <QRCode
                value={attendanceToken}
                size={256}
                color="#2C3E50"
                backgroundColor="white"
              />
            )}
          </View>
          
          <Text className="text-[#2C3E50] font-bold text-lg mb-2">{className}</Text>
          
          <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
            <Text className="text-[#2C3E50] font-medium">Refresh in: </Text>
            <Text className="text-[#3498DB] font-bold text-lg">{timeLeft}s</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          className="flex-row items-center bg-[#3498DB] rounded-full px-6 py-3 mt-8"
          onPress={generateNewToken}
          disabled={isLoading}
        >
          <RotateCcw color="white" size={20} />
          <Text className="text-white font-bold ml-2">Refresh QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
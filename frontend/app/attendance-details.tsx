// app/attendance-details.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, CheckCircle2, XCircle, CalendarDays } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { useAuth } from '@/app/context/AuthContext';

cssInterop(LinearGradient, {
  className: 'style',
});

// Helper to format date string
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function AttendanceDetailsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ classId: string; className: string; classCode: string; instructorId: string; }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState<{ attended: string[], total: string[] }>({ attended: [], total: [] });

  const fetchDetails = useCallback(async () => {
    if (!params.classId || !userId) return;

    setIsLoading(true);
    try {
      const response = await api.getStudentClassAttendanceDetails(params.classId, userId);
      if (!response.ok) {
        throw new Error("Failed to fetch attendance details");
      }
      const data = await response.json();
      // Sort dates, newest first
      const sortedAttended = data.attendedLectureDates?.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()) || [];
      const sortedTotal = data.totalLectureDates?.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()) || [];
      
      setDetails({ attended: sortedAttended, total: sortedTotal });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  }, [params.classId, userId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Create a set of attended dates for quick lookup
  const attendedDateSet = new Set(details.attended);

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{params.className}</Text>
          </View>
        </View>
        <Text className="text-white/80 text-sm">Code: {params.classCode}</Text>
        <Text className="text-white/80 text-sm" numberOfLines={1}>Instructor ID: {params.instructorId}</Text>
      </LinearGradient>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#3498DB" className="mt-8" />
      ) : (
        <ScrollView className="flex-1 p-4">
          <View className="bg-white rounded-2xl p-4 mb-6 shadow">
            <Text className="text-lg font-bold text-[#2C3E50] text-center">Attendance Summary</Text>
            <View className="flex-row justify-center items-baseline mt-2">
              <Text className="text-4xl font-bold text-[#3498DB]">{details.attended.length}</Text>
              <Text className="text-xl font-semibold text-gray-500"> / {details.total.length}</Text>
            </View>
            <Text className="text-sm text-gray-500 text-center">lectures attended</Text>
          </View>

          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-[#2C3E50]">Lecture History</Text>
          </View>
          
          {details.total.length === 0 ? (
             <View className="bg-white rounded-2xl p-6 items-center justify-center mt-2">
                <CalendarDays size={48} color="#BDC3C7" />
                <Text className="text-gray-500 mt-4 text-center font-bold text-lg">No Lectures Yet</Text>
                <Text className="text-gray-400 text-sm mt-2 text-center">Lectures for this class will appear here once they are created.</Text>
            </View>
          ) : (
            <View className="flex-col gap-3">
              {details.total.map((dateString) => {
                const isAttended = attendedDateSet.has(dateString);
                return (
                  <View key={dateString} className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
                    {isAttended ? (
                      <CheckCircle2 size={24} color="#2ECC71" />
                    ) : (
                      <XCircle size={24} color="#E74C3C" />
                    )}
                    <View className="ml-4 flex-1">
                      <Text className={`font-semibold ${isAttended ? 'text-gray-800' : 'text-gray-500'}`}>
                        {formatDate(dateString)}
                      </Text>
                      <Text className={`text-sm ${isAttended ? 'text-green-600' : 'text-red-600'}`}>
                        {isAttended ? 'Attended' : 'Missed'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

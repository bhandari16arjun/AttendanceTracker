// app/activities.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { ArrowLeft, Calendar, Clock, BookOpen, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { AttendanceHistoryRecord } from '@/types';

cssInterop(LinearGradient, {
  className: 'style',
});

// Function to format date and time nicely
const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date: formattedDate, time: formattedTime };
};


export default function ActivitiesScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      if (!isRefreshing) setIsLoading(true);
      const response = await api.getMyAttendanceHistory();
      if (!response.ok) {
        throw new Error("Failed to fetch attendance history");
      }
      const data = await response.json();
      setAttendanceHistory(data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Attendance History</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498DB" />
        ) : attendanceHistory.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center mt-6">
            <BookOpen size={48} color="#BDC3C7" />
            <Text className="text-gray-500 mt-2 text-center">No attendance records found</Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              Your attendance history will appear here after you scan a QR code.
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-4">
            <Text className="text-lg font-bold text-[#2C3E50]">
              Recent Activity ({attendanceHistory.length} records)
            </Text>
            
            {attendanceHistory.map((activity) => {
              const { date, time } = formatTimestamp(activity.timestamp);
              return (
                <View 
                  key={activity.id} 
                  className="bg-white rounded-2xl overflow-hidden shadow"
                >
                  <Image 
                    source={{ uri: `https://source.unsplash.com/random/400x200?classroom,study,${activity.classroomInfo.subjectCode}` }} 
                    className="w-full h-32"
                  />
                  
                  <View className="p-4">
                    <View className="mb-3">
                      <Text className="font-bold text-[#2C3E50] text-lg">{activity.classroomInfo.subjectName}</Text>
                      <Text className="text-gray-500">ID: {activity.classroomInfo.subjectCode}</Text>
                    </View>
                    
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center">
                        <CheckCircle size={18} color="#2ECC71" className="mr-2" />
                        <Text className="text-green-500 font-bold">Attendance Marked</Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center">
                          <Calendar size={14} color="#7F8C8D" className="mr-1" />
                          <Text className="text-gray-600">{date}</Text>
                        </View>
                        <View className="flex-row items-center mt-1">
                          <Clock size={14} color="#7F8C8D" className="mr-1" />
                          <Text className="text-gray-600">{time}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
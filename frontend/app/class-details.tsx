// app/class-details.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { ChevronLeft, User, BarChart2, QrCode } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/services/api';
import { AttendanceSummary, Classroom } from '@/types';
import { useAuth } from '@/app/context/AuthContext'; // Import useAuth

export default function ClassDetailsScreen() {
  const router = useRouter();
  const { classId, className } = useLocalSearchParams<{ classId: string; className: string }>();
  const { userId } = useAuth(); // Get the logged-in user's ID

  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<AttendanceSummary[]>([]);
  const [classData, setClassData] = useState<Classroom | null>(null);

  // Fetch the full details of this specific class to get the instructorId
  const fetchClassData = useCallback(async () => {
    if (!classId) return;
    try {
      const response = await api.getMyClasses();
      if (!response.ok) return;
      const allClasses: Classroom[] = await response.json();
      const currentClass = allClasses.find(c => c.id === classId);
      if (currentClass) {
        setClassData(currentClass);
      }
    } catch (e) {
      console.error("Failed to fetch class details for auth check:", e);
    }
  }, [classId]);

  // Fetch the attendance summary for the class
  const fetchClassAttendance = useCallback(async () => {
    if (!classId) return;
    try {
      const response = await api.getClassAttendance(classId);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch attendance data");
      }
      const data = await response.json();
      setStudents(data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }, [classId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchClassData(), fetchClassAttendance()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchClassData, fetchClassAttendance]);

  const handleTakeAttendance = () => {
    if (!classId) return;
    router.push({
      pathname: '/qr-scanner',
      params: { classId, className },
    });
  };

  const isInstructor = classData?.instructorId === userId;

  return (
    <View className="flex-1 bg-gray-100">
      <View className="bg-[#2C3E50] p-4 pt-12 rounded-b-3xl">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity className="p-2" onPress={() => router.back()}>
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold flex-1 text-center">Class Details</Text>
          <View className="w-10" />
        </View>
        <View className="bg-white/20 rounded-2xl p-4 mb-4">
          <Text className="text-white text-2xl font-bold">{className}</Text>
          <View className="flex-row mt-3">
            <View className="flex-row items-center">
              <User color="white" size={16} />
              <Text className="text-white ml-2">{students.length} Students</Text>
            </View>
          </View>
        </View>
      </View>

      {/* MODIFIED: Conditionally render the button based on isInstructor check */}
      {isInstructor && (
        <View className="mx-4 -mt-6 z-10">
          <TouchableOpacity 
            className="bg-[#3498DB] rounded-xl p-4 flex-row items-center justify-center shadow-lg"
            onPress={handleTakeAttendance}
          >
            <QrCode color="white" size={20} />
            <Text className="text-white text-lg font-bold ml-2">Take Attendance</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView className="flex-1 mt-4 px-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-[#2C3E50] text-lg font-bold">Student List</Text>
          <Text className="text-[#3498DB] font-medium">{students.length} Students</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498DB" />
        ) : students.length === 0 ? (
          <View className="bg-white rounded-xl p-4 items-center">
            <Text className="text-gray-500">No students have attended this class yet.</Text>
          </View>
        ) : (
          students.map((student) => (
            <View key={student.userId} className="bg-white rounded-xl p-4 mb-4 flex-row items-center shadow-sm">
              <Image 
                source={{ uri: `https://avatar.vercel.sh/${student.email}.png` }} 
                className="w-14 h-14 rounded-full" 
              />
              <View className="ml-4 flex-1">
                <Text className="text-[#2C3E50] font-bold text-base">{student.name}</Text>
                <Text className="text-gray-500 text-sm">{student.email}</Text>
                <View className="flex-row items-center mt-2">
                  <BarChart2 color="#3498DB" size={14} />
                  <Text className="text-[#3498DB] text-sm ml-1">Attended {student.attendedCount} classes</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
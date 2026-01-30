// app/lecture-details.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, CheckCircle2, XCircle, QrCode } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { Classroom, Lecture, User } from '@/types';

cssInterop(LinearGradient, {
  className: 'style',
});

const formatDate = (dateString: string) => {
  if (!dateString) return 'No Date';
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type StudentWithStatus = {
  id: string;
  name: string;
  email: string;
  status: 'Present' | 'Absent';
}

export default function LectureDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId: string; lectureId: string; }>();

  const [isLoading, setIsLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [students, setStudents] = useState<StudentWithStatus[]>([]);


  const fetchData = useCallback(async () => {
    if (!params.classId || !params.lectureId) return;

    try {
      setIsLoading(true);
      // Fetch classroom and lecture details in parallel
      const [classRes, lectureRes] = await Promise.all([
        api.getClassroomDetails(params.classId),
        api.getLectureDetails(params.lectureId),
      ]);

      if (!classRes.ok) throw new Error('Failed to fetch classroom details');
      const classData: Classroom = await classRes.json();
      setClassroom(classData);

      if (!lectureRes.ok) throw new Error('Failed to fetch lecture details');
      const lectureData: Lecture = await lectureRes.json();
      setLecture(lectureData);

      // Now fetch student names
      if (classData.enrolledStudents) {
        const studentIds = Object.keys(classData.enrolledStudents);
        if (studentIds.length > 0) {
            const usersRes = await api.getUsersDetails(studentIds);
            if (!usersRes.ok) throw new Error('Failed to fetch student details');
            const usersData: User[] = await usersRes.json();

            const attendedSet = new Set(lectureData.attendedBy || []);
            const studentList: StudentWithStatus[] = usersData.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                status: attendedSet.has(user.id) ? 'Present' : 'Absent',
            }));
            setStudents(studentList);
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  }, [params.classId, params.lectureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateQR = () => {
    if (!params.lectureId || !classroom?.name) return;
    // Simply navigate to the QR scanner page, passing the necessary IDs.
    // The scanner page will be responsible for generating the token.
    router.push({ 
        pathname: '/qr-scanner', 
        params: { lectureId: params.lectureId, className: classroom.name } 
    });
  }

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient colors={['#3498DB', '#2C3E50']} className="p-6 pt-12 pb-6">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
              Lecture Details
            </Text>
            <Text className="text-white/80">{formatDate(lecture?.date || '')}</Text>
          </View>
        </View>
      </LinearGradient>

      <View className="p-4">
        <TouchableOpacity 
            className="bg-orange-500 rounded-lg p-4 flex-row justify-center items-center shadow mb-4"
            onPress={handleGenerateQR}
        >
            <QrCode size={20} color="white" />
            <Text className="text-white font-bold ml-2">Generate QR Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text className="text-lg font-bold text-[#2C3E50] mb-4">
          Student Roster ({students.length})
        </Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498DB" />
        ) : students.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center">
            <Text className="text-gray-500 text-center">No students enrolled in this class.</Text>
          </View>
        ) : (
          <View className="flex-col gap-3">
            {students.map((student) => (
              <View key={student.id} className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
                {student.status === 'Present' ? (
                  <CheckCircle2 size={24} color="#2ECC71" />
                ) : (
                  <XCircle size={24} color="#E74C3C" />
                )}
                <View className="ml-4 flex-1">
                  <Text className="font-semibold text-gray-800">{student.name}</Text>
                  <Text className="text-sm text-gray-500">{student.email}</Text>
                </View>
                <Text className={`font-bold ${student.status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>
                  {student.status}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
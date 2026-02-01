// app/lecture-details.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, CheckCircle2, XCircle, QrCode, Bluetooth, BluetoothOff, UserCheck, Radio } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { Classroom, Lecture, User } from '@/types';
import { useBle } from '@/app/context/BleContext';
import { useAuth } from '@/app/context/AuthContext';

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
  const { startScanning, stopScanning, isScanning, devices, startAdvertising, stopAdvertising } = useBle();
  const { userId } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [students, setStudents] = useState<StudentWithStatus[]>([]);

  // Filter detected students from BLE devices
  const detectedStudents = useMemo(() => {
    const detectedIds = new Set(devices.map(d => d.name)); // device.name === user.id
    return students.filter(s => detectedIds.has(s.id));
  }, [devices, students]);

  const fetchData = useCallback(async () => {
    if (!params.classId || !params.lectureId) return;

    try {
      setIsLoading(true);
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

  // Handle BLE Scanning Logic for Instructor
  useEffect(() => {
    const initScanner = async () => {
        if (classroom?.instructorId === userId) {
            // I am the instructor
            console.log("Switching to scanning mode...");
            await stopAdvertising(); // Stop broadcasting my own ID
            setTimeout(() => {
                 startScanning(); // Start scanning for students
            }, 500);
        }
    };
    
    if (classroom && userId) {
        initScanner();
    }

    return () => {
        // Cleanup: Stop scanning and resume broadcasting
        if (classroom?.instructorId === userId) {
             console.log("Stopping scan, resuming broadcast...");
             stopScanning();
             if (userId) startAdvertising(userId); 
        }
    };
  }, [classroom, userId]);

  // Periodically Sync Detected Students with Server (Every 5s)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (classroom?.instructorId === userId && isScanning && devices.length > 0 && params.lectureId) {
        interval = setInterval(async () => {
             const detectedIds = devices.map(d => d.name).filter(Boolean) as string[];
             if (detectedIds.length > 0) {
                 try {
                     await api.syncDetectedUsers(params.lectureId, detectedIds);
                     console.log("Synced detected students:", detectedIds.length);
                 } catch (e) {
                     console.error("Sync failed", e);
                 }
             }
        }, 5000);
    }
    return () => clearInterval(interval);
  }, [classroom, userId, isScanning, devices, params.lectureId]);

  const handleGenerateQR = () => {
    if (!params.lectureId || !classroom?.name) return;
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

      <View className="p-4 space-y-3">
        {/* QR Code Button */}
        <TouchableOpacity 
            className="bg-orange-500 rounded-lg p-4 flex-row justify-center items-center shadow"
            onPress={handleGenerateQR}
        >
            <QrCode size={20} color="white" />
            <Text className="text-white font-bold ml-2">Generate QR Code</Text>
        </TouchableOpacity>

        {/* Scan Status Indicator (Only for Instructor) */}
        {classroom?.instructorId === userId && (
            <View className="bg-blue-100 rounded-lg p-3 flex-row items-center justify-center border border-blue-200">
                {isScanning ? (
                    <>
                        <ActivityIndicator color="#3498DB" size="small" />
                        <Text className="text-[#3498DB] font-bold ml-2">Scanning for students...</Text>
                    </>
                ) : (
                    <Text className="text-gray-500">Scanner inactive</Text>
                )}
            </View>
        )}
      </View>

      <ScrollView className="flex-1 px-4">
        
        {/* DEBUG SECTION - REMOVE LATER */}
        <View className="bg-yellow-100 p-2 rounded mb-4 border border-yellow-300">
            <Text className="font-bold text-xs text-yellow-800 uppercase">Debug Info</Text>
            <Text className="text-xs">Roster Size: {students.length}</Text>
            <Text className="text-xs">Raw BLE Devices Found: {devices.length}</Text>
            <View className="mt-1">
                {devices.map(d => (
                    <Text key={d.id} className="text-[10px] font-mono text-gray-600">
                        ID: {d.id} | Name: {d.name || 'N/A'}
                    </Text>
                ))}
            </View>
        </View>

        {/* Detected Students Section */}
        {detectedStudents.length > 0 && (
          <View className="mb-6">
             <Text className="text-lg font-bold text-[#2C3E50] mb-2 flex-row items-center">
               <UserCheck size={20} color="#2C3E50" /> Detected Nearby ({detectedStudents.length})
             </Text>
             <View className="bg-blue-50 rounded-xl p-2 border border-blue-200">
               {detectedStudents.map(student => (
                 <View key={student.id} className="flex-row items-center p-2">
                    <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    <Text className="text-blue-900 font-medium">{student.name}</Text>
                 </View>
               ))}
             </View>
          </View>
        )}

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
                  
                  {/* Visual indicator if they are detected nearby */}
                  {detectedStudents.find(ds => ds.id === student.id) && (
                     <View className="bg-green-100 self-start px-2 py-0.5 rounded mt-1">
                        <Text className="text-green-700 text-xs font-bold">Nearby via BLE</Text>
                     </View>
                  )}
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
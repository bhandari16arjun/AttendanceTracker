import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { ChevronLeft, User, Calendar, BarChart2, QrCode } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router'; // Import useRouter and useLocalSearchParams

const ClassDetailsScreen = () => {
  const [students] = useState([
    {
      id: '1',
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dXNlcnxlbnwwfHwwfHx8MA%3D%3D',
      attendancePercentage: 92,
      classesAttended: 18,
      totalClasses: 20,
    },
    {
      id: '2',
      name: 'Maria Garcia',
      email: 'maria.garcia@example.com',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTF8fHVzZXJ8ZW58MHx8MHx8fDA%3D',
      attendancePercentage: 85,
      classesAttended: 17,
      totalClasses: 20,
    },
    {
      id: '3',
      name: 'James Wilson',
      email: 'james.wilson@example.com',
      avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mjh8fHVzZXJ8ZW58MHx8MHx8fDA%3D',
      attendancePercentage: 95,
      classesAttended: 19,
      totalClasses: 20,
    },
    {
      id: '4',
      name: 'Sarah Miller',
      email: 'sarah.miller@example.com',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzJ8fHVzZXJ8ZW58MHx8MHx8fDA%3D',
      attendancePercentage: 78,
      classesAttended: 16,
      totalClasses: 20,
    },
    {
      id: '5',
      name: 'Robert Davis',
      email: 'robert.davis@example.com',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTd8fHVzZXJ8ZW58MHx8MHx8fDA%3D',
      attendancePercentage: 88,
      classesAttended: 18,
      totalClasses: 20,
    },
  ]);

  const router = useRouter();
//   const { classData } = useLocalSearchParams(); // Get class data from params

  const handleTakeAttendance = () => {
    router.push('/qr-scanner'); // Navigate to QRScannerScreen
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-[#2C3E50] p-4 rounded-b-3xl">
        <View className="flex-row items-center mb-4">
<TouchableOpacity className="p-2" onPress={() => router.back()}>
<ChevronLeft color="white" size={24} />
</TouchableOpacity>
<Text className="text-white text-xl font-bold flex-1 text-center">Class Details</Text>
<View className="w-10" />
</View>
        <View className="bg-white/20 rounded-2xl p-4 mb-4">
          <Text className="text-white text-2xl font-bold">Mathematics 101</Text>
          <Text className="text-white/90 text-base mt-1">Advanced Calculus</Text>
          
          <View className="flex-row mt-3">
            <View className="flex-row items-center mr-4">
              <Calendar color="white" size={16} />
              <Text className="text-white ml-1">Mon, Wed, Fri</Text>
            </View>
            <View className="flex-row items-center">
              <User color="white" size={16} />
              <Text className="text-white ml-1">25 Students</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Take Attendance Button */}
      <View className="mx-4 -mt-6 z-10">
        <TouchableOpacity 
          className="bg-[#3498DB] rounded-xl p-4 flex-row items-center justify-center shadow-lg"
          onPress={handleTakeAttendance}
        >
          <QrCode color="white" size={20} />
          <Text className="text-white text-lg font-bold ml-2">Take Attendance</Text>
        </TouchableOpacity>
      </View>

      {/* Students List */}
      <ScrollView className="flex-1 mt-4 px-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-[#2C3E50] text-lg font-bold">Student List</Text>
          <Text className="text-[#3498DB] font-medium">{students.length} Students</Text>
        </View>

        {students.map((student) => (
          <View 
            key={student.id} 
            className="bg-white rounded-xl p-4 mb-4 flex-row items-center shadow-sm"
          >
            <Image 
              source={{ uri: student.avatar }} 
              className="w-14 h-14 rounded-full" 
            />
            
            <View className="ml-4 flex-1">
              <Text className="text-[#2C3E50] font-bold text-base">{student.name}</Text>
              <Text className="text-gray-500 text-sm">{student.email}</Text>
              
              <View className="flex-row mt-2">
                <View className="flex-row items-center mr-4">
                  <BarChart2 color="#3498DB" size={14} />
                  <Text className="text-[#3498DB] text-sm ml-1">{student.attendancePercentage}%</Text>
                </View>
                <Text className="text-gray-500 text-sm">
                  {student.classesAttended}/{student.totalClasses} classes
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default ClassDetailsScreen;
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Users, BookOpen, Calendar, User, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router'; // Import useRouter instead of relying on navigation prop

// Setup LinearGradient for NativeWind
cssInterop(LinearGradient, {
  className: 'style',
});

// Mock data for instructor's created classes
const mockInstructorClasses = [
  {
    id: '1',
    name: 'Mathematics 101',
    code: 'MATH101',
    studentCount: 24,
    attendanceRecords: [
      { id: '1', name: 'John Smith', email: 'john.smith@email.com', attendance: '12/15', percentage: 80 },
      { id: '2', name: 'Emily Johnson', email: 'emily.j@email.com', attendance: '14/15', percentage: 93 },
      { id: '3', name: 'Michael Brown', email: 'm.brown@email.com', attendance: '10/15', percentage: 67 },
      { id: '4', name: 'Sarah Davis', email: 's.davis@email.com', attendance: '15/15', percentage: 100 },
      { id: '5', name: 'Robert Wilson', email: 'r.wilson@email.com', attendance: '11/15', percentage: 73 },
    ]
  },
  {
    id: '2',
    name: 'Physics 201',
    code: 'PHYS201',
    studentCount: 18,
    attendanceRecords: [
      { id: '1', name: 'Alice Cooper', email: 'alice.c@email.com', attendance: '13/15', percentage: 87 },
      { id: '2', name: 'Bob Marley', email: 'bob.m@email.com', attendance: '12/15', percentage: 80 },
      { id: '3', name: 'Charlie Brown', email: 'charlie.b@email.com', attendance: '14/15', percentage: 93 },
    ]
  },
  {
    id: '3',
    name: 'Chemistry 301',
    code: 'CHEM301',
    studentCount: 22,
    attendanceRecords: [
      { id: '1', name: 'David Lee', email: 'david.l@email.com', attendance: '11/15', percentage: 73 },
      { id: '2', name: 'Emma Watson', email: 'emma.w@email.com', attendance: '15/15', percentage: 100 },
    ]
  }
];

export default function InstructorClassesScreen() { // Removed { navigation } prop
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const router = useRouter(); // Use useRouter for navigation

  const handleClassPress = (classItem: any) => {
    // Navigate to ClassDetailsScreen with class data as params
    router.push({
      pathname: '/class-details',
      params: { classData: JSON.stringify(classItem) }
    });
  };

  const handleBackPress = () => {
    if (selectedClass) {
      setSelectedClass(null);
    } else {
      router.back(); // Changed from navigation.goBack() to router.back()
    }
  };

  if (selectedClass) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Header */}
        <LinearGradient 
          colors={['#3498DB', '#2C3E50']} 
          className="p-6 pt-12 pb-6"
        >
          <View className="flex-row items-center">
            <TouchableOpacity onPress={handleBackPress} className="mr-4">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-bold">{selectedClass.name}</Text>
              <Text className="text-white/80">{selectedClass.code} • {selectedClass.studentCount} students</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView className="flex-1 p-4">
          <View className="mb-6">
            <Text className="text-lg font-bold text-[#2C3E50] mb-4">Student Attendance</Text>
            
            {selectedClass.attendanceRecords.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center justify-center">
                <Users size={48} color="#BDC3C7" />
                <Text className="text-gray-500 mt-2 text-center">No students enrolled yet</Text>
              </View>
            ) : (
              <View className="flex-col gap-4">
                {selectedClass.attendanceRecords.map((student: any, index: number) => (
                  <View 
                    key={student.id} 
                    className="bg-white rounded-2xl p-4 flex-row items-center shadow"
                  >
                    <View className="w-10 h-10 rounded-full bg-[#3498DB] items-center justify-center mr-3">
                      <Text className="text-white font-bold">
                       {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-[#2C3E50]">{student.name}</Text>
                      <Text className="text-gray-500 text-sm">{student.email}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-bold text-[#2C3E50]">{student.attendance}</Text>
                      <Text className={`text-sm font-bold ${
                        student.percentage >= 75 
                          ? 'text-green-500' 
                            : student.percentage >= 50 
                              ? 'text-yellow-500' 
                              : 'text-red-500'
                      }`}>
                        {student.percentage}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleBackPress} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Created Classes</Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 p-4">
        {mockInstructorClasses.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center">
            <BookOpen size={48} color="#BDC3C7" />
            <Text className="text-gray-500 mt-2 text-center">You haven't created any classes yet</Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              Tap "Create Class" on the home screen to get started
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-4">
            <Text className="text-lg font-bold text-[#2C3E50]">
              Classes you've created ({mockInstructorClasses.length})
            </Text>
            
            {mockInstructorClasses.map((classItem) => (
              <TouchableOpacity 
                key={classItem.id} 
                className="bg-white rounded-2xl p-4 shadow"
                onPress={() => handleClassPress(classItem)}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-bold text-[#2C3E50] text-lg">{classItem.name}</Text>
                    <Text className="text-gray-500 text-sm">ID: {classItem.code}</Text>
                    <View className="flex-row justify-between mt-2">
                      <View className="flex-row items-center">
                        <Users size={16} color="#3498DB" />
                        <Text className="text-gray-600 ml-1">{classItem.studentCount} students</Text>
                      </View>
                      <TouchableOpacity 
                        className="bg-[#3498DB] rounded-full px-3 py-1"
                        onPress={() => handleClassPress(classItem)}
                      >
                        <Text className="text-white text-xs font-bold">VIEW</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
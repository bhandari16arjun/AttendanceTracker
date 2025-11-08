import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ArrowLeft, Calendar, Clock, BookOpen, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router'; // Import useRouter

// Setup LinearGradient for NativeWind
cssInterop(LinearGradient, {
  className: 'style',
});

// Mock data for attendance history
const mockAttendanceHistory = [
  {
    id: '1',
    subjectName: 'Mathematics 101',
    subjectCode: 'MATH101',
    date: '2023-10-09',
    time: '09:05 AM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1527822618093-743f3e57977c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Q2xhc3Nyb29tJTIwbGVhcm5pbmclMjBlbnZpcm9ubWVudHxlbnwwfHwwfHx8MA%3D%3D'
  },
  {
    id: '2',
    subjectName: 'Physics 201',
    subjectCode: 'PHYS201',
    date: '2023-10-08',
    time: '02:30 PM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1515073838964-4d4d56a58b21?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8U3R1ZGVudCUyMGxlYXJuZXIlMjBwdXBpbCUyMGVkdWNhdGlvbnxlbnwwfHwwfHx8MA%3D%3D'
  },
  {
    id: '3',
    subjectName: 'Chemistry 301',
    subjectCode: 'CHEM301',
    date: '2023-10-08',
    time: '11:15 AM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGNsYXNzcm9vbXxlbnwwfHwwfHx8MA%3D%3D'
  },
  {
    id: '4',
    subjectName: 'Biology 101',
    subjectCode: 'BIO101',
    date: '2023-10-07',
    time: '10:45 AM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1659070953831-dd4fa16222fb?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fFNjaG9vbCUyMGNsYXNzcm9vbSUyMGxlYXJuaW5nfGVufDB8fDB8fHww'
  },
  {
    id: '5',
    subjectName: 'Mathematics 101',
    subjectCode: 'MATH101',
    date: '2023-10-06',
    time: '09:30 AM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1527822618093-743f3e57977c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Q2xhc3Nyb29tJTIwbGVhcm5pbmclMjBlbnZpcm9ubWVudHxlbnwwfHwwfHx8MA%3D%3D'
  },
  {
    id: '6',
    subjectName: 'Physics 201',
    subjectCode: 'PHYS201',
    date: '2023-10-05',
    time: '02:15 PM',
    status: 'check-in',
    classroomAvatar: 'https://images.unsplash.com/photo-1515073838964-4d4d56a58b21?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8U3R1ZGVudCUyMGxlYXJuZXIlMjBwdXBpbCUyMGVkdWNhdGlvbnxlbnwwfHwwfHx8MA%3D%3D'
  }
];

// Function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Function to format time
const formatTime = (timeString: string) => {
  return timeString;
};

export default function ActivitiesScreen() {
  const [attendanceHistory, setAttendanceHistory] = useState(mockAttendanceHistory);
  const router = useRouter(); // Use useRouter for navigation

  // Sort attendance history by date (most recent first)
  useEffect(() => {
    const sortedHistory = [...mockAttendanceHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setAttendanceHistory(sortedHistory);
  }, []);

  const handleBackPress = () => {
    router.back(); // Use router.back() instead of navigation.goBack()
  };

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
          <Text className="text-white text-xl font-bold">Attendance History</Text>
        </View>
      </LinearGradient>

      <ScrollView className="flex-1 p-4">
        {attendanceHistory.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center mt-6">
            <BookOpen size={48} color="#BDC3C7" />
            <Text className="text-gray-500 mt-2 text-center">No attendance records found</Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              Your attendance history will appear here
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-4">
            <Text className="text-lg font-bold text-[#2C3E50]">
              Recent Activity ({attendanceHistory.length} records)
            </Text>
            
            {attendanceHistory.map((activity) => (
              <View 
                key={activity.id} 
                className="bg-white rounded-2xl overflow-hidden shadow"
              >
                {/* Classroom Image */}
                <Image 
                  source={{ uri: activity.classroomAvatar }} 
                  className="w-full h-32"
                />
                
                <View className="p-4">
                  {/* Subject Info */}
                  <View className="mb-3">
                    <Text className="font-bold text-[#2C3E50] text-lg">{activity.subjectName}</Text>
                    <Text className="text-gray-500">ID: {activity.subjectCode}</Text>
                  </View>
                  
                  {/* Attendance Details */}
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <CheckCircle size={18} color="#2ECC71" className="mr-2" />
                      <Text className="text-green-500 font-bold">Attendance Marked</Text>
                    </View>
                    <View className="items-end">
                      <View className="flex-row items-center">
                        <Calendar size={14} color="#7F8C8D" className="mr-1" />
                        <Text className="text-gray-600">{formatDate(activity.date)}</Text>
                      </View>
                      <View className="flex-row items-center mt-1">
                        <Clock size={14} color="#7F8C8D" className="mr-1" />
                        <Text className="text-gray-600">{formatTime(activity.time)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
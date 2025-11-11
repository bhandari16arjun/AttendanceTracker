// app/home.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Modal, TextInput, ActivityIndicator } from 'react-native';
import { 
  Plus, QrCode, Users, BookOpen, BarChart2,
  User, LogOut, XCircle, X, Loader2
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

import { useAuth } from '@/app/context/AuthContext';
import { api } from '@/services/api';
import { Classroom } from '@/types'; // Import our new type

cssInterop(LinearGradient, {
  className: 'style',
});

// A small component to represent an empty state
const EmptyState = ({ icon, title, message, actionTitle, onActionPress }: any) => (
  <View className="bg-white rounded-2xl p-6 items-center justify-center">
    {icon}
    <Text className="text-gray-500 mt-2 text-center font-bold text-lg">{title}</Text>
    <Text className="text-gray-400 text-sm mt-2 text-center">{message}</Text>
    {actionTitle && onActionPress && (
      <TouchableOpacity 
        className="mt-4 bg-[#3498DB] rounded-lg py-3 px-5"
        onPress={onActionPress}
      >
        <Text className="text-white font-bold">{actionTitle}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  
  // Create class modal states
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Fetches the user's classrooms from the backend
  const fetchClassrooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getMyClasses();
      if (!response.ok) {
        throw new Error("Failed to fetch classrooms");
      }
      const data = await response.json();
      setClassrooms(data || []); // Handle case where user has no classrooms (backend returns null)
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Handlers ---
  const handleLogout = () => {
    setShowLogoutMenu(false);
    signOut(); // signOut will trigger the redirect in _layout.tsx
  };

  const handleLeaveClassroom = (classroomId: string, classroomName: string) => {
    Alert.alert(
      "Leave Classroom",
      `Are you sure you want to leave ${classroomName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.leaveClass(classroomId);
              if (!response.ok) throw new Error("Failed to leave class");
              Alert.alert("Success", `You have left ${classroomName}.`);
              // Refresh the classroom list
              fetchClassrooms();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const handleCreateClassroom = () => {
    // We will implement this in the next step
    Alert.alert("Create Class", "This will be implemented next!");
  };

  const handleJoinClassroom = () => {
    // We will implement this in the next step
    Alert.alert("Join Class", "This will be implemented next!");
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold">Welcome,</Text>
            <Text className="text-white text-lg opacity-90">Student/Instructor</Text>
          </View>
          <View className="relative">
            <TouchableOpacity 
              className="bg-white/20 p-3 rounded-full"
              onPress={() => setShowLogoutMenu(!showLogoutMenu)}
            >
              <User size={24} color="white" />
            </TouchableOpacity>
            
            {showLogoutMenu && (
              <View className="absolute right-0 top-14 bg-white rounded-lg shadow-lg z-10 w-40">
                <TouchableOpacity 
                  className="flex-row items-center p-3"
                  onPress={handleLogout}
                >
                  <LogOut size={18} color="#E74C3C" />
                  <Text className="text-red-500 font-bold ml-2">Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        
        <View className="mt-4">
          <Text className="text-white/80 text-sm">{formatDate(currentTime)}</Text>
          <Text className="text-white text-3xl font-bold">{formatTime(currentTime)}</Text>
        </View>
      </LinearGradient>
      
      <ScrollView className="flex-1 p-4">
        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-[#2C3E50] mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-center gap-4">
            <TouchableOpacity 
              className="bg-[#3498DB] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleCreateClassroom}
            >
              <Plus size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Create Class</Text>
            </TouchableOpacity>
            
             <TouchableOpacity 
              className="bg-[#1ABC9C] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleJoinClassroom}
            >
              <Users size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Join Class</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-[#9B59B6] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={() => router.push('/activities')}
            >
              <BarChart2 size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Activities</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-[#F39C12] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={() => router.push('/face-auth-qr')}
            >
              <QrCode size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* My Classes List */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-[#2C3E50]">My Classes</Text>
            <Text className="text-[#3498DB] font-bold">{classrooms.length} joined</Text>
          </View>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#3498DB" />
          ) : classrooms.length === 0 ? (
            <EmptyState 
              icon={<BookOpen size={48} color="#BDC3C7" />}
              title="No Classes Joined"
              message="Use the 'Join Class' button to enroll in a class using a code."
              actionTitle="Join a Class"
              onActionPress={handleJoinClassroom}
            />
          ) : (
            <View className="flex-col gap-4">
              {classrooms.map((classroom) => (
                <View 
                  key={classroom.id} 
                  className="bg-white rounded-2xl p-4 shadow"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-bold text-[#2C3E50] text-lg">{classroom.name}</Text>
                      <Text className="text-gray-500">ID: {classroom.code}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleLeaveClassroom(classroom.id, classroom.name)}>
                      <XCircle size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                  
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-xs text-gray-400">{classroom.studentIds.length} students</Text>
                    {/* Placeholder for attendance, as we don't have this data yet */}
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
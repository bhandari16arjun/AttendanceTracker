// app/home.tsx (With a custom modal for joining classes)

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Modal, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { 
  Plus, QrCode, Users, BookOpen, BarChart2,
  User, LogOut, XCircle, X, Loader2
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

import { useAuth } from '@/app/context/AuthContext';
import { api } from '@/services/api';
import { Classroom } from '@/types';

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

  const [isLoading, setIsLoading]              = useState(true);
  const [isRefreshing, setIsRefreshing]        = useState(false);
  const [classrooms, setClassrooms]            = useState<Classroom[]>([]);
  const [currentTime, setCurrentTime]          = useState(new Date());
  const [showLogoutMenu, setShowLogoutMenu]    = useState(false);
  
  // States for the 'Create Class' modal
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassName, setNewClassName]        = useState('');
  const [newClassCode, setNewClassCode]        = useState('');
  const [isCreating, setIsCreating]            = useState(false);

  // NEW: States for our custom 'Join Class' modal
  const [showJoinClassModal, setShowJoinClassModal] = useState(false);
  const [joinClassCode, setJoinClassCode]        = useState('');
  const [isJoining, setIsJoining]                = useState(false);
  
  const fetchClassrooms = useCallback(async () => {
    try {
      if (!isRefreshing) setIsLoading(true);
      const response = await api.getMyClasses();
      if (!response.ok) throw new Error("Failed to fetch classrooms");
      const data = await response.json();
      setClassrooms(data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    setShowLogoutMenu(false);
    signOut();
  };

  const handleLeaveClassroom = (classroomId: string, classroomName: string) => {
    Alert.alert(
      "Leave Classroom", `Are you sure you want to leave ${classroomName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", style: "destructive",
          onPress: async () => {
            try {
              const response = await api.leaveClass(classroomId);
              if (!response.ok) throw new Error("Failed to leave class");
              Alert.alert("Success", `You have left ${classroomName}.`);
              fetchClassrooms();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const handleCreateClassSubmit = async () => {
    if (!newClassName.trim() || !newClassCode.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }
    setIsCreating(true);
    try {
      const response = await api.createClass({ name: newClassName, code: newClassCode });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create class");
      }
      Alert.alert("Success", "Class created successfully!");
      setNewClassName('');
      setNewClassCode('');
      setShowCreateClassModal(false);
      fetchClassrooms();
    } catch (error: any) {
      Alert.alert("Creation Failed", error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // MODIFIED: This now opens our custom modal
  const handleJoinClassroom = () => {
    setShowJoinClassModal(true);
  };
  
  // NEW: This is the submission logic for the new modal
  const handleJoinClassSubmit = async () => {
    if (!joinClassCode.trim()) {
      Alert.alert("Error", "Please enter a valid classroom code.");
      return;
    }
    setIsJoining(true);
    try {
      const response = await api.joinClass({ code: joinClassCode.trim() });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Could not join class.");
      }
      Alert.alert("Success", "You have joined the class!");
      setJoinClassCode('');
      setShowJoinClassModal(false);
      fetchClassrooms();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsJoining(false);
    }
  };


  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  
  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient colors={['#3498DB', '#2C3E50']} >
        <View className="flex-row justify-between items-center p-6 pt-12 pb-6">
          <View>
            <Text className="text-white text-2xl font-bold">Welcome,</Text>
            <Text className="text-white text-lg opacity-90">Student/Instructor</Text>
          </View>
          <View className="relative">
            <TouchableOpacity className="bg-white/20 p-3 rounded-full" onPress={() => setShowLogoutMenu(!showLogoutMenu)}>
              <User size={24} color="white" />
            </TouchableOpacity>
            {showLogoutMenu && (
              <View className="absolute right-0 top-14 bg-white rounded-lg shadow-lg z-10 w-40">
                <TouchableOpacity className="flex-row items-center p-3" onPress={handleLogout}>
                  <LogOut size={18} color="#E74C3C" />
                  <Text className="text-red-500 font-bold ml-2">Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <View className="px-6 pb-6">
          <Text className="text-white/80 text-sm">{formatDate(currentTime)}</Text>
          <Text className="text-white text-3xl font-bold">{formatTime(currentTime)}</Text>
        </View>
      </LinearGradient>
      
      <ScrollView /* ... Main content ... */
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-6">
          <Text className="text-xl font-bold text-[#2C3E50] mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-center gap-4">
            <TouchableOpacity className="bg-[#3498DB] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow" onPress={() => setShowCreateClassModal(true)}>
              <Plus size={24} color="white" /><Text className="text-white font-bold mt-2 text-center">Create Class</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-[#1ABC9C] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow" onPress={handleJoinClassroom}>
              <Users size={24} color="white" /><Text className="text-white font-bold mt-2 text-center">Join Class</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-[#9B59B6] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow" onPress={() => router.push('/activities')}>
              <BarChart2 size={24} color="white" /><Text className="text-white font-bold mt-2 text-center">Activities</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-[#F39C12] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow" onPress={() => router.push('/face-auth-qr')}>
              <QrCode size={24} color="white" /><Text className="text-white font-bold mt-2 text-center">Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-[#2C3E50]">My Classes</Text>
            <Text className="text-[#3498DB] font-bold">{classrooms.length} joined</Text>
          </View>
          {isLoading ? ( <ActivityIndicator size="large" color="#3498DB" />
          ) : classrooms.length === 0 ? (
            <EmptyState icon={<BookOpen size={48} color="#BDC3C7" />} title="No Classes Joined" message="Use the 'Join Class' button to enroll in a class using a code." actionTitle="Join a Class" onActionPress={handleJoinClassroom}/>
          ) : (
            <View className="flex-col gap-4">
              {classrooms.map((classroom) => (
                <TouchableOpacity key={classroom.id} className="bg-white rounded-2xl p-4 shadow" onPress={() => router.push({ pathname: '/class-details', params: { classId: classroom.id, className: classroom.name }})}>
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-bold text-[#2C3E50] text-lg">{classroom.name}</Text>
                      <Text className="text-gray-500">ID: {classroom.code}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleLeaveClassroom(classroom.id, classroom.name)}>
                      <XCircle size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row justify-between mt-2"><Text className="text-xs text-gray-400">{classroom.studentIds.length} students</Text></View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Class Modal */}
      <Modal animationType="slide" transparent={true} visible={showCreateClassModal} onRequestClose={() => setShowCreateClassModal(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl w-11/12 max-w-md p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-[#2C3E50]">Create New Class</Text>
              <TouchableOpacity onPress={() => setShowCreateClassModal(false)}><X size={24} color="#9CA3AF" /></TouchableOpacity>
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 mb-2">Class Name</Text>
              <TextInput className="border border-gray-300 rounded-lg p-3 bg-gray-50" placeholder="e.g. Advanced Calculus" value={newClassName} onChangeText={setNewClassName} />
            </View>
            <View className="mb-6">
              <Text className="text-gray-700 mb-2">Class Code</Text>
              <TextInput className="border border-gray-300 rounded-lg p-3 bg-gray-50" placeholder="A unique code, e.g. MATH101" value={newClassCode} onChangeText={setNewClassCode} />
            </View>
            <TouchableOpacity className={`rounded-lg p-4 flex-row justify-center items-center ${!newClassName.trim() || !newClassCode.trim() || isCreating ? 'bg-gray-400' : 'bg-[#3498DB]'}`} onPress={handleCreateClassSubmit} disabled={!newClassName.trim() || !newClassCode.trim() || isCreating}>
              {isCreating ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Create Class</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NEW: Join Class Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showJoinClassModal}
        onRequestClose={() => setShowJoinClassModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl w-11/12 max-w-md p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-[#2C3E50]">Join a Class</Text>
              <TouchableOpacity onPress={() => setShowJoinClassModal(false)}>
                <X size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <View className="mb-6">
              <Text className="text-gray-700 mb-2">Class Code</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                placeholder="Enter the code provided by your instructor"
                value={joinClassCode}
                onChangeText={setJoinClassCode}
                autoCapitalize="none"
              />
            </View>
            
            <TouchableOpacity 
              className={`rounded-lg p-4 flex-row justify-center items-center ${
                !joinClassCode.trim() || isJoining ? 'bg-gray-400' : 'bg-[#1ABC9C]'
              }`}
              onPress={handleJoinClassSubmit}
              disabled={!joinClassCode.trim() || isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Join Class</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Dimensions, Modal, TextInput } from 'react-native';
import { 
  Plus, QrCode, Users, BookOpen, Calendar, 
  User, LogOut, CheckCircle, XCircle, 
  Wifi, WifiOff, Clock, MapPin, BarChart2,
  X, Loader2
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, {
  className: 'style',
});

const mockClassrooms = [
  {
    id: '1',
    name: 'Mathematics 101',
    code: 'MATH101',
    teacher: 'Dr. Johnson',
    studentCount: 24,
    avatar: 'https://images.unsplash.com/photo-1527822618093-743f3e57977c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Q2xhc3Nyb29tJTIwbGVhcm5pbmclMjBlbnZpcm9ubWVudHxlbnwwfHwwfHx8MA%3D%3D',
    qrScanEnabled: true,
    joined: true,
    attendance: {
      attended: 7,
      total: 10,
      percentage: 70
    }
  },
  {
    id: '2',
    name: 'Physics 201',
    code: 'PHYS201',
    teacher: 'Prof. Smith',
    studentCount: 18,
    avatar: 'https://images.unsplash.com/photo-1515073838964-4d4d56a58b21?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8U3R1ZGVudCUyMGxlYXJuZXIlMjBwdXBpbCUyMGVkdWNhdGlvbnxlbnwwfHwwfHx8MA%3D%3D',
    qrScanEnabled: false,
    joined: true,
    attendance: {
      attended: 9,
      total: 12,
      percentage: 75
    }
  },
  {
    id: '3',
    name: 'Chemistry 301',
    code: 'CHEM301',
    teacher: 'Dr. Davis',
    studentCount: 22,
    avatar: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGNsYXNzcm9vbXxlbnwwfHwwfHx8MA%3D%3D',
    qrScanEnabled: true,
    joined: true,
    attendance: {
      attended: 5,
      total: 8,
      percentage: 62
    }
  },
  {
    id: '4',
    name: 'Biology 101',
    code: 'BIO101',
    teacher: 'Prof. Wilson',
    studentCount: 30,
    avatar: 'https://images.unsplash.com/photo-1659070953831-dd4fa16222fb?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fFNjaG9vbCUyMGNlbnRlfGVufDB8fDB8fHww',
    qrScanEnabled: false,
    joined: false,
    attendance: {
      attended: 0,
      total: 0,
      percentage: 0
    }
  }
];

// Mock data for recent activity
const recentActivity = [
  { id: '1', classroom: 'Mathematics 101', date: 'Today, 09:05 AM', status: 'check-in' },
  { id: '2', classroom: 'Physics 201', date: 'Yesterday, 02:30 PM', status: 'check-in' },
  { id: '3', classroom: 'Chemistry 301', date: 'Yesterday, 11:15 AM', status: 'check-in' },
];

export default function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const [classrooms, setClassrooms] = useState(mockClassrooms);
  const [joinedClassrooms, setJoinedClassrooms] = useState(mockClassrooms.filter(classroom => classroom.joined));
  const [availableClassrooms, setAvailableClassrooms] = useState(mockClassrooms.filter(classroom => !classroom.joined));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  
  // Create class modal states
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(false);

  const router = useRouter();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle create class submission
  const handleCreateClassSubmit = () => {
    if (!subjectCode.trim() || !subjectName.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }
    setIsCreating(true);
    setCreateError(false);
    const timeout = setTimeout(() => {
      setIsCreating(false);
      setCreateError(true);
    }, 30000);
    setTimeout(() => {
      clearTimeout(timeout);
      if (!createError) {
        setIsCreating(false);
        const newClassroom = {
          id: `${classrooms.length + 1}`,
          name: subjectName,
          code: subjectCode,
          teacher: 'You',
          studentCount: 0,
          avatar: 'https://images.unsplash.com/photo-1580582932707-520aed937417?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8U2Nob29sJTIwY2xhc3Nyb29tJTIwYmx1ZXxlbnwwfHwwfHx8MA%3D%3D',
          qrScanEnabled: true,
          joined: true,
          attendance: { attended: 0, total: 0, percentage: 0 }
        };
        setClassrooms(prev => [newClassroom, ...prev]);
        setJoinedClassrooms(prev => [newClassroom, ...prev]);
        setSubjectCode('');
        setSubjectName('');
        setShowCreateClassModal(false);
        Alert.alert('Success', 'Classroom created successfully!');
      }
    }, 2000);
  };

  const handleCreateClassroom = () => {
    setShowCreateClassModal(true);
  };

  const handleJoinClassroom = () => {
    Alert.prompt(
      "Join Classroom",
      "Enter the classroom code to join",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Join", 
          onPress: (code?: string) => {
            if (!code || code.trim() === "") {
              Alert.alert("Error", "Please enter a valid classroom code!");
              return;
            }
            const classroom = mockClassrooms.find(c => c.code === code);
            if (classroom) {
              if (!classroom.joined) {
                setClassrooms(prev => prev.map(c => 
                  c.id === classroom.id ? { ...c, joined: true } : c
                ));
                setJoinedClassrooms(prev => [...prev, classroom]);
                setAvailableClassrooms(prev => prev.filter(c => c.id !== classroom.id));
                Alert.alert("Success", `Joined ${classroom.name} successfully!`);
              } else {
                Alert.alert("Error", "You are already joined this classroom!");
              }
            } else {
              Alert.alert("Error", "Invalid classroom code!");
            }
          }
        }
      ],
      "plain-text"
    );
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
          onPress: () => {
            setClassrooms(prev => prev.map(c => 
              c.id === classroomId ? { ...c, joined: false } : c
            ));
            setJoinedClassrooms(prev => prev.filter(c => c.id !== classroomId));
            setAvailableClassrooms(prev => [
              ...prev, 
              classrooms.find(c => c.id === classroomId)!
            ]);
          }
        }
      ]
    );
  };

  const handleScanQR = () => {
    router.push('/face-auth-qr'); // Navigate to FaceAuthQRScreen
  };

  const handleMyClasses = () => {
    router.push('/instructor-classes');
  };

  const handleActivities = () => {
    router.push('/activities');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold">Welcome Back,</Text>
            <Text className="text-white text-lg opacity-90">John Doe</Text>
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
                  onPress={() => {
                    setShowLogoutMenu(false);
                    onLogout();
                  }}
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
          <View className="flex-row flex-wrap gap-4">
            <TouchableOpacity 
              className="bg-[#3498DB] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleCreateClassroom}
            >
              <Plus size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Create Class</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-[#2ECC71] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleMyClasses}
            >
              <BookOpen size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">My Classes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-[#9B59B6] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleActivities}
            >
              <BarChart2 size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Activities</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-[#F39C12] rounded-xl p-4 flex-1 min-w-[40%] items-center shadow"
              onPress={handleScanQR}
            >
              <QrCode size={24} color="white" />
              <Text className="text-white font-bold mt-2 text-center">Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Joined Classrooms */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-[#2C3E50]">My Classes</Text>
            <Text className="text-[#3498DB] font-bold">{joinedClassrooms.length} joined</Text>
          </View>
          
          {joinedClassrooms.length === 0 ? (
            <View className="bg-white rounded-2xl p-6 items-center justify-center">
              <BookOpen size={48} color="#BDC3C7" />
              <Text className="text-gray-500 mt-2 text-center">You haven't joined any classrooms yet</Text>
              <TouchableOpacity 
                className="mt-4 bg-[#3498DB] rounded-lg p-3"
                onPress={handleJoinClassroom}
              >
                <Text className="text-white font-bold">Join a Classroom</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-col gap-4">
              {joinedClassrooms.map((classroom) => (
                <View 
                  key={classroom.id} 
                  className="bg-white rounded-2xl p-4 shadow"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-bold text-[#2C3E50] text-lg">{classroom.name}</Text>
                      <Text className="text-gray-500 text-sm">{classroom.teacher}</Text>
                      <View className="flex-row justify-between mt-2">
                        <Text className="text-xs text-gray-400">{classroom.studentCount} students</Text>
                        <Text className="text-xs text-gray-400">ID: {classroom.code}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleLeaveClassroom(classroom.id, classroom.name)}>
                      <XCircle size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                  
                  <View className="mt-3">
                    <Image 
                      source={{ uri: classroom.avatar }} 
                      className="w-full h-32 rounded-lg"
                    />
                  </View>
                  
                  {/* Attendance Progress */}
                  <View className="mt-4">
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-gray-600">Attendance</Text>
                      <Text className="font-bold text-[#2C3E50]">
                        {classroom.attendance.percentage}% 
                        <Text className="text-gray-500 font-normal"> ({classroom.attendance.attended}/{classroom.attendance.total})</Text>
                      </Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View 
                        className={`h-full rounded-full ${
                          classroom.attendance.percentage >= 75 
                            ? 'bg-green-500' 
                            : classroom.attendance.percentage >= 50 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${classroom.attendance.percentage}%` }}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Create Class Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCreateClassModal}
        onRequestClose={() => setShowCreateClassModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl w-11/12 max-w-md p-6">
            {isCreating ? (
              // Loading State
              <View className="items-center py-8">
                <Loader2 size={48} color="#3498DB" className="animate-spin mb-4" />
                <Text className="text-xl font-bold text-[#2C3E50] mb-2">Creating Class</Text>
                <Text className="text-gray-600 text-center">Please wait while we set up your new classroom</Text>
              </View>
            ) : createError ? (
              // Error State
              <View className="items-center py-6">
                <XCircle size={48} color="#E74C3C" className="mb-4" />
                <Text className="text-xl font-bold text-[#2C3E50] mb-2">Creation Failed</Text>
                <Text className="text-gray-600 text-center mb-6">
                  We couldn't create your classroom. Please try again.
                </Text>
                <View className="flex-row justify-between w-full">
                  <TouchableOpacity 
                    className="bg-gray-200 rounded-lg p-3 flex-1 mr-2"
                    onPress={() => {
                      setCreateError(false);
                      setShowCreateClassModal(false);
                    }}
                  >
                    <Text className="text-gray-700 font-bold text-center">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="bg-[#3498DB] rounded-lg p-3 flex-1 ml-2"
                    onPress={() => {
                      setCreateError(false);
                      handleCreateClassSubmit();
                    }}
                  >
                    <Text className="text-white font-bold text-center">Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Form State
              <>
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-bold text-[#2C3E50]">Create New Class</Text>
                  <TouchableOpacity onPress={() => setShowCreateClassModal(false)}>
                    <X size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                
                <View className="mb-4">
                  <Text className="text-gray-700 mb-2">Subject Code</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                    placeholder="Enter subject code (e.g. MATH101)"
                    value={subjectCode}
                    onChangeText={setSubjectCode}
                  />
                </View>
                
                <View className="mb-6">
                  <Text className="text-gray-700 mb-2">Subject Name</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                    placeholder="Enter subject name"
                    value={subjectName}
                    onChangeText={setSubjectName}
                  />
                </View>
                
                <View className="flex-row justify-between">
                  <TouchableOpacity 
                    className="bg-gray-200 rounded-lg p-3 flex-1 mr-2"
                    onPress={() => setShowCreateClassModal(false)}
                  >
                    <Text className="text-gray-700 font-bold text-center">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className={`bg-[#3498DB] rounded-lg p-3 flex-1 ml-2 ${
                      !subjectCode.trim() || !subjectName.trim() ? 'opacity-50' : ''
                    }`}
                    onPress={handleCreateClassSubmit}
                    disabled={!subjectCode.trim() || !subjectName.trim()}
                  >
                    <Text className="text-white font-bold text-center">Create Class</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
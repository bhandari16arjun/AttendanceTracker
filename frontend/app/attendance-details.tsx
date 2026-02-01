// app/attendance-details.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { ArrowLeft, CheckCircle2, XCircle, CalendarDays, Bluetooth, BluetoothConnected, X, Smile, Camera as CameraIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { useBle } from '@/app/context/BleContext';
import { Lecture } from '@/types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';

cssInterop(LinearGradient, {
  className: 'style',
});

// Helper to format date string
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const isToday = (dateString: string) => {
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

export default function AttendanceDetailsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { startScanning, stopScanning, devices, isScanning, startAdvertising } = useBle();
  const params = useLocalSearchParams<{ classId: string; className: string; classCode: string; instructorId: string; }>();
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState<{ attended: string[], total: string[] }>({ attended: [], total: [] });
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  
  // Camera State
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const [eyesOpen, setEyesOpen] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!params.classId || !userId) return;

    setIsLoading(true);
    try {
      // Fetch stats
      const statsRes = await api.getStudentClassAttendanceDetails(params.classId, userId);
      if (!statsRes.ok) throw new Error("Failed to fetch attendance details");
      const statsData = await statsRes.json();
      
      const sortedAttended = statsData.attendedLectureDates?.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()) || [];
      const sortedTotal = statsData.totalLectureDates?.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()) || [];
      setDetails({ attended: sortedAttended, total: sortedTotal });

      // Fetch actual lectures to find active one
      const lecturesRes = await api.getLecturesForClass(params.classId);
      if (lecturesRes.ok) {
          const lecturesData: Lecture[] = await lecturesRes.json();
          // Find a lecture for today
          const todayLecture = lecturesData.find(l => isToday(l.date.toString()));
          setActiveLecture(todayLecture || null);
      }

    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  }, [params.classId, userId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Create a set of attended dates for quick lookup
  const attendedDateSet = new Set(details.attended);

  // Check if active lecture is already attended
  const isTodayAttended = activeLecture && attendedDateSet.has(activeLecture.date.toString());

  // Ensure broadcasting is on for the student
  useEffect(() => {
     if (userId && activeLecture && !isTodayAttended) {
         startAdvertising(userId);
     }
  }, [userId, activeLecture, isTodayAttended]);


  // --- CAMERA & FACE LOGIC (Polling Loop) ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const detectFaceLoop = async () => {
        if (!isCameraVisible || isTakingPicture || !cameraRef.current || isMarking) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.1,
                base64: false, 
                skipProcessing: true,
                shutterSound: false,
            });

            if (photo?.uri) {
                const result = await FaceDetector.detectFacesAsync(photo.uri, {
                    mode: FaceDetector.FaceDetectorMode.fast,
                    detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
                    runClassifications: FaceDetector.FaceDetectorClassifications.all,
                });

                if (result.faces.length > 0) {
                    const face = result.faces[0];
                    const rightEye = face.rightEyeOpenProbability;
                    const leftEye = face.leftEyeOpenProbability;
                    
                    const IS_OPEN = 0.8;
                    const IS_CLOSED = 0.3;

                    if (eyesOpen && (rightEye < IS_CLOSED && leftEye < IS_CLOSED)) {
                        setEyesOpen(false);
                        setDetectionStatus("Blink detected! Open eyes...");
                    } else if (!eyesOpen && (rightEye > IS_OPEN && leftEye > IS_OPEN)) {
                        setEyesOpen(true);
                        setDetectionStatus("Capturing & Verifying...");
                        await captureAndSubmit();
                    } else if (eyesOpen) {
                        setDetectionStatus("Please Blink to capture");
                    }
                } else {
                    setDetectionStatus("No face detected");
                }
            }
        } catch (e) {
            // Ignore errors
        }
    };

    if (isCameraVisible) {
        interval = setInterval(detectFaceLoop, 800);
    }

    return () => clearInterval(interval);
  }, [isCameraVisible, isTakingPicture, eyesOpen, isMarking]);

  const handleStartVerification = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to verify your identity.");
        return;
      }
    }
    setDetectionStatus("Position your face");
    setIsCameraVisible(true);
    setEyesOpen(true);
  };

  const captureAndSubmit = async () => {
    if (cameraRef.current && !isMarking) {
        setIsMarking(true);
        setIsTakingPicture(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
                skipProcessing: false,
            });
            
            if (photo?.base64 && activeLecture) {
                 setIsCameraVisible(false);
                 
                 const response = await api.markAttendanceProximity({ 
                     lectureId: activeLecture.id,
                     faceImage: photo.base64
                 });

                 if (response.ok) {
                    Alert.alert("Success", "Identity Verified! Attendance Marked.");
                    fetchDetails();
                 } else {
                    const err = await response.json();
                    if (response.status === 409) {
                        Alert.alert("Info", "Attendance already marked.");
                        fetchDetails();
                    } else {
                        Alert.alert("Verification Failed", err.error || "Could not verify identity.");
                    }
                 }
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to capture/send image");
        } finally {
            setIsMarking(false);
            setIsTakingPicture(false);
        }
    }
  };


  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{params.className}</Text>
          </View>
        </View>
        <Text className="text-white/80 text-sm">Code: {params.classCode}</Text>
        <Text className="text-white/80 text-sm" numberOfLines={1}>Instructor ID: {params.instructorId}</Text>
      </LinearGradient>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#3498DB" className="mt-8" />
      ) : (
        <ScrollView className="flex-1 p-4">
          
          {/* Active Lecture Action Card */}
          {activeLecture && !isTodayAttended && (
            <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border-l-4 border-[#3498DB]">
                <Text className="text-lg font-bold text-[#2C3E50] mb-2">Active Lecture Found</Text>
                <Text className="text-gray-600 mb-4">Class is currently in session. Mark your attendance now.</Text>
                
                <TouchableOpacity 
                    className={`rounded-xl p-4 flex-row justify-center items-center ${isMarking ? 'bg-gray-400' : 'bg-[#3498DB]'}`}
                    onPress={handleStartVerification} // Start Camera Flow
                    disabled={isMarking}
                >
                    {isMarking ? (
                        <>
                            <ActivityIndicator color="white" size="small" />
                            <Text className="text-white font-bold ml-2">Verifying...</Text>
                        </>
                    ) : (
                        <>
                            <CameraIcon color="white" size={20} />
                            <Text className="text-white font-bold ml-2">Verify & Mark Attendance</Text>
                        </>
                    )}
                </TouchableOpacity>
                <Text className="text-xs text-gray-400 text-center mt-2">
                    Requires Face Verification + Bluetooth Proximity
                </Text>
            </View>
          )}

          {activeLecture && isTodayAttended && (
             <View className="bg-green-50 rounded-2xl p-4 mb-6 border border-green-200 flex-row items-center">
                <CheckCircle2 color="#2ECC71" size={24} />
                <View className="ml-3">
                    <Text className="text-green-800 font-bold">Attendance Marked</Text>
                    <Text className="text-green-600 text-xs">You are present for today's lecture.</Text>
                </View>
             </View>
          )}

          <View className="bg-white rounded-2xl p-4 mb-6 shadow">
            <Text className="text-lg font-bold text-[#2C3E50] text-center">Attendance Summary</Text>
            <View className="flex-row justify-center items-baseline mt-2">
              <Text className="text-4xl font-bold text-[#3498DB]">{details.attended.length}</Text>
              <Text className="text-xl font-semibold text-gray-500"> / {details.total.length}</Text>
            </View>
            <Text className="text-sm text-gray-500 text-center">lectures attended</Text>
          </View>

          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-[#2C3E50]">Lecture History</Text>
          </View>
          
          {details.total.length === 0 ? (
             <View className="bg-white rounded-2xl p-6 items-center justify-center mt-2">
                <CalendarDays size={48} color="#BDC3C7" />
                <Text className="text-gray-500 mt-4 text-center font-bold text-lg">No Lectures Yet</Text>
                <Text className="text-gray-400 text-sm mt-2 text-center">Lectures for this class will appear here once they are created.</Text>
            </View>
          ) : (
            <View className="flex-col gap-3">
              {details.total.map((dateString) => {
                const isAttended = attendedDateSet.has(dateString);
                return (
                  <View key={dateString} className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
                    {isAttended ? (
                      <CheckCircle2 size={24} color="#2ECC71" />
                    ) : (
                      <XCircle size={24} color="#E74C3C" />
                    )}
                    <View className="ml-4 flex-1">
                      <Text className={`font-semibold ${isAttended ? 'text-gray-800' : 'text-gray-500'}`}>
                        {formatDate(dateString)}
                      </Text>
                      <Text className={`text-sm ${isAttended ? 'text-green-600' : 'text-red-600'}`}>
                        {isAttended ? 'Attended' : 'Missed'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Camera Modal */}
      <Modal visible={isCameraVisible} animationType="slide">
          <View className="flex-1 bg-black">
              <CameraView 
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill} 
                  facing="front"
              />
              <View className="absolute top-12 left-4 z-10">
                  <TouchableOpacity onPress={() => setIsCameraVisible(false)} className="bg-black/50 p-2 rounded-full">
                      <X color="white" size={30} />
                  </TouchableOpacity>
              </View>
              
              <View className="absolute bottom-0 w-full bg-black/70 p-8 items-center rounded-t-3xl">
                  {isMarking ? (
                      <ActivityIndicator size="large" color="#FFD700" />
                  ) : (
                      <Smile size={40} color="#FFD700" className="mb-4" />
                  )}
                  
                  <Text className="text-white text-xl font-bold mb-2">Liveness Check</Text>
                  <Text className={`text-lg font-bold ${detectionStatus.includes("Capturing") ? "text-green-400" : "text-yellow-400"}`}>
                      {detectionStatus}
                  </Text>
                  <Text className="text-gray-400 text-center mt-4 text-xs">
                      Blink your eyes to verify identity and mark attendance.
                  </Text>
              </View>
          </View>
      </Modal>
    </View>
  );
}
// app/instructor-classes.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { ArrowLeft, Plus, BarChartHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { Lecture } from '@/types';

cssInterop(LinearGradient, {
  className: 'style',
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function InstructorClassesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId: string; className: string; }>();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLectures = useCallback(async () => {
    if (!params.classId) return;
    try {
      if (!isRefreshing) setIsLoading(true);
      const response = await api.getLecturesForClass(params.classId);
      if (!response.ok) {
        throw new Error("Failed to fetch lectures");
      }
      const data = await response.json();
      setLectures(data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.classId, isRefreshing]);

  useEffect(() => {
    fetchLectures();
  }, [fetchLectures]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchLectures();
  }, [fetchLectures]);

  const handleCreateLecture = async () => {
    if (!params.classId) return;
    setIsCreating(true);
    try {
      const response = await api.createLecture(params.classId);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create lecture");
      }
      Alert.alert("Success", "New lecture created for today.");
      fetchLectures(); // Refresh the list
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const totalLectures = lectures.length;

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold" numberOfLines={1}>{params.className}</Text>
        </View>
      </LinearGradient>

      <View className="p-4">
        {/* Top Action Buttons */}
        <View className="flex-row gap-4 mb-4">
            <TouchableOpacity 
                className="bg-green-500 rounded-lg p-4 flex-1 flex-row justify-center items-center shadow"
                onPress={handleCreateLecture}
                disabled={isCreating}
            >
                {isCreating ? <ActivityIndicator color="white" /> : <Plus size={20} color="white" />}
                <Text className="text-white font-bold ml-2">Create New Lecture</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                className="bg-purple-500 rounded-lg p-4 flex-1 flex-row justify-center items-center shadow"
                // onPress={() => { /* Navigate to analytics page */ }}
            >
                <BarChartHorizontal size={20} color="white" />
                <Text className="text-white font-bold ml-2">View Class Analytics</Text>
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <Text className="text-lg font-bold text-[#2C3E50] mb-4">
          Lecture History ({totalLectures})
        </Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498DB" />
        ) : lectures.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center">
            <Text className="text-gray-500 text-center">No lectures have been created for this class yet.</Text>
          </View>
        ) : (
          <View className="flex-col gap-3">
            {lectures.map((lecture, index) => (
              <View key={lecture.id} className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
                <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-4">
                    <Text className="text-[#2C3E50] font-bold text-lg">{totalLectures - index}</Text>
                </View>
                <View>
                  <Text className="font-semibold text-gray-800">Lecture #{totalLectures - index}</Text>
                  <Text className="text-sm text-gray-500">{formatDate(lecture.date)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

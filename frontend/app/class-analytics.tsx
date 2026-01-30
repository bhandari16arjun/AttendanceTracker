// app/class-analytics.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { ArrowLeft, Users, Percent } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ClassAnalyticsResponse, StudentAnalytics } from '@/types';

cssInterop(LinearGradient, {
  className: 'style',
});

const ProgressBar = ({ percentage }: { percentage: number }) => {
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    let color = '#3498DB'; // Blue for normal
    if (clampedPercentage < 50) color = '#E74C3C'; // Red for low
    else if (clampedPercentage >= 80) color = '#2ECC71'; // Green for high
  
    return (
      <View className="w-full bg-gray-200 rounded-full h-2 mt-1">
        <View 
          style={{ width: `${clampedPercentage}%`, backgroundColor: color }} 
          className="h-2 rounded-full" 
        />
      </View>
    );
  };

export default function ClassAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId: string; className: string; }>();

  const [analytics, setAnalytics] = useState<ClassAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!params.classId) return;
    try {
      if (!isRefreshing) setIsLoading(true);
      const response = await api.getClassAnalytics(params.classId);
      if (!response.ok) {
        throw new Error("Failed to fetch class analytics");
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.classId, isRefreshing]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#8E44AD', '#3498DB']} 
        className="p-6 pt-12 pb-6"
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{params.className}</Text>
            <Text className="text-white/80">Class Analytics</Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading && !isRefreshing ? (
        <ActivityIndicator size="large" color="#8E44AD" className="mt-8" />
      ) : (
        <ScrollView 
            className="flex-1 p-4"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
            <View className="bg-white rounded-2xl p-4 mb-6 shadow flex-row justify-around">
                <View className="items-center">
                    <Text className="text-3xl font-bold text-[#34495E]">{analytics?.totalLecturesCount ?? 0}</Text>
                    <Text className="text-sm text-gray-500">Total Lectures</Text>
                </View>
                <View className="items-center">
                    <Text className="text-3xl font-bold text-[#34495E]">{analytics?.students?.length ?? 0}</Text>
                    <Text className="text-sm text-gray-500">Enrolled Students</Text>
                </View>
            </View>

            <Text className="text-lg font-bold text-[#2C3E50] mb-4">
                Student Performance
            </Text>

            {analytics?.students && analytics.students.length > 0 ? (
                 <View className="flex-col gap-3">
                    {analytics.students.map((student) => (
                        <View key={student.userId} className="bg-white rounded-xl p-4 shadow-sm">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3">
                                    <Text className="text-[#2C3E50] font-bold">
                                        {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="font-semibold text-gray-800">{student.name}</Text>
                                    <Text className="text-sm text-gray-500">{student.email}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="font-bold text-lg text-[#34495E]">{student.attendancePercentage.toFixed(1)}%</Text>
                                    <Text className="text-xs text-gray-500">{student.attendedLecturesCount} attended</Text>
                                </View>
                            </View>
                            <ProgressBar percentage={student.attendancePercentage} />
                        </View>
                    ))}
                 </View>
            ) : (
                <View className="bg-white rounded-2xl p-6 items-center justify-center mt-2">
                    <Users size={48} color="#BDC3C7" />
                    <Text className="text-gray-500 mt-4 text-center font-bold text-lg">No Students Enrolled</Text>
                    <Text className="text-gray-400 text-sm mt-2 text-center">Student analytics will appear here once students join the class.</Text>
                </View>
            )}
        </ScrollView>
      )}
    </View>
  );
}

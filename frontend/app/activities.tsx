// app/activities.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput, StyleSheet } from 'react-native';
import { ArrowLeft, BookOpen, Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ClassroomWithPercentage } from '@/types';

cssInterop(LinearGradient, {
  className: 'style',
});

const ProgressBar = ({ percentage }: { percentage: number }) => {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  let color = '#3498DB'; // Blue for normal
  if (clampedPercentage < 50) color = '#E74C3C'; // Red for low
  else if (clampedPercentage >= 80) color = '#2ECC71'; // Green for high

  return (
    <View className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
      <View 
        style={{ width: `${clampedPercentage}%`, backgroundColor: color }} 
        className="h-2.5 rounded-full" 
      />
    </View>
  );
};

export default function ActivitiesScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allClasses, setAllClasses] = useState<ClassroomWithPercentage[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassroomWithPercentage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClasses = useCallback(async () => {
    try {
      if (!isRefreshing) setIsLoading(true);
      const response = await api.getMyEnrolledClasses();
      if (!response.ok) {
        throw new Error("Failed to fetch your classes");
      }
      const data: ClassroomWithPercentage[] = await response.json();
      setAllClasses(data || []);
      setFilteredClasses(data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = allClasses.filter(c => 
      c.name.toLowerCase().includes(lowercasedQuery) ||
      c.code.toLowerCase().includes(lowercasedQuery)
    );
    setFilteredClasses(filtered);
  }, [searchQuery, allClasses]);

  return (
    <View className="flex-1 bg-gray-100">
      <LinearGradient 
        colors={['#3498DB', '#2C3E50']} 
        className="p-6 pt-12 pb-4"
      >
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Enrolled Classes</Text>
        </View>
        <View className="relative">
          <View className="absolute inset-y-0 left-0 pl-3 flex-row items-center">
            <Search size={20} color="black" />
          </View>
          <TextInput
            className="bg-white/90 rounded-lg h-12 pl-10 pr-10 text-base"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9E9E9E"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex-row items-center">
              <X size={20} color="#9E9E9E" />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498DB" />
        ) : filteredClasses.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center justify-center mt-6">
            <BookOpen size={48} color="#BDC3C7" />
            <Text className="text-gray-500 mt-4 text-center font-bold text-lg">
              {searchQuery ? 'No Matching Classes' : 'No Classes Found'}
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              {searchQuery ? 'Try a different search term.' : 'You are not enrolled in any classes as a student.'}
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-4">
            {filteredClasses.map((classroom) => (
              <TouchableOpacity 
                key={classroom.id} 
                className="bg-white rounded-2xl p-4 shadow"
                onPress={() => router.push({ pathname: '/attendance-details', params: { classId: classroom.id, className: classroom.name, classCode: classroom.code, instructorId: classroom.instructorId }})}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="font-bold text-[#2C3E50] text-lg">{classroom.name}</Text>
                    <Text className="text-gray-500">ID: {classroom.code}</Text>
                  </View>
                  <Text className="font-bold text-[#2C3E50] text-lg">
                    {(classroom.attendancePercentage ?? 0).toFixed(1)}%
                  </Text>
                </View>
                <ProgressBar percentage={classroom.attendancePercentage} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

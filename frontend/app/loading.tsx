import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';

cssInterop(LinearGradient, { className: 'style' });

function Spinner({ size = 64, borderWidth = 4 }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderWidth,
        borderColor: 'white',
        borderTopColor: 'transparent',
        borderRadius: 9999,
        marginBottom: 32,
        transform: [{ rotate }],
      }}
    />
  );
}

export default function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 3000); // Show loading for 3 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient 
      colors={['#1a2980', '#26d0ce']} 
      className="flex-1 items-center justify-center p-4"
    >
      <View className="items-center justify-center mb-8">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZW5jcnlwdGlvbnxlbnwwfHwwfHx8MA%3D%3D' }}
          className="w-32 h-32 rounded-full mb-6"
        />
        <Text className="text-3xl font-bold text-white mb-2">AttendanceTracker Pro</Text>
        <Text className="text-white text-lg" style={{ opacity: 0.9 }}>Secure. Reliable. Efficient.</Text>
      </View>
      
      <Spinner size={64} borderWidth={4} />
      
      <Text className="text-white text-center text-lg">Initializing security protocols...</Text>
    </LinearGradient>
  );
}
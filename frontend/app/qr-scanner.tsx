import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronLeft, RotateCcw, QrCode } from 'lucide-react-native';
import { useRouter } from 'expo-router'; // Import useRouter

const QRScannerScreen = () => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [qrCode, setQrCode] = useState('https://example.com/qr-code');
  const router = useRouter(); // Initialize router

  // Simulate QR code refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === 1) {
          // Refresh QR code
          setQrCode(`https://example.com/qr-code-${Date.now()}`);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRefreshQR = () => {
    setQrCode(`https://example.com/qr-code-${Date.now()}`);
    setTimeLeft(30);
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-[#2C3E50] p-4 rounded-b-3xl">
        <View className="flex-row items-center"><TouchableOpacity className="p-2" onPress={() => router.back()}><ChevronLeft color="white" size={24} /></TouchableOpacity><Text className="text-white text-xl font-bold flex-1 text-center">Take Attendance</Text><View className="w-10" /></View>
        <View className="mt-4 mb-2">
          <Text className="text-white text-center text-lg">Scan this QR code for attendance</Text>
          <Text className="text-white/80 text-center mt-1">Code refreshes in {timeLeft}s</Text>
        </View>
      </View>

      {/* QR Code Section */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-white rounded-2xl p-6 shadow-lg w-full items-center">
          {/* QR Code Placeholder */}
          <View className="bg-gray-200 border-2 border-dashed border-gray-300 rounded-xl w-64 h-64 items-center justify-center mb-6">
            <QrCode color="#2C3E50" size={80} />
            <Text className="text-[#2C3E50] mt-2 font-medium">QR Code</Text>
            <Text className="text-gray-500 text-sm text-center mt-1">Scan to mark attendance</Text>
          </View>
          
          <Text className="text-[#2C3E50] font-bold text-lg mb-2">Mathematics 101</Text>
          <Text className="text-gray-500 mb-6">Advanced Calculus - Lecture 5</Text>
          
          <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
            <Text className="text-[#2C3E50] font-medium">Refresh in: </Text>
            <Text className="text-[#3498DB] font-bold text-lg">{timeLeft}s</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          className="flex-row items-center bg-[#3498DB] rounded-full px-6 py-3 mt-8"
          onPress={handleRefreshQR}
        >
          <RotateCcw color="white" size={20} />
          <Text className="text-white font-bold ml-2">Refresh QR Code</Text>
        </TouchableOpacity>
      </View>

      {/* Info Section */}
      <View className="bg-white mx-4 mb-6 rounded-xl p-4 shadow-sm">
        <Text className="text-[#2C3E50] font-bold mb-2">How it works:</Text>
        <Text className="text-gray-600 text-sm">{`1. Students scan this QR code with the app\n2. Their attendance is automatically marked\n3. View real-time attendance in class details`}</Text>
      </View>
    </View>
  );
};

export default QRScannerScreen;
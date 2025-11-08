import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Camera, Lock, User, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useRouter } from 'expo-router';

cssInterop(LinearGradient, { className: 'style' });

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);

  const handleFaceRegistration = () => {
    Alert.alert(
      "Face Registration",
      "Please look at the camera to register your face",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Register Face",
          onPress: () => {
            setFaceRegistered(true);
            Alert.alert("Success", "Face registered successfully!");
          }
        }
      ]
    );
  };

  const handleRegistration = () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    
    if (!faceRegistered) {
      Alert.alert("Error", "Face registration is required to complete registration");
      return;
    }
    
    // In a real app, register user here
    Alert.alert("Success", "Registration completed! You can now log in.");
    router.push('/login');
  };

  return (
    <LinearGradient 
      colors={['#f0f2f5', '#e1e5ea']} 
      className="flex-1 p-6"
    >
      <View className="flex-1 justify-center">
        <View className="mb-8 items-center">
          <View className="bg-white p-4 rounded-full mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 10 }}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1573496358961-3c82861ab8f4?w=200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fEJ1c2luZXNzd29tYW4lMjBwcm9mZXNzaW9uYWwlMjBleGVjdXRpdmV8ZW58MHx8MHx8fDA%3D' }}
              className="w-24 h-24 rounded-full"
            />
          </View>
          <Text className="text-2xl font-bold text-[#1a2980]">Create Account</Text>
          <Text className="text-[#7F8C8D] mt-1">Register to get started</Text>
        </View>
        
        <View className="bg-white rounded-2xl p-6 mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 10 }}>
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <User size={20} color="#1a2980" />
            <TextInput
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              className="flex-1 ml-3 text-[#2C3E50] font-medium"
            />
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <User size={20} color="#1a2980" />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              className="flex-1 ml-3 text-[#2C3E50] font-medium"
            />
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-4">
            <Lock size={20} color="#1a2980" />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              className="flex-1 ml-3 text-[#2C3E50] font-medium"
            />
            <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={20} color="#7F8C8D" /> : <Eye size={20} color="#7F8C8D" />}
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center border border-gray-200 rounded-xl p-4 mb-6">
            <Lock size={20} color="#1a2980" />
            <TextInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!confirmPasswordVisible}
              className="flex-1 ml-3 text-[#2C3E50] font-medium"
            />
            <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
              {confirmPasswordVisible ? <EyeOff size={20} color="#7F8C8D" /> : <Eye size={20} color="#7F8C8D" />}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className={`flex-row items-center justify-center rounded-xl p-4 mb-4 ${faceRegistered ? 'bg-green-500' : 'bg-[#1a2980]'}`}
            onPress={handleFaceRegistration}
          >
            <Camera size={20} color="white" />
            <Text className="text-white font-bold text-lg ml-2">
              {faceRegistered ? 'Face Registered' : 'Register Face'}
            </Text>
            {faceRegistered && <CheckCircle size={20} color="white" className="ml-2" />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            className={`rounded-xl p-4 items-center ${faceRegistered ? 'bg-[#26d0ce]' : 'bg-gray-400'}`}
            onPress={handleRegistration}
            disabled={!faceRegistered}
          >
            <Text className="text-white font-bold text-lg">Register</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-center mt-4">
          <Text className="text-[#7F8C8D]">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text className="text-[#1a2980] font-bold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}
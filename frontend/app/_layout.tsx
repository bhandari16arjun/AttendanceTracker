// app/_layout.tsx

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from "@/app/context/AuthContext";
import { useColorScheme } from "@/hooks/useColorScheme"; // CORRECTED: Point to the better hook

import "../global.css";

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (isLoading) return; // Don't do anything while loading token.

    const isAuthRoute = segments.includes('login') || segments.includes('register');

    if (token && isAuthRoute) {
      // User is signed in but is on a login/register page.
      // Redirect to the home screen.
      router.replace('/home');
    } else if (!token && !isAuthRoute) {
      // User is not signed in and is trying to access a protected route.
      // Redirect to the login screen.
      router.replace('/login');
    }
  }, [token, segments, isLoading, router]);

  if (isLoading) {
    // Optionally render a loading screen here
    return null; 
  }

  return (
    <GluestackUIProvider mode={colorScheme ?? 'light'}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Screens inside the app */}
        <Stack.Screen name="home" />
        <Stack.Screen name="instructor-classes" />
        <Stack.Screen name="class-details" />
        <Stack.Screen name="qr-scanner" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="face-auth-qr" />

        {/* Auth screens */}
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        
        {/* Utility screens */}
        <Stack.Screen name="loading" />
      </Stack>
    </GluestackUIProvider>
  );
}
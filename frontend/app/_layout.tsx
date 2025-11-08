import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useColorScheme } from "@/components/useColorScheme";
import { Stack } from 'expo-router'; 
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

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

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme === "dark" ? "dark" : "light"}>
      <Stack
        screenOptions={{
          headerShown: false, // Hide headers for full-screen experience
        }}
      >
        <Stack.Screen name="loading" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="instructor-classes" />
        <Stack.Screen name="class-details" />
        <Stack.Screen name="qr-scanner" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="face-auth-qr" /> {/* Added face-auth-qr screen */}
      </Stack>
    </GluestackUIProvider>
  );
}
// app/index.tsx

import { Redirect } from 'expo-router';

export default function Index() {
  // The AuthProvider in _layout.tsx will handle all redirect logic.
  // This just serves as the entry point. We redirect to a screen
  // inside the app, and the layout will either allow it or
  // redirect to the login page.
  return <Redirect href="/home" />;
}
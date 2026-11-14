import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Loading } from '@/components/screen';
import { HouseholdProvider, useHousehold } from '@/lib/household';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HouseholdProvider>
        <AnimatedSplashOverlay />
        <RootStack />
      </HouseholdProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { status } = useHousehold();
  if (status === 'loading') return <Loading />;

  const ready = status === 'ready';
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Signed in with a household: the main app. */}
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="space/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="list/[id]" options={{ title: '' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan a barcode', presentation: 'modal' }} />
      </Stack.Protected>

      {/* Not signed in yet, or the app isn't connected to Supabase. */}
      <Stack.Protected guard={status === 'signed-out' || status === 'not-configured'}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Signed in, but needs to create or join a household. */}
      <Stack.Protected guard={status === 'no-household'}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

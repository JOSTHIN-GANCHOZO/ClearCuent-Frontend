import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProveedorSesion } from '@/features/cuenta/components/ProveedorSesion';
import { colores } from '@/shared/theme/colores';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ProveedorSesion>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colores.fondo },
            headerShown: false,
          }}
        >
          <Stack.Screen name="panel" />
        </Stack>
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}

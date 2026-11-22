import { useRouter } from 'expo-router';

import { LoginScreen } from '@/features/cuenta/components/LoginScreen';
import { useAutenticacionViewModel } from '@/features/cuenta/hooks/useAutenticacionViewModel';

export default function LoginRoute() {
  const router = useRouter();
  const { iniciarSesion } = useAutenticacionViewModel({
    // RF-02 CA1: un login válido reemplaza el formulario por el panel aprobado.
    onAutenticado: () => router.replace('/panel'),
    onRequiereCambioDispositivo: () => router.push('/cambio-dispositivo'),
    // RF-07 CA5: el código sesion_revocada del contrato dirige a la pantalla ya existente.
    onSesionRevocada: () => router.replace('/sesion-revocada'),
  });

  return <LoginScreen onIniciarSesion={iniciarSesion} />;
}

import { useRouter } from 'expo-router';

import { SesionRevocadaScreen } from '@/features/cuenta/components/SesionRevocadaScreen';

export default function SesionRevocadaRoute() {
  const router = useRouter();

  return <SesionRevocadaScreen onIniciarSesion={() => router.replace('/login')} />;
}

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { CambioDispositivoScreen } from '@/features/cuenta/components/CambioDispositivoScreen';
import { useAutenticacionViewModel } from '@/features/cuenta/hooks/useAutenticacionViewModel';

export default function CambioDispositivoRoute() {
  const router = useRouter();
  const { cancelarCambio, confirmarCambio } = useAutenticacionViewModel({
    onAutenticado: () => router.replace('/panel'),
    // RF-07 CA5: si otra sesión revoca la actual al confirmar, se muestra la pantalla de revocación.
    onSesionRevocada: () => router.replace('/sesion-revocada'),
  });

  useEffect(
    () => () => {
      // RF-07 CA4: también descartar la contraseña si se abandona la ruta con gesto o botón físico.
      cancelarCambio();
    },
    [cancelarCambio],
  );

  return (
    <CambioDispositivoScreen
      onCancelar={() => {
        cancelarCambio();
        router.back();
      }}
      onConfirmar={confirmarCambio}
    />
  );
}

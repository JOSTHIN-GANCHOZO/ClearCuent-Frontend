import { useRouter } from 'expo-router';

import { CambioDispositivoScreen } from '@/features/cuenta/components/CambioDispositivoScreen';
import type { ResultadoCambioDispositivoUi } from '@/features/cuenta/hooks/useCambioDispositivoViewModel';

export default function CambioDispositivoRoute() {
  const router = useRouter();

  // RF-07: la confirmación real se conectará al servicio de autenticación aprobado.
  const confirmarPendiente = async (): Promise<ResultadoCambioDispositivoUi> => 'error';

  return (
    <CambioDispositivoScreen
      onCancelar={() => router.back()}
      onConfirmar={confirmarPendiente}
    />
  );
}

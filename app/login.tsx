import { LoginScreen } from '@/features/cuenta/components/LoginScreen';
import type { ResultadoLoginUi } from '@/features/cuenta/hooks/useLoginViewModel';

export default function LoginRoute() {
  // RF-02: la conexión real espera la decisión aprobada para la URL de la API.
  const iniciarSesionPendiente = async (): Promise<ResultadoLoginUi> => 'errorTecnico';

  return <LoginScreen onIniciarSesion={iniciarSesionPendiente} />;
}

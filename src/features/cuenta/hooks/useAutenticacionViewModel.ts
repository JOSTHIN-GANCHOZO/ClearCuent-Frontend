import { useCallback } from 'react';

import type { ResultadoCambioDispositivoUi } from '@/features/cuenta/hooks/useCambioDispositivoViewModel';
import type { ResultadoLoginUi } from '@/features/cuenta/hooks/useLoginViewModel';
import type { LoginForm } from '@/features/cuenta/schemas/login.schema';
import { authService, type ResultadoAutenticacion } from '@/services/auth.service';

type UseAutenticacionViewModelParams = {
  onAutenticado?: () => void;
  onRequiereCambioDispositivo?: () => void;
  onSesionRevocada?: () => void;
};

function resultadoParaLogin(resultado: ResultadoAutenticacion): ResultadoLoginUi {
  if (resultado.tipo === 'bloqueado' || resultado.tipo === 'limiteSolicitudes') {
    return {
      estado: resultado.tipo,
      reintentarEnSegundos: resultado.reintentarEnSegundos,
    };
  }
  if (resultado.tipo === 'credencialesIncorrectas') return 'credencialesIncorrectas';
  if (resultado.tipo === 'sinConexion') return 'sinConexion';
  return 'errorTecnico';
}

function resultadoParaCambioDispositivo(
  resultado: ResultadoAutenticacion,
): ResultadoCambioDispositivoUi {
  if (resultado.tipo === 'bloqueado' || resultado.tipo === 'limiteSolicitudes') {
    return { estado: resultado.tipo, reintentarEnSegundos: resultado.reintentarEnSegundos };
  }
  // AM-35: los demás rechazos siguen genéricos y no revelan si el correo existe.
  return 'error';
}

export function useAutenticacionViewModel({
  onAutenticado,
  onRequiereCambioDispositivo,
  onSesionRevocada,
}: UseAutenticacionViewModelParams = {}) {
  const iniciarSesion = useCallback(
    async (datos: LoginForm): Promise<ResultadoLoginUi> => {
      const resultado = await authService.iniciarSesion(datos);
      if (resultado.tipo === 'exito') {
        onAutenticado?.();
        return 'exito';
      }
      if (resultado.tipo === 'otraSesionActiva') {
        onRequiereCambioDispositivo?.();
        return 'cambioDispositivo';
      }
      if (resultado.tipo === 'sesionRevocada') {
        // RF-07 CA5: la respuesta del contrato dirige a la pantalla de revocación.
        onSesionRevocada?.();
        return 'sesionRevocada';
      }
      return resultadoParaLogin(resultado);
    },
    [onAutenticado, onRequiereCambioDispositivo, onSesionRevocada],
  );

  const confirmarCambio = useCallback(async (): Promise<ResultadoCambioDispositivoUi> => {
    const resultado = await authService.confirmarCambioDispositivo();
    if (resultado.tipo === 'exito') {
      onAutenticado?.();
      return 'exito';
    }
    if (resultado.tipo === 'sesionRevocada') {
      // RF-07 CA5: otra sesión revocó la actual durante la confirmación.
      onSesionRevocada?.();
      return 'error';
    }
    return resultadoParaCambioDispositivo(resultado);
  }, [onAutenticado, onSesionRevocada]);

  const cancelarCambio = useCallback(() => authService.cancelarCambioDispositivo(), []);

  return {
    cancelarCambio,
    confirmarCambio,
    iniciarSesion,
  };
}

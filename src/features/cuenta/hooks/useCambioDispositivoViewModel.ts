import { useState } from 'react';

type EstadoConEspera = 'bloqueado' | 'limiteSolicitudes';

export type ResultadoCambioDispositivoConEspera = {
  estado: EstadoConEspera;
  reintentarEnSegundos?: number;
};

export type ResultadoCambioDispositivoUi = 'exito' | 'error' | ResultadoCambioDispositivoConEspera;
export type EstadoCambioDispositivoUi = 'inicial' | 'procesando' | 'error' | EstadoConEspera;

type UseCambioDispositivoViewModelParams = {
  onConfirmar: () => Promise<ResultadoCambioDispositivoUi>;
};

export function useCambioDispositivoViewModel({
  onConfirmar,
}: UseCambioDispositivoViewModelParams) {
  const [estado, setEstado] = useState<EstadoCambioDispositivoUi>('inicial');
  const [reintentarEnSegundos, setReintentarEnSegundos] = useState<number>();

  const confirmar = async () => {
    setEstado('procesando');
    setReintentarEnSegundos(undefined);
    try {
      const resultado = await onConfirmar();
      if (resultado === 'error') {
        setEstado('error');
        return;
      }
      if (resultado === 'exito') {
        return;
      }
      // RF-02 CA3 / RF-07 CA2: conserva el tiempo informado por el servidor sin revelar si el correo existe.
      setEstado(resultado.estado);
      setReintentarEnSegundos(resultado.reintentarEnSegundos);
    } catch {
      setEstado('error');
      setReintentarEnSegundos(undefined);
    }
  };

  return { confirmar, estado, reintentarEnSegundos };
}

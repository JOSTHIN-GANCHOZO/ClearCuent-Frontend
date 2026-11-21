import { useState } from 'react';

export type ResultadoCambioDispositivoUi = 'exito' | 'error';
export type EstadoCambioDispositivoUi = 'inicial' | 'procesando' | 'error';

type UseCambioDispositivoViewModelParams = {
  onConfirmar: () => Promise<ResultadoCambioDispositivoUi>;
};

export function useCambioDispositivoViewModel({
  onConfirmar,
}: UseCambioDispositivoViewModelParams) {
  const [estado, setEstado] = useState<EstadoCambioDispositivoUi>('inicial');

  const confirmar = async () => {
    setEstado('procesando');
    try {
      const resultado = await onConfirmar();
      if (resultado === 'error') {
        setEstado('error');
      }
    } catch {
      setEstado('error');
    }
  };

  return { confirmar, estado };
}

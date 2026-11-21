import { useEffect } from 'react';
import { useRouter } from 'expo-router';

const DURACION_MINIMA_MS = 800;

// React Native 0.88 retiró el export nativo; requestIdleCallback conserva la espera no bloqueante.
const InteractionManager = {
  runAfterInteractions: (tarea: () => void) => {
    const tareaPendiente = requestIdleCallback(tarea);
    return { cancel: () => cancelIdleCallback(tareaPendiente) };
  },
};

export function useInicioViewModel() {
  const router = useRouter();

  useEffect(() => {
    let activo = true;
    let esperaMinimaCompletada = false;
    let interaccionesCompletadas = false;

    // Apoyo visual del arranque previo a RF-02: no restaura sesión ni sincroniza datos.
    const navegarSiEstaListo = () => {
      if (activo && esperaMinimaCompletada && interaccionesCompletadas) {
        router.replace('/login');
      }
    };

    const temporizador = setTimeout(() => {
      esperaMinimaCompletada = true;
      navegarSiEstaListo();
    }, DURACION_MINIMA_MS);

    const tareaInteracciones = InteractionManager.runAfterInteractions(() => {
      interaccionesCompletadas = true;
      navegarSiEstaListo();
    });

    return () => {
      activo = false;
      clearTimeout(temporizador);
      tareaInteracciones.cancel();
    };
  }, [router]);
}

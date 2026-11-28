import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { RestauracionSesionScreen } from '@/features/cuenta/components/RestauracionSesionScreen';
import { useRestauracionSesionViewModel } from '@/features/cuenta/hooks/useRestauracionSesionViewModel';
import { suscribirEventosSesion } from '@/services/api/eventosSesion';
import { limpiarSesionSeguraVerificada } from '@/services/sesion.service';

type EstadoCierre = 'inactivo' | 'limpiando' | 'esperandoDestino' | 'errorLimpieza';
type DestinoCierre = '/login' | '/sesion-revocada';

const RUTAS_PUBLICAS = new Set(['/', '/login', '/cambio-dispositivo', '/sesion-revocada']);

export function ProveedorSesion({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [estadoCierre, setEstadoCierre] = useState<EstadoCierre>('inactivo');
  const flujoActivoRef = useRef(false);
  const montadoRef = useRef(false);
  const generacionRef = useRef(0);
  const destinoCierreRef = useRef<DestinoCierre>('/login');
  const pathnameActualRef = useRef(pathname);

  const esRaiz = pathname === '/';
  const esProtegida = !RUTAS_PUBLICAS.has(pathname);
  const requierePuerta = esRaiz || esProtegida;

  const abrirPanel = useCallback(() => router.replace('/panel'), [router]);
  const abrirLogin = useCallback(() => router.replace('/login'), [router]);
  const restauracion = useRestauracionSesionViewModel({
    habilitado: requierePuerta && estadoCierre === 'inactivo',
    onLogin: abrirLogin,
    onPanel: abrirPanel,
  });

  const cerrarSesion = useCallback(
    async (destino: DestinoCierre, limpiezaVerificada: boolean) => {
      const generacion = ++generacionRef.current;
      destinoCierreRef.current = destino;
      flujoActivoRef.current = true;
      setEstadoCierre('limpiando');

      const resultado = limpiezaVerificada
        ? { tipo: 'limpiada' as const }
        : await limpiarSesionSeguraVerificada();
      if (!montadoRef.current || generacion !== generacionRef.current) return;
      if (resultado.tipo === 'errorLimpieza') {
        setEstadoCierre('errorLimpieza');
        return;
      }

      // H-2/RF-02 CA4: la puerta sigue cerrada hasta observar el destino público real.
      setEstadoCierre('esperandoDestino');
      if (pathnameActualRef.current !== destino) router.replace(destino);
    },
    [router],
  );

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      generacionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    pathnameActualRef.current = pathname;
    if (
      estadoCierre !== 'esperandoDestino' ||
      pathname !== destinoCierreRef.current ||
      !flujoActivoRef.current
    ) {
      return;
    }

    const generacion = generacionRef.current;
    const finalizacion = setTimeout(() => {
      if (
        !montadoRef.current ||
        generacion !== generacionRef.current ||
        pathnameActualRef.current !== destinoCierreRef.current
      ) {
        return;
      }
      generacionRef.current += 1;
      flujoActivoRef.current = false;
      setEstadoCierre('inactivo');
    }, 0);
    return () => clearTimeout(finalizacion);
  }, [estadoCierre, pathname]);

  useEffect(
    () =>
      suscribirEventosSesion((evento) => {
        if (flujoActivoRef.current) return;
        if (evento.tipo === 'errorLimpieza') {
          flujoActivoRef.current = true;
          destinoCierreRef.current = '/login';
          generacionRef.current += 1;
          setEstadoCierre('errorLimpieza');
          return;
        }

        const destino = evento.tipo === 'sesionRevocada' ? '/sesion-revocada' : '/login';
        const limpiezaVerificada =
          evento.tipo === 'requiereLogin' && evento.limpiezaVerificada;
        // RF-02 CA4: el proveedor es el único propietario del cierre y de la navegación global.
        void cerrarSesion(destino, limpiezaVerificada);
      }),
    [cerrarSesion],
  );

  useEffect(() => {
    if (esProtegida && restauracion.estado === 'inicio' && estadoCierre === 'inactivo') {
      router.replace('/login');
    }
  }, [esProtegida, estadoCierre, restauracion.estado, router]);

  if (estadoCierre === 'limpiando' || estadoCierre === 'esperandoDestino') {
    return <RestauracionSesionScreen estado="verificando" />;
  }
  if (estadoCierre === 'errorLimpieza') {
    return (
      <RestauracionSesionScreen
        estado="errorLimpieza"
        onReintentar={() => void cerrarSesion(destinoCierreRef.current, false)}
      />
    );
  }

  if (!requierePuerta) return children;
  if (restauracion.estado === 'autorizada' && esProtegida) return children;
  if (restauracion.estado === 'inicio' && esRaiz) return children;
  if (restauracion.estado === 'inicio' || restauracion.estado === 'autorizada') {
    return <RestauracionSesionScreen estado="verificando" />;
  }

  return (
    <RestauracionSesionScreen
      estado={restauracion.estado}
      onReintentar={() => void restauracion.reintentar()}
      procesando={restauracion.procesando}
      segundosRestantes={restauracion.segundosRestantes}
    />
  );
}

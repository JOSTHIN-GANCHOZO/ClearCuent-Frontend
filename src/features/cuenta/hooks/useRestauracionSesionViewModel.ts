import { useCallback, useEffect, useRef, useState } from 'react';

import { authService } from '@/services/auth.service';
import { emitirSesionRevocada } from '@/services/api/eventosSesion';
import {
  actualizarAccesoSeguro,
  limpiarSesionSeguraVerificada,
  obtenerSesionSegura,
} from '@/services/sesion.service';

export type EstadoRestauracionSesion =
  | 'verificando'
  | 'renovando'
  | 'sinConexion'
  | 'limiteSolicitudes'
  | 'errorTecnico'
  | 'errorLimpieza'
  | 'autorizada'
  | 'inicio';

type DestinoLimpieza = 'inicio' | 'login';

type UseRestauracionSesionParams = {
  habilitado?: boolean;
  onPanel: () => void;
  onLogin: () => void;
};

export function useRestauracionSesionViewModel({
  habilitado = true,
  onPanel,
  onLogin,
}: UseRestauracionSesionParams) {
  const [estado, setEstado] = useState<EstadoRestauracionSesion>('verificando');
  const [segundosRestantes, setSegundosRestantes] = useState<number>();
  const [procesando, setProcesando] = useState(false);
  const generacionRef = useRef(0);
  const intentoActivoRef = useRef<number | null>(null);
  const procesandoRef = useRef(false);
  const destinoLimpiezaRef = useRef<DestinoLimpieza>('inicio');
  const esperaHastaRef = useRef<number | undefined>(undefined);
  const onPanelRef = useRef(onPanel);
  const onLoginRef = useRef(onLogin);

  useEffect(() => {
    onPanelRef.current = onPanel;
    onLoginRef.current = onLogin;
  }, [onLogin, onPanel]);

  const esIntentoActual = useCallback(
    (intento: number) =>
      generacionRef.current === intento && intentoActivoRef.current === intento,
    [],
  );

  const iniciarIntento = useCallback((mostrarVerificando: boolean): number | null => {
    if (procesandoRef.current) return null;
    const intento = ++generacionRef.current;
    intentoActivoRef.current = intento;
    procesandoRef.current = true;
    setProcesando(true);
    if (mostrarVerificando) {
      setEstado('verificando');
      setSegundosRestantes(undefined);
      esperaHastaRef.current = undefined;
    }
    return intento;
  }, []);

  const finalizarIntento = useCallback(
    (intento: number) => {
      if (!esIntentoActual(intento)) return;
      intentoActivoRef.current = null;
      procesandoRef.current = false;
      setProcesando(false);
    },
    [esIntentoActual],
  );

  const limpiarYNavegar = useCallback(
    async (destino: DestinoLimpieza, intento: number) => {
      if (!esIntentoActual(intento)) return;
      destinoLimpiezaRef.current = destino;
      const resultado = await limpiarSesionSeguraVerificada();
      if (!esIntentoActual(intento)) return;
      if (resultado.tipo === 'errorLimpieza') {
        setEstado('errorLimpieza');
        return;
      }
      if (destino === 'login') onLoginRef.current();
      else setEstado('inicio');
    },
    [esIntentoActual],
  );

  const restaurar = useCallback(async () => {
    const intento = iniciarIntento(true);
    if (intento === null) return;

    try {
      const lectura = await obtenerSesionSegura();
      if (!esIntentoActual(intento)) return;
      if (lectura.tipo === 'sinSesion') {
        setEstado('inicio');
        return;
      }
      if (lectura.tipo === 'errorLectura') {
        setEstado('errorTecnico');
        return;
      }
      if (lectura.tipo === 'inconsistente') {
        await limpiarYNavegar('inicio', intento);
        return;
      }

      // RF-02 CA4: ambas expiraciones se clasifican con una única lectura del reloj.
      const ahora = Date.now();
      if (Date.parse(lectura.sesion.accesoExpiraEn) > ahora) {
        setEstado('autorizada');
        onPanelRef.current();
        return;
      }
      if (Date.parse(lectura.sesion.renovacionExpiraEn) <= ahora) {
        await limpiarYNavegar('login', intento);
        return;
      }

      setEstado('renovando');
      const renovacion = await authService.renovarSesion(lectura.sesion.tokenRenovacion);
      if (!esIntentoActual(intento)) return;
      if (renovacion.tipo === 'sesionRevocada') {
        emitirSesionRevocada();
        return;
      }
      if (renovacion.tipo === 'requiereLogin') {
        await limpiarYNavegar('login', intento);
        return;
      }
      if (renovacion.tipo === 'sinConexion') {
        setEstado('sinConexion');
        return;
      }
      if (renovacion.tipo === 'limiteSolicitudes') {
        if (renovacion.reintentarEnSegundos === undefined) {
          setEstado('errorTecnico');
          return;
        }
        esperaHastaRef.current = Date.now() + renovacion.reintentarEnSegundos * 1000;
        setSegundosRestantes(renovacion.reintentarEnSegundos);
        setEstado('limiteSolicitudes');
        return;
      }
      if (renovacion.tipo === 'errorTecnico') {
        setEstado('errorTecnico');
        return;
      }

      if (!esIntentoActual(intento)) return;
      const actualizacion = await actualizarAccesoSeguro(
        renovacion.tokenAcceso,
        renovacion.accesoExpiraEn,
      );
      if (!esIntentoActual(intento)) return;
      if (actualizacion.tipo === 'actualizada') {
        setEstado('autorizada');
        onPanelRef.current();
      } else if (actualizacion.tipo === 'requiereLogin') {
        onLoginRef.current();
      } else {
        destinoLimpiezaRef.current = 'login';
        setEstado('errorLimpieza');
      }
    } finally {
      finalizarIntento(intento);
    }
  }, [esIntentoActual, finalizarIntento, iniciarIntento, limpiarYNavegar]);

  const reintentar = useCallback(async () => {
    if (procesandoRef.current) return;
    if (estado !== 'errorLimpieza') {
      await restaurar();
      return;
    }

    const intento = iniciarIntento(false);
    if (intento === null) return;
    try {
      await limpiarYNavegar(destinoLimpiezaRef.current, intento);
    } finally {
      finalizarIntento(intento);
    }
  }, [estado, finalizarIntento, iniciarIntento, limpiarYNavegar, restaurar]);

  useEffect(() => {
    // H-7/RF-02 CA4: cada activación invalida cualquier continuación asíncrona anterior.
    generacionRef.current += 1;
    intentoActivoRef.current = null;
    procesandoRef.current = false;

    if (!habilitado) {
      const reinicio = setTimeout(() => {
        setEstado('verificando');
        setSegundosRestantes(undefined);
        setProcesando(false);
      }, 0);
      return () => {
        clearTimeout(reinicio);
        generacionRef.current += 1;
        intentoActivoRef.current = null;
        procesandoRef.current = false;
      };
    }

    const inicio = setTimeout(() => void restaurar(), 0);
    return () => {
      clearTimeout(inicio);
      generacionRef.current += 1;
      intentoActivoRef.current = null;
      procesandoRef.current = false;
    };
  }, [habilitado, restaurar]);

  useEffect(() => {
    if (
      !habilitado ||
      estado !== 'limiteSolicitudes' ||
      esperaHastaRef.current === undefined
    ) {
      return;
    }
    const actualizar = () => {
      const restantes = Math.max(0, Math.ceil((esperaHastaRef.current! - Date.now()) / 1000));
      setSegundosRestantes(restantes);
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [estado, habilitado]);

  return {
    estado,
    procesando: estado === 'verificando' || estado === 'renovando' || procesando,
    reintentar,
    segundosRestantes,
  };
}

import * as SecureStore from 'expo-secure-store';

export type DatosSesionSegura = {
  tokenAcceso: string;
  tokenRenovacion: string;
  accesoExpiraEn: string;
  renovacionExpiraEn: string;
};

export type ResultadoLecturaSesion =
  | { tipo: 'sinSesion' }
  | { tipo: 'sesion'; sesion: DatosSesionSegura }
  | { tipo: 'inconsistente' }
  | { tipo: 'errorLectura' };

export type ResultadoLimpiezaSesion = { tipo: 'limpiada' } | { tipo: 'errorLimpieza' };

export type ResultadoActualizacionAcceso =
  | { tipo: 'actualizada' }
  | { tipo: 'requiereLogin' }
  | { tipo: 'errorLimpieza' };

const CLAVES_SESION = {
  tokenAcceso: 'sesion.tokenAcceso',
  tokenRenovacion: 'sesion.tokenRenovacion',
  accesoExpiraEn: 'sesion.accesoExpiraEn',
  renovacionExpiraEn: 'sesion.renovacionExpiraEn',
} as const;

let colaSesion: Promise<void> = Promise.resolve();

function serializarOperacion<T>(operacion: () => Promise<T>): Promise<T> {
  const resultado = colaSesion.then(operacion);
  // RF-02 CA4: un rechazo no rompe la serialización de las operaciones posteriores.
  colaSesion = resultado.then(
    () => undefined,
    () => undefined,
  );
  return resultado;
}

export function esFechaIsoUtcValida(valor: string): boolean {
  const partes =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(valor);
  if (!partes) return false;

  const [, anoTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto] = partes;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  const segundo = Number(segundoTexto);
  if (mes < 1 || mes > 12 || hora > 23 || minuto > 59 || segundo > 59) return false;

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia >= 1 && dia <= ultimoDia && Number.isFinite(Date.parse(valor));
}

async function leerClavesSinCola(): Promise<Record<keyof DatosSesionSegura, string | null>> {
  const resultados = await Promise.allSettled([
    SecureStore.getItemAsync(CLAVES_SESION.tokenAcceso),
    SecureStore.getItemAsync(CLAVES_SESION.tokenRenovacion),
    SecureStore.getItemAsync(CLAVES_SESION.accesoExpiraEn),
    SecureStore.getItemAsync(CLAVES_SESION.renovacionExpiraEn),
  ]);
  if (resultados.some((resultado) => resultado.status === 'rejected')) {
    throw new Error('sesion_no_leida');
  }
  const [tokenAcceso, tokenRenovacion, accesoExpiraEn, renovacionExpiraEn] = resultados.map(
    (resultado) => (resultado.status === 'fulfilled' ? resultado.value : null),
  );
  return { tokenAcceso, tokenRenovacion, accesoExpiraEn, renovacionExpiraEn };
}

async function limpiarSesionSinCola(): Promise<ResultadoLimpiezaSesion> {
  await Promise.allSettled(
    Object.values(CLAVES_SESION).map((clave) => SecureStore.deleteItemAsync(clave)),
  );
  try {
    const valores = await leerClavesSinCola();
    return Object.values(valores).every((valor) => valor === null)
      ? { tipo: 'limpiada' }
      : { tipo: 'errorLimpieza' };
  } catch {
    return { tipo: 'errorLimpieza' };
  }
}

export function obtenerSesionSegura(): Promise<ResultadoLecturaSesion> {
  return serializarOperacion(async () => {
    try {
      const valores = await leerClavesSinCola();
      const lista = Object.values(valores);
      if (lista.every((valor) => valor === null)) return { tipo: 'sinSesion' };

      if (
        lista.some((valor) => valor === null || valor.trim().length === 0) ||
        !esFechaIsoUtcValida(valores.accesoExpiraEn ?? '') ||
        !esFechaIsoUtcValida(valores.renovacionExpiraEn ?? '')
      ) {
        return { tipo: 'inconsistente' };
      }

      return { tipo: 'sesion', sesion: valores as DatosSesionSegura };
    } catch {
      return { tipo: 'errorLectura' };
    }
  });
}

export function limpiarSesionSeguraVerificada(): Promise<ResultadoLimpiezaSesion> {
  return serializarOperacion(limpiarSesionSinCola);
}

export async function limpiarSesionSegura(): Promise<void> {
  await limpiarSesionSeguraVerificada();
}

export function guardarSesionSegura(sesion: DatosSesionSegura): Promise<void> {
  return serializarOperacion(async () => {
    try {
      // RF-02 CA4: tokens y expiraciones se conservan exclusivamente en SecureStore.
      await SecureStore.setItemAsync(CLAVES_SESION.tokenAcceso, sesion.tokenAcceso);
      await SecureStore.setItemAsync(CLAVES_SESION.tokenRenovacion, sesion.tokenRenovacion);
      await SecureStore.setItemAsync(CLAVES_SESION.accesoExpiraEn, sesion.accesoExpiraEn);
      await SecureStore.setItemAsync(CLAVES_SESION.renovacionExpiraEn, sesion.renovacionExpiraEn);
    } catch {
      // Operación interna sin cola: evita un bloqueo recursivo durante la compensación.
      await limpiarSesionSinCola();
      throw new Error('sesion_no_persistida');
    }
  });
}

export function actualizarAccesoSeguro(
  tokenAcceso: string,
  accesoExpiraEn: string,
): Promise<ResultadoActualizacionAcceso> {
  return serializarOperacion(async () => {
    try {
      await SecureStore.setItemAsync(CLAVES_SESION.tokenAcceso, tokenAcceso);
      await SecureStore.setItemAsync(CLAVES_SESION.accesoExpiraEn, accesoExpiraEn);
      return { tipo: 'actualizada' };
    } catch {
      const limpieza = await limpiarSesionSinCola();
      return limpieza.tipo === 'limpiada'
        ? { tipo: 'requiereLogin' }
        : { tipo: 'errorLimpieza' };
    }
  });
}

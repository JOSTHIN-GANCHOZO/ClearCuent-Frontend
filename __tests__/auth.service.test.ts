import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import type { LoginForm } from '@/features/cuenta/schemas/login.schema';
import { authService } from '@/services/auth.service';
import * as SesionService from '@/services/sesion.service';

const mockPost = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({}));

jest.mock('@/services/api/clienteApi', () => ({ crearClienteApi: () => ({ post: mockPost }) }));
jest.mock('@/services/api/configuracionApi', () => ({
  obtenerUrlEndpoint: (ruta: string) => `https://api.example.test${ruta}`,
}));
jest.mock('@/services/dispositivo.service', () => ({
  obtenerDispositivoId: async () => '11111111-1111-4111-8111-111111111111',
}));

const CREDENCIALES: LoginForm = {
  correo: 'comerciante@example.test',
  contrasena: 'Clave-Sintetica-1',
};

const RESPUESTA_VALIDA = {
  datos: {
    sesion: {
      accesoExpiraEn: '2026-11-21T15:15:00.000Z',
      dispositivoId: '11111111-1111-4111-8111-111111111111',
      renovacionExpiraEn: '2026-12-21T15:00:00.000Z',
      tokenAcceso: 'token-acceso-sintetico',
      tokenRenovacion: 'token-renovacion-sintetico',
    },
    usuario: {
      correo: CREDENCIALES.correo,
      id: '33333333-3333-4333-8333-333333333333',
      nombre: 'Comerciante sintetico',
      negocio: 'Negocio sintetico',
      rol: 'MERCHANT',
      zonaHoraria: 'America/Guayaquil',
    },
  },
};

function crearErrorAxios(
  status: number,
  codigo: string,
  headers: Record<string, string> = {},
): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const respuesta: AxiosResponse = {
    config,
    data: { error: { codigo, mensaje: 'mensaje sintetico' } },
    headers,
    status,
    statusText: '',
  };
  return new AxiosError(
    'respuesta rechazada sintetica',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    respuesta,
  );
}

const guardarSesion = jest
  .spyOn(SesionService, 'guardarSesionSegura')
  .mockResolvedValue(undefined);

describe('auth.service — mapeo de respuestas de autenticacion', () => {
  beforeEach(() => {
    mockPost.mockReset();
    guardarSesion.mockClear();
    authService.cancelarCambioDispositivo();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('RF-02 CA3: convierte 429 acceso_bloqueado y Retry-After en bloqueado con espera', async () => {
    mockPost.mockRejectedValueOnce(
      crearErrorAxios(429, 'acceso_bloqueado', { 'retry-after': '900' }),
    );

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'bloqueado', reintentarEnSegundos: 900 });
  });

  test('RF-02 CA3: deja sin espera explicita el bloqueo cuando no hay Retry-After', async () => {
    mockPost.mockRejectedValueOnce(crearErrorAxios(429, 'acceso_bloqueado'));

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    // El viewmodel aplica el valor por defecto de 15 minutos (RF-02 CA3).
    expect(resultado).toStrictEqual({ tipo: 'bloqueado', reintentarEnSegundos: undefined });
  });

  test('RF-02 CA3: interpreta Retry-After en formato fecha como segundos restantes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-21T15:00:00.000Z'));
    mockPost.mockRejectedValueOnce(
      crearErrorAxios(429, 'acceso_bloqueado', {
        'retry-after': '2026-11-21T15:05:00.000Z',
      }),
    );

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'bloqueado', reintentarEnSegundos: 300 });
  });

  test('RF-02 CA3: convierte 429 limite_solicitudes en limiteSolicitudes', async () => {
    mockPost.mockRejectedValueOnce(
      crearErrorAxios(429, 'limite_solicitudes', { 'retry-after': '30' }),
    );

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'limiteSolicitudes', reintentarEnSegundos: 30 });
  });

  test('RF-02 CA2: conserva credenciales incorrectas ante 401 credenciales_invalidas', async () => {
    mockPost.mockRejectedValueOnce(crearErrorAxios(401, 'credenciales_invalidas'));

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'credencialesIncorrectas' });
  });

  test('RF-07 CA5: el codigo 401 sesion_revocada produce el estado de sesion revocada', async () => {
    // Contrato segun DERCAS 5.3/5.6.6: 401 sesion_revocada (RF-07 CA5).
    // Caso dependiente del mapper que A4 ajusta en paralelo.
    mockPost.mockRejectedValueOnce(crearErrorAxios(401, 'sesion_revocada'));

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'sesionRevocada' });
  });

  test('RF-02 CA4: un login valido persiste la sesion emitida por el servidor', async () => {
    mockPost.mockResolvedValueOnce({ data: RESPUESTA_VALIDA });

    const resultado = await authService.iniciarSesion(CREDENCIALES);

    expect(resultado).toStrictEqual({ tipo: 'exito' });
    expect(guardarSesion).toHaveBeenCalledTimes(1);
    expect(guardarSesion).toHaveBeenCalledWith(RESPUESTA_VALIDA.datos.sesion);
  });
});

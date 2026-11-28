import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { crearClienteAutenticado } from '@/services/api/clienteAutenticado';
import { authService } from '@/services/auth.service';
import * as Eventos from '@/services/api/eventosSesion';
import * as Sesion from '@/services/sesion.service';

type InterceptorPeticion = (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>;
type InterceptorError = (error: unknown) => Promise<unknown>;

let interceptorPeticion: InterceptorPeticion;
let interceptorError: InterceptorError;
const mockRequest = jest.fn(async (config: InternalAxiosRequestConfig) => ({ config }));
const mockClienteFalso = {
  interceptors: {
    request: { use: (fn: InterceptorPeticion) => (interceptorPeticion = fn) },
    response: { use: (_ok: unknown, fn: InterceptorError) => (interceptorError = fn) },
  },
  request: mockRequest,
};

jest.mock('@/services/api/clienteApi', () => ({ crearClienteApi: () => mockClienteFalso }));
jest.mock('@/services/auth.service', () => ({ authService: { renovarSesion: jest.fn() } }));
jest.mock('@/services/sesion.service', () => ({
  obtenerSesionSegura: jest.fn(),
  actualizarAccesoSeguro: jest.fn(),
  limpiarSesionSeguraVerificada: jest.fn(),
}));
jest.mock('@/services/api/eventosSesion', () => ({
  emitirSesionRevocada: jest.fn(),
  emitirRequiereLogin: jest.fn(),
  emitirErrorLimpieza: jest.fn(),
}));

const obtener = Sesion.obtenerSesionSegura as jest.MockedFunction<typeof Sesion.obtenerSesionSegura>;
const actualizar = Sesion.actualizarAccesoSeguro as jest.MockedFunction<
  typeof Sesion.actualizarAccesoSeguro
>;
const renovar = authService.renovarSesion as jest.MockedFunction<typeof authService.renovarSesion>;
const emitir = Eventos.emitirSesionRevocada as jest.MockedFunction<typeof Eventos.emitirSesionRevocada>;
const emitirLogin = Eventos.emitirRequiereLogin as jest.MockedFunction<
  typeof Eventos.emitirRequiereLogin
>;
const emitirErrorLimpieza = Eventos.emitirErrorLimpieza as jest.MockedFunction<
  typeof Eventos.emitirErrorLimpieza
>;

const SESION = {
  tokenAcceso: 'access-vencido',
  tokenRenovacion: 'refresh-estable',
  accesoExpiraEn: '2026-11-27T11:00:00.000Z',
  renovacionExpiraEn: '2026-12-27T12:00:00.000Z',
};

function config(method: string): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders(), method, url: '/recurso' } as InternalAxiosRequestConfig;
}

function error401(codigo: string, configuracion = config('get')): AxiosError {
  return new AxiosError(
    '401 sintetico',
    'ERR_BAD_RESPONSE',
    configuracion,
    undefined,
    {
      config: configuracion,
      data: { error: { codigo } },
      headers: {},
      status: 401,
      statusText: '',
    },
  );
}

describe('RF-02 REST — cliente autenticado', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));
    jest.clearAllMocks();
    actualizar.mockResolvedValue({ tipo: 'actualizada' });
    crearClienteAutenticado();
  });

  test('RF-02 CA4: dos solicitudes concurrentes comparten una única renovación', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION });
    let resolver!: (valor: { tipo: 'exito'; tokenAcceso: string; accesoExpiraEn: string }) => void;
    renovar.mockImplementationOnce(
      () => new Promise((resolve) => (resolver = resolve)),
    );
    const primera = interceptorPeticion(config('get'));
    const segunda = interceptorPeticion(config('head'));
    await Promise.resolve();
    expect(renovar).toHaveBeenCalledTimes(1);
    resolver({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    const [a, b] = await Promise.all([primera, segunda]);
    expect(a.headers.get('Authorization')).toBe('Bearer access-nuevo');
    expect(b.headers.get('Authorization')).toBe('Bearer access-nuevo');
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  test.each(['get', 'head'])(
    'RF-02 CA4: %s con token_vencido se repite exactamente una vez',
    async (method) => {
      obtener.mockResolvedValue({ tipo: 'sesion', sesion: { ...SESION, accesoExpiraEn: '2026-11-27T12:10:00.000Z' } });
      renovar.mockResolvedValue({
        tipo: 'exito',
        tokenAcceso: 'access-nuevo',
        accesoExpiraEn: '2026-11-27T12:15:00.000Z',
      });
      const configuracion = config(method);
      await interceptorError(error401('token_vencido', configuracion));
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(configuracion.reintentoSesionRealizado).toBe(true);
      expect(configuracion.headers.get('Authorization')).toBe('Bearer access-nuevo');
    },
  );

  test('RF-02 CA4: escritura no elegible renueva para el futuro pero no se repite', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION });
    renovar.mockResolvedValue({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    await expect(interceptorError(error401('token_vencido', config('post')))).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(renovar).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: segundo 401 tras reintento real no inicia otro ciclo', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: { ...SESION, accesoExpiraEn: '2026-11-27T12:10:00.000Z' } });
    renovar.mockResolvedValue({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    const configuracion = config('get');
    mockRequest.mockImplementationOnce(async (configReintentado: InternalAxiosRequestConfig) => {
      throw error401('token_vencido', configReintentado);
    });

    await expect(interceptorError(error401('token_vencido', configuracion))).rejects.toBeInstanceOf(
      AxiosError,
    );

    expect(renovar).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(configuracion.reintentoSesionRealizado).toBe(true);
  });

  test('RF-02 CA4: refresh vencido localmente bloquea la solicitud y emite requiereLogin', async () => {
    obtener.mockResolvedValue({
      tipo: 'sesion',
      sesion: { ...SESION, renovacionExpiraEn: '2026-11-27T12:00:00.000Z' },
    });
    await expect(interceptorPeticion(config('get'))).rejects.toMatchObject({
      codigo: 'sesion_no_disponible',
    });
    expect(emitirLogin).toHaveBeenCalledWith(false);
    expect(renovar).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: refresh rechazado por servidor emite requiereLogin con limpieza pendiente', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION });
    renovar.mockResolvedValue({ tipo: 'requiereLogin' });
    await expect(interceptorPeticion(config('get'))).rejects.toMatchObject({
      codigo: 'sesion_no_disponible',
    });
    expect(emitirLogin).toHaveBeenCalledWith(false);
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: fallo de persistencia con limpieza verificada emite requiereLogin limpiado', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION });
    renovar.mockResolvedValue({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    actualizar.mockResolvedValue({ tipo: 'requiereLogin' });
    await expect(interceptorPeticion(config('get'))).rejects.toMatchObject({
      codigo: 'sesion_no_disponible',
    });
    expect(emitirLogin).toHaveBeenCalledWith(true);
    expect(emitirErrorLimpieza).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: fallo de persistencia y limpieza fallida emite errorLimpieza tipado', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION });
    renovar.mockResolvedValue({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    actualizar.mockResolvedValue({ tipo: 'errorLimpieza' });
    await expect(interceptorPeticion(config('get'))).rejects.toMatchObject({
      codigo: 'sesion_no_disponible',
    });
    expect(emitirErrorLimpieza).toHaveBeenCalledTimes(1);
    expect(emitirLogin).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: 401 token_invalido no renueva ni repite y emite requiereLogin', async () => {
    await expect(interceptorError(error401('token_invalido'))).rejects.toBeInstanceOf(AxiosError);
    expect(emitirLogin).toHaveBeenCalledWith(false);
    expect(renovar).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test('RF-02 CA4 / RF-07 CA5: sesion_revocada emite una vez y no renueva ni reintenta', async () => {
    await expect(interceptorError(error401('sesion_revocada'))).rejects.toBeInstanceOf(AxiosError);
    expect(emitir).toHaveBeenCalledTimes(1);
    expect(renovar).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

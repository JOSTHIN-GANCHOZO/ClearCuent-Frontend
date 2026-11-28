import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { authService } from '@/services/auth.service';

const mockPost = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({}));
jest.mock('@/services/api/clienteApi', () => ({ crearClienteApi: () => ({ post: mockPost }) }));
jest.mock('@/services/api/configuracionApi', () => ({
  obtenerUrlEndpoint: (ruta: string) => `https://api.example.test${ruta}`,
}));
jest.mock('@/services/dispositivo.service', () => ({ obtenerDispositivoId: jest.fn() }));

function errorAxios(status: number, codigo: string, retryAfter?: string): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const respuesta: AxiosResponse = {
    config,
    data: { error: { codigo, mensaje: 'mensaje sintetico' } },
    headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
    status,
    statusText: '',
  };
  return new AxiosError('fallo sintetico', 'ERR_BAD_RESPONSE', config, undefined, respuesta);
}

describe('RF-02 REST — contrato estricto de renovación', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('RF-02 CA4: envía Bearer refresh sin cuerpo y acepta la respuesta estricta', async () => {
    mockPost.mockResolvedValueOnce({
      data: { datos: { tokenAcceso: 'access-nuevo', accesoExpiraEn: '2026-11-27T12:15:00.000Z' } },
    });
    await expect(authService.renovarSesion('refresh-sintetico')).resolves.toStrictEqual({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/renovar',
      undefined,
      { headers: { Authorization: 'Bearer refresh-sintetico' } },
    );
  });

  test.each([
    ['campo extra', { datos: { tokenAcceso: 'a', accesoExpiraEn: '2026-11-27T12:15:00.000Z', extra: true } }],
    ['refresh devuelto', { datos: { tokenAcceso: 'a', accesoExpiraEn: '2026-11-27T12:15:00.000Z', tokenRenovacion: 'r' } }],
    ['fecha inválida', { datos: { tokenAcceso: 'a', accesoExpiraEn: '27/11/2026' } }],
    ['token vacío', { datos: { tokenAcceso: ' ', accesoExpiraEn: '2026-11-27T12:15:00.000Z' } }],
    ['envoltura extra', { datos: { tokenAcceso: 'a', accesoExpiraEn: '2026-11-27T12:15:00.000Z' }, extra: true }],
  ])('RF-02 CA4 (RN 5.5.4): rechaza respuesta 200 con %s', async (_caso, data) => {
    mockPost.mockResolvedValueOnce({ data });
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'errorTecnico',
    });
  });

  test.each(['token_invalido', 'token_vencido'])(
    'RF-02 CA4: 401 %s exige login',
    async (codigo) => {
      mockPost.mockRejectedValueOnce(errorAxios(401, codigo));
      await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
        tipo: 'requiereLogin',
      });
    },
  );

  test('RF-02 CA4 / RF-07 CA5: 401 sesion_revocada se distingue globalmente', async () => {
    mockPost.mockRejectedValueOnce(errorAxios(401, 'sesion_revocada'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'sesionRevocada',
    });
  });

  test('RF-02 CA4 (RNF-05): 429 con Retry-After válido conserva la espera', async () => {
    mockPost.mockRejectedValueOnce(errorAxios(429, 'limite_solicitudes', '90'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'limiteSolicitudes',
      reintentarEnSegundos: 90,
    });
  });

  test('RF-02 CA4 (RNF-05): 429 sin Retry-After válido no inventa espera', async () => {
    mockPost.mockRejectedValueOnce(errorAxios(429, 'limite_solicitudes', 'invalido'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'limiteSolicitudes',
      reintentarEnSegundos: undefined,
    });
  });

  test.each(['', '   '])(
    'RF-02 CA4 (RNF-05): Retry-After %p es inválido y no inventa espera',
    async (retryAfter) => {
      mockPost.mockRejectedValueOnce(errorAxios(429, 'limite_solicitudes', retryAfter));
      await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
        tipo: 'limiteSolicitudes',
        reintentarEnSegundos: undefined,
      });
    },
  );

  test('RF-02 CA4 (RNF-05): Retry-After en segundos se redondea hacia arriba', async () => {
    mockPost.mockRejectedValueOnce(errorAxios(429, 'limite_solicitudes', '1.2'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'limiteSolicitudes',
      reintentarEnSegundos: 2,
    });
  });

  test('RF-02 CA4 (RNF-05): Retry-After con fecha HTTP válida calcula la espera', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));
    mockPost.mockRejectedValueOnce(
      errorAxios(429, 'limite_solicitudes', 'Fri, 27 Nov 2026 12:01:30 GMT'),
    );
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'limiteSolicitudes',
      reintentarEnSegundos: 90,
    });
  });

  test('RF-02 CA4: fallo de red es recuperable y distinto de 5xx', async () => {
    mockPost.mockRejectedValueOnce(new AxiosError('sin red', 'ERR_NETWORK'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'sinConexion',
    });
    mockPost.mockRejectedValueOnce(errorAxios(503, 'servicio_no_disponible'));
    await expect(authService.renovarSesion('refresh')).resolves.toStrictEqual({
      tipo: 'errorTecnico',
    });
  });
});

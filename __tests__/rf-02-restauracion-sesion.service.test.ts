import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  actualizarAccesoSeguro,
  limpiarSesionSeguraVerificada,
  obtenerSesionSegura,
} from '@/services/sesion.service';

const almacen = new Map<string, string>();
let falloLectura = false;
let claveNoEliminada: string | undefined;
let liberarEscritura: (() => void) | undefined;

const mockGetItemAsync = jest.fn(async (clave: string) => {
  if (falloLectura) throw new Error('fallo sintetico de lectura');
  return almacen.get(clave) ?? null;
});
const mockSetItemAsync = jest.fn(async (clave: string, valor: string) => {
  if (liberarEscritura) await new Promise<void>((resolve) => (liberarEscritura = resolve));
  almacen.set(clave, valor);
});
const mockDeleteItemAsync = jest.fn(async (clave: string) => {
  if (clave !== claveNoEliminada) almacen.delete(clave);
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: (clave: string) => mockGetItemAsync(clave),
  setItemAsync: (clave: string, valor: string) => mockSetItemAsync(clave, valor),
  deleteItemAsync: (clave: string) => mockDeleteItemAsync(clave),
}));

const sesionCompleta = {
  'sesion.tokenAcceso': 'access-anterior',
  'sesion.tokenRenovacion': 'refresh-estable',
  'sesion.accesoExpiraEn': '2026-11-27T12:00:00.000Z',
  'sesion.renovacionExpiraEn': '2026-12-27T12:00:00.000Z',
};

function cargar(valores: Record<string, string> = sesionCompleta) {
  Object.entries(valores).forEach(([clave, valor]) => almacen.set(clave, valor));
}

describe('RF-02 REST — unidad lógica de SecureStore', () => {
  beforeEach(() => {
    almacen.clear();
    falloLectura = false;
    claveNoEliminada = undefined;
    liberarEscritura = undefined;
    jest.clearAllMocks();
  });

  test('RF-02 CA1/CA4: cuatro claves ausentes producen sinSesion', async () => {
    await expect(obtenerSesionSegura()).resolves.toStrictEqual({ tipo: 'sinSesion' });
  });

  test('RF-02 CA4: cuatro claves completas y fechas ISO válidas producen sesión', async () => {
    cargar();
    const resultado = await obtenerSesionSegura();
    expect(resultado).toStrictEqual({
      tipo: 'sesion',
      sesion: {
        tokenAcceso: 'access-anterior',
        tokenRenovacion: 'refresh-estable',
        accesoExpiraEn: '2026-11-27T12:00:00.000Z',
        renovacionExpiraEn: '2026-12-27T12:00:00.000Z',
      },
    });
  });

  test.each([
    ['parcial', { 'sesion.tokenAcceso': 'access' }],
    ['token vacío', { ...sesionCompleta, 'sesion.tokenAcceso': '  ' }],
    ['fecha imposible', { ...sesionCompleta, 'sesion.accesoExpiraEn': '2026-02-30T12:00:00Z' }],
    ['fecha sin UTC', { ...sesionCompleta, 'sesion.accesoExpiraEn': '2026-11-27T12:00:00-05:00' }],
  ])('RF-02 CA4: estado %s se clasifica como inconsistente', async (_caso, valores) => {
    cargar(valores);
    await expect(obtenerSesionSegura()).resolves.toStrictEqual({ tipo: 'inconsistente' });
  });

  test('RF-02 CA4: error de lectura no elimina las claves existentes', async () => {
    cargar();
    falloLectura = true;
    await expect(obtenerSesionSegura()).resolves.toStrictEqual({ tipo: 'errorLectura' });
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
    expect(almacen.size).toBe(4);
  });

  test('RF-02 CA4: actualizar access conserva exactamente el refresh y su expiración', async () => {
    cargar();
    await expect(
      actualizarAccesoSeguro('access-nuevo', '2026-11-27T12:15:00.000Z'),
    ).resolves.toStrictEqual({ tipo: 'actualizada' });
    expect(almacen.get('sesion.tokenAcceso')).toBe('access-nuevo');
    expect(almacen.get('sesion.accesoExpiraEn')).toBe('2026-11-27T12:15:00.000Z');
    expect(almacen.get('sesion.tokenRenovacion')).toBe('refresh-estable');
    expect(almacen.get('sesion.renovacionExpiraEn')).toBe('2026-12-27T12:00:00.000Z');
  });

  test('RF-02 CA4: limpieza verificada informa error si una clave permanece', async () => {
    cargar();
    claveNoEliminada = 'sesion.tokenRenovacion';
    await expect(limpiarSesionSeguraVerificada()).resolves.toStrictEqual({
      tipo: 'errorLimpieza',
    });
    expect(almacen.get('sesion.tokenRenovacion')).toBe('refresh-estable');
  });

  test('RF-02 CA4: la cola hace que una lectura espere la actualización completa', async () => {
    cargar();
    let resolverPrimera!: () => void;
    const espera = new Promise<void>((resolve) => (resolverPrimera = resolve));
    mockSetItemAsync.mockImplementationOnce(async (clave: string, valor: string) => {
      await espera;
      almacen.set(clave, valor);
    });
    const actualizacion = actualizarAccesoSeguro('access-nuevo', '2026-11-27T12:15:00.000Z');
    const lectura = obtenerSesionSegura();
    await Promise.resolve();
    expect(mockGetItemAsync).not.toHaveBeenCalled();
    resolverPrimera();
    await expect(actualizacion).resolves.toStrictEqual({ tipo: 'actualizada' });
    await expect(lectura).resolves.toMatchObject({
      tipo: 'sesion',
      sesion: { tokenAcceso: 'access-nuevo', accesoExpiraEn: '2026-11-27T12:15:00.000Z' },
    });
  });

  test('RF-02 CA4: la cola continúa después de una operación que rechaza', async () => {
    cargar();
    mockSetItemAsync.mockRejectedValueOnce(new Error('fallo sintetico'));
    await expect(
      actualizarAccesoSeguro('access-nuevo', '2026-11-27T12:15:00.000Z'),
    ).resolves.toStrictEqual({ tipo: 'requiereLogin' });
    await expect(obtenerSesionSegura()).resolves.toStrictEqual({ tipo: 'sinSesion' });
  });

  test('RF-02 CA4: falla la segunda escritura y una limpieza incompleta devuelve errorLimpieza', async () => {
    cargar();
    mockSetItemAsync
      .mockImplementationOnce(async (clave: string, valor: string) => {
        almacen.set(clave, valor);
      })
      .mockRejectedValueOnce(new Error('fallo sintetico en expiracion'));
    claveNoEliminada = 'sesion.tokenAcceso';

    await expect(
      actualizarAccesoSeguro('access-nuevo', '2026-11-27T12:15:00.000Z'),
    ).resolves.toStrictEqual({ tipo: 'errorLimpieza' });
    expect(mockSetItemAsync).toHaveBeenCalledTimes(2);
    expect(mockDeleteItemAsync).toHaveBeenCalledTimes(4);
    expect(almacen.get('sesion.tokenAcceso')).toBe('access-nuevo');
    expect(await obtenerSesionSegura()).toStrictEqual({ tipo: 'inconsistente' });
  });
});

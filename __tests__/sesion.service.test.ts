import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

import {
  guardarSesionSegura,
  limpiarSesionSegura,
  type DatosSesionSegura,
} from '@/services/sesion.service';

// Almacen sintetico en memoria: comprueba el efecto observable sobre SecureStore,
// no el cifrado nativo (RNF-01 requiere build/dispositivo, fuera de esta suite).
const mockAlmacen = new Map<string, string>();
const mockSetItem = jest.fn(async (clave: string, valor: string): Promise<void> => {
  mockAlmacen.set(clave, valor);
});
const mockGetItem = jest.fn(async (clave: string): Promise<string | null> =>
  mockAlmacen.get(clave) ?? null,
);
const mockDeleteItem = jest.fn(async (clave: string): Promise<void> => {
  mockAlmacen.delete(clave);
});

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: (clave: string) => mockDeleteItem(clave),
  getItemAsync: (clave: string) => mockGetItem(clave),
  setItemAsync: (clave: string, valor: string) => mockSetItem(clave, valor),
}));

const SESION: DatosSesionSegura = {
  accesoExpiraEn: '2026-11-21T15:15:00.000Z',
  renovacionExpiraEn: '2026-12-21T15:00:00.000Z',
  tokenAcceso: 'token-acceso-sintetico',
  tokenRenovacion: 'token-renovacion-sintetico',
};

describe('sesion.service — persistencia segura', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    jest.clearAllMocks();
  });

  test('RF-02 CA4: tokens y expiraciones quedan persistidos y legibles en secure store', async () => {
    await guardarSesionSegura(SESION);

    expect(mockSetItem).toHaveBeenCalledWith('sesion.tokenAcceso', SESION.tokenAcceso);
    expect(mockSetItem).toHaveBeenCalledWith('sesion.tokenRenovacion', SESION.tokenRenovacion);
    expect(mockSetItem).toHaveBeenCalledTimes(4);
    expect(await SecureStore.getItemAsync('sesion.tokenAcceso')).toBe(SESION.tokenAcceso);
    expect(await SecureStore.getItemAsync('sesion.tokenRenovacion')).toBe(SESION.tokenRenovacion);
    expect(await SecureStore.getItemAsync('sesion.accesoExpiraEn')).toBe(SESION.accesoExpiraEn);
    expect(await SecureStore.getItemAsync('sesion.renovacionExpiraEn')).toBe(
      SESION.renovacionExpiraEn,
    );
  });

  test('RF-02 CA4: las expiraciones de acceso y renovacion se conservan sin alterar', async () => {
    await guardarSesionSegura(SESION);

    // Las duraciones de 15 minutos y 30 dias las emite el servidor (RF-02 CA4);
    // este servicio solo conserva los valores, sin recalcularlos ni acortarlos.
    expect(mockSetItem).toHaveBeenCalledWith('sesion.accesoExpiraEn', '2026-11-21T15:15:00.000Z');
    expect(mockSetItem).toHaveBeenCalledWith(
      'sesion.renovacionExpiraEn',
      '2026-12-21T15:00:00.000Z',
    );
  });

  test('RF-02 CA4: una escritura fallida limpia la sesion y no deja un token utilizable', async () => {
    mockAlmacen.set('sesion.tokenAcceso', 'token-anterior-sintetico');
    mockSetItem.mockRejectedValueOnce(new Error('fallo de escritura sintetico'));

    await expect(guardarSesionSegura(SESION)).rejects.toThrow('sesion_no_persistida');

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockDeleteItem).toHaveBeenCalledTimes(4);
    expect(mockAlmacen.size).toBe(0);
    expect(await SecureStore.getItemAsync('sesion.tokenAcceso')).toBeNull();
  });

  test('RF-02 CA4: limpiarSesionSegura elimina las cuatro claves de la sesion', async () => {
    await guardarSesionSegura(SESION);

    await limpiarSesionSegura();

    expect(mockDeleteItem).toHaveBeenCalledTimes(4);
    expect(mockAlmacen.size).toBe(0);
  });
});

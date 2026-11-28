import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const UUID_GENERADO = '11111111-1111-4111-8111-111111111111';
const UUID_ALMACENADO = '22222222-2222-4222-8222-222222222222';

const mockAlmacen = new Map<string, string>();
const mockRandomUUID = jest.fn((): string => UUID_GENERADO);
const mockGetItem = jest.fn(async (clave: string): Promise<string | null> =>
  mockAlmacen.get(clave) ?? null,
);
const mockSetItem = jest.fn(async (clave: string, valor: string): Promise<void> => {
  mockAlmacen.set(clave, valor);
});

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: (clave: string) => mockGetItem(clave),
  setItemAsync: (clave: string, valor: string) => mockSetItem(clave, valor),
}));

type ServicioDispositivo = typeof import('@/services/dispositivo.service');

// El servicio memoriza la promesa a nivel de modulo: se recarga el modulo en cada caso.
// require() es necesario porque este Jest no habilita --experimental-vm-modules.
function cargarServicio(): ServicioDispositivo {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/dispositivo.service') as ServicioDispositivo;
}

describe('dispositivo.service — identidad de la instalacion', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    jest.resetModules();
  });

  test('RF-07 CA1: genera un UUID unico y lo reutiliza en llamadas posteriores', async () => {
    const { obtenerDispositivoId } = cargarServicio();

    const primero = await obtenerDispositivoId();
    const segundo = await obtenerDispositivoId();

    expect(primero).toBe(UUID_GENERADO);
    expect(segundo).toBe(UUID_GENERADO);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith('dispositivoId', UUID_GENERADO);
  });

  test('RF-07 CA1: solicitudes concurrentes comparten un solo UUID', async () => {
    const { obtenerDispositivoId } = cargarServicio();

    const ids = await Promise.all([
      obtenerDispositivoId(),
      obtenerDispositivoId(),
      obtenerDispositivoId(),
    ]);

    expect(ids).toEqual([UUID_GENERADO, UUID_GENERADO, UUID_GENERADO]);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  test('RF-07 CA1: reutiliza un UUID valido ya almacenado sin generar otro', async () => {
    mockAlmacen.set('dispositivoId', UUID_ALMACENADO);
    const { obtenerDispositivoId } = cargarServicio();

    const id = await obtenerDispositivoId();

    expect(id).toBe(UUID_ALMACENADO);
    expect(mockRandomUUID).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  test('RF-07 CA1: rechaza un identificador local corrupto sin inventar otro', async () => {
    mockAlmacen.set('dispositivoId', 'identificador-no-uuid');
    const { obtenerDispositivoId } = cargarServicio();

    await expect(obtenerDispositivoId()).rejects.toThrow('identificador_dispositivo_invalido');
    await expect(obtenerDispositivoId()).rejects.toThrow('identificador_dispositivo_invalido');

    expect(mockRandomUUID).not.toHaveBeenCalled();
    expect(mockGetItem).toHaveBeenCalledTimes(2);
  });
});

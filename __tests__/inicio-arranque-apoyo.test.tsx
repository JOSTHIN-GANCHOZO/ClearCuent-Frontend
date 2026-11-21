import { act, cleanup, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import IndexRoute from '../app/index';

const mockReplace = jest.fn();
let siguienteIdleId = 1;
let tareasIdle = new Map<number, () => void>();
const mockRequestIdleCallback = jest.fn((tarea: () => void) => {
  const id = siguienteIdleId++;
  tareasIdle.set(id, tarea);
  return id;
});
const mockCancelIdleCallback = jest.fn((id: number) => {
  tareasIdle.delete(id);
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function obtenerIdlePendiente() {
  const pendiente = tareasIdle.entries().next().value;
  if (!pendiente) throw new Error('No existe una tarea idle sintética pendiente');
  return pendiente as [number, () => void];
}

function completarIdle() {
  const [id, tarea] = obtenerIdlePendiente();
  tareasIdle.delete(id);
  tarea();
}

function buscarPropsActivityIndicator(nodo: unknown): Record<string, unknown> | undefined {
  if (!nodo || typeof nodo !== 'object') return undefined;
  const elemento = nodo as Record<string, unknown>;
  if (elemento.type === 'ActivityIndicator' && elemento.props && typeof elemento.props === 'object') {
    return elemento.props as Record<string, unknown>;
  }
  if (!Array.isArray(elemento.children)) return undefined;
  for (const hijo of elemento.children) {
    const encontrado = buscarPropsActivityIndicator(hijo);
    if (encontrado) return encontrado;
  }
  return undefined;
}

describe('Pantalla de arranque — tarea de apoyo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    siguienteIdleId = 1;
    tareasIdle = new Map();
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: mockRequestIdleCallback,
      writable: true,
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: mockCancelIdleCallback,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('Tarea de apoyo: la ruta inicial muestra la identidad y únicamente el mensaje de preparación autorizado', async () => {
    const vista = await render(<IndexRoute />);

    expect(vista.getByLabelText('ClearCuent')).toBeOnTheScreen();
    expect(vista.getByText('Preparando ClearCuent…')).toBeOnTheScreen();
    expect(vista.getByText('ClearCuent Merchant')).toBeOnTheScreen();
    const arbolRenderizado = JSON.stringify(vista.toJSON()).toLowerCase();
    for (const contenidoExcluido of [
      'Modo sin conexión preparado',
      'Sincronizando libreta',
      'Listo para cobrar',
      'offline-first',
      'cloud_done',
      'C·',
    ]) {
      expect(arbolRenderizado).not.toContain(contenidoExcluido.toLowerCase());
    }

    await act(async () => vista.unmount());
  });

  test('Tarea de apoyo: expone la etiqueta accesible exacta y oculta el spinner al lector', async () => {
    const vista = await render(<IndexRoute />);

    expect(vista.getByLabelText('ClearCuent. Preparando la aplicación.')).toBeOnTheScreen();
    const spinner = buscarPropsActivityIndicator(vista.toJSON());
    expect(spinner).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });

    await act(async () => vista.unmount());
  });

  test.each([
    ['idle antes de la espera mínima', 'idle-primero'],
    ['espera mínima antes de idle', 'temporizador-primero'],
  ] as const)(
    'Tarea de apoyo: navega una sola vez cuando finalizan %s',
    async (_escenario, orden) => {
      const vista = await render(<IndexRoute />);

      if (orden === 'idle-primero') {
        await act(async () => completarIdle());
        await act(async () => {
          await jest.advanceTimersByTimeAsync(799);
        });
        expect(mockReplace).not.toHaveBeenCalled();
        await act(async () => {
          await jest.advanceTimersByTimeAsync(1);
        });
      } else {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(800);
        });
        expect(mockReplace).not.toHaveBeenCalled();
        await act(async () => completarIdle());
      }

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
      await act(async () => vista.unmount());
    },
  );

  test('Tarea de apoyo: al desmontar cancela temporizador e idle y no navega después', async () => {
    const clearTimeoutEspia = jest.spyOn(globalThis, 'clearTimeout');
    const vista = await render(<IndexRoute />);
    const [idleId, tareaCancelada] = obtenerIdlePendiente();

    await act(async () => vista.unmount());

    expect(clearTimeoutEspia).toHaveBeenCalledTimes(1);
    expect(mockCancelIdleCallback).toHaveBeenCalledWith(idleId);
    await act(async () => tareaCancelada());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

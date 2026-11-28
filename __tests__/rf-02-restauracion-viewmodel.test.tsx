import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { useRestauracionSesionViewModel } from '@/features/cuenta/hooks/useRestauracionSesionViewModel';
import { authService } from '@/services/auth.service';
import * as EventosSesion from '@/services/api/eventosSesion';
import * as SesionService from '@/services/sesion.service';

jest.mock('@/services/sesion.service', () => ({
  obtenerSesionSegura: jest.fn(),
  limpiarSesionSeguraVerificada: jest.fn(),
  actualizarAccesoSeguro: jest.fn(),
}));
jest.mock('@/services/auth.service', () => ({ authService: { renovarSesion: jest.fn() } }));
jest.mock('@/services/api/eventosSesion', () => ({ emitirSesionRevocada: jest.fn() }));

const obtener = SesionService.obtenerSesionSegura as jest.MockedFunction<
  typeof SesionService.obtenerSesionSegura
>;
const limpiar = SesionService.limpiarSesionSeguraVerificada as jest.MockedFunction<
  typeof SesionService.limpiarSesionSeguraVerificada
>;
const actualizar = SesionService.actualizarAccesoSeguro as jest.MockedFunction<
  typeof SesionService.actualizarAccesoSeguro
>;
const renovar = authService.renovarSesion as jest.MockedFunction<typeof authService.renovarSesion>;
const emitirRevocada = EventosSesion.emitirSesionRevocada as jest.MockedFunction<
  typeof EventosSesion.emitirSesionRevocada
>;

const SESION_VIGENTE = {
  tokenAcceso: 'access',
  tokenRenovacion: 'refresh',
  accesoExpiraEn: '2026-11-27T12:15:00.000Z',
  renovacionExpiraEn: '2026-12-27T12:00:00.000Z',
};

async function montar() {
  const onPanel = jest.fn();
  const onLogin = jest.fn();
  const vista = await renderHook(() => useRestauracionSesionViewModel({ onPanel, onLogin }));
  return { ...vista, onPanel, onLogin };
}

describe('RF-02 REST — orquestación del arranque', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));
    jest.clearAllMocks();
    limpiar.mockResolvedValue({ tipo: 'limpiada' });
    actualizar.mockResolvedValue({ tipo: 'actualizada' });
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test('RF-02 CA1/CA4: sesión ausente muestra Inicio sin HTTP', async () => {
    obtener.mockResolvedValueOnce({ tipo: 'sinSesion' });
    const { result, onPanel, onLogin } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('inicio'));
    expect(renovar).not.toHaveBeenCalled();
    expect(onPanel).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  test('RF-02 CA1/CA4: access vigente abre panel aun sin petición de red', async () => {
    obtener.mockResolvedValueOnce({ tipo: 'sesion', sesion: SESION_VIGENTE });
    const { onPanel } = await montar();
    await waitFor(() => expect(onPanel).toHaveBeenCalledTimes(1));
    expect(renovar).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: sesión inconsistente se limpia antes de mostrar Inicio', async () => {
    obtener.mockResolvedValueOnce({ tipo: 'inconsistente' });
    const { result } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('inicio'));
    expect(limpiar).toHaveBeenCalledTimes(1);
  });

  test('RF-02 CA4: error de lectura conserva sesión y permite reintentar', async () => {
    obtener.mockResolvedValueOnce({ tipo: 'errorLectura' }).mockResolvedValueOnce({ tipo: 'sinSesion' });
    const { result } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('errorTecnico'));
    expect(limpiar).not.toHaveBeenCalled();
    await act(async () => result.current.reintentar());
    expect(result.current.estado).toBe('inicio');
  });

  test('RF-02 CA4: access vencido y refresh vigente actualiza solo access y abre panel', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:59:59.000Z' },
    });
    renovar.mockResolvedValueOnce({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    const { onPanel } = await montar();
    await waitFor(() => expect(onPanel).toHaveBeenCalledTimes(1));
    expect(renovar).toHaveBeenCalledWith('refresh');
    expect(actualizar).toHaveBeenCalledWith('access-nuevo', '2026-11-27T12:15:00.000Z');
  });

  test('RF-02 CA4: refresh vencido localmente limpia y abre login sin HTTP', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: {
        ...SESION_VIGENTE,
        accesoExpiraEn: '2026-11-27T11:00:00.000Z',
        renovacionExpiraEn: '2026-11-27T12:00:00.000Z',
      },
    });
    const { onLogin } = await montar();
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(limpiar).toHaveBeenCalledTimes(1);
    expect(renovar).not.toHaveBeenCalled();
  });

  test.each(['requiereLogin'] as const)(
    'RF-02 CA4: %s limpia y abre login',
    async (tipo) => {
      obtener.mockResolvedValueOnce({
        tipo: 'sesion',
        sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
      });
      renovar.mockResolvedValueOnce({ tipo });
      const { onLogin } = await montar();
      await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
      expect(limpiar).toHaveBeenCalledTimes(1);
    },
  );

  test('RF-02 CA4 / RF-07 CA5: sesión revocada emite el evento global sin navegar localmente', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({ tipo: 'sesionRevocada' });
    const { onPanel, onLogin } = await montar();
    await waitFor(() => expect(emitirRevocada).toHaveBeenCalledTimes(1));
    expect(onPanel).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  test.each([
    ['sinConexion', 'sinConexion'],
    ['errorTecnico', 'errorTecnico'],
  ] as const)('RF-02 CA4: %s conserva sesión y ofrece estado recuperable', async (tipo, estado) => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({ tipo });
    const { result } = await montar();
    await waitFor(() => expect(result.current.estado).toBe(estado));
    expect(limpiar).not.toHaveBeenCalled();
  });

  test('RF-02 CA4 (RNF-05): 429 sin espera válida cae en error recuperable sin inventar contador', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({ tipo: 'limiteSolicitudes' });
    const { result } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('errorTecnico'));
    expect(result.current.segundosRestantes).toBeUndefined();
  });

  test('RF-02 CA4 (RNF-05): 429 con espera bloquea hasta que el contador termina', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({ tipo: 'limiteSolicitudes', reintentarEnSegundos: 2 });
    const { result } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('limiteSolicitudes'));
    expect(result.current.segundosRestantes).toBe(2);
    await act(async () => jest.advanceTimersByTimeAsync(2000));
    expect(result.current.segundosRestantes).toBe(0);
  });

  test('RF-02 CA4: fallo al actualizar access abre login solo tras limpieza verificada', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({
      tipo: 'exito',
      tokenAcceso: 'nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    actualizar.mockResolvedValueOnce({ tipo: 'requiereLogin' });
    const { onLogin } = await montar();
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
  });

  test('RF-02 CA4 / RF-07 CA5: errorLimpieza bloquea y Reintentar repite solo la limpieza', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: {
        ...SESION_VIGENTE,
        accesoExpiraEn: '2026-11-27T11:00:00.000Z',
        renovacionExpiraEn: '2026-11-27T11:30:00.000Z',
      },
    });
    limpiar.mockResolvedValueOnce({ tipo: 'errorLimpieza' }).mockResolvedValueOnce({ tipo: 'limpiada' });
    const { result, onLogin } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('errorLimpieza'));
    expect(onLogin).not.toHaveBeenCalled();
    await act(async () => result.current.reintentar());
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(limpiar).toHaveBeenCalledTimes(2);
  });

  test('RF-02 CA4: actualizarAccesoSeguro errorLimpieza y Reintentar termina en login verificado', async () => {
    obtener.mockResolvedValueOnce({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2026-11-27T11:00:00.000Z' },
    });
    renovar.mockResolvedValueOnce({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2026-11-27T12:15:00.000Z',
    });
    actualizar.mockResolvedValueOnce({ tipo: 'errorLimpieza' });
    limpiar.mockResolvedValueOnce({ tipo: 'limpiada' });
    const { result, onLogin, onPanel } = await montar();
    await waitFor(() => expect(result.current.estado).toBe('errorLimpieza'));
    expect(onLogin).not.toHaveBeenCalled();
    expect(onPanel).not.toHaveBeenCalled();
    await act(async () => result.current.reintentar());
    expect(limpiar).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onPanel).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: intento obsoleto no navega ni limpia procesamiento tras deshabilitar y reactivar', async () => {
    let resolverLecturaPendiente!: (valor: {
      tipo: 'sesion';
      sesion: typeof SESION_VIGENTE;
    }) => void;
    obtener
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverLecturaPendiente = resolve;
          }),
      )
      .mockResolvedValueOnce({ tipo: 'sesion', sesion: SESION_VIGENTE });

    const onPanel = jest.fn();
    const onLogin = jest.fn();
    const vista = await renderHook(
      ({ habilitado }: { habilitado: boolean }) =>
        useRestauracionSesionViewModel({ habilitado, onPanel, onLogin }),
      { initialProps: { habilitado: true } },
    );

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await waitFor(() => expect(obtener).toHaveBeenCalledTimes(1));

    await act(async () => {
      vista.rerender({ habilitado: false });
      jest.runOnlyPendingTimers();
    });
    await act(async () => {
      vista.rerender({ habilitado: true });
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => expect(onPanel).toHaveBeenCalledTimes(1));
    expect(vista.result.current.procesando).toBe(false);

    await act(async () => {
      resolverLecturaPendiente({ tipo: 'sesion', sesion: SESION_VIGENTE });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onPanel).toHaveBeenCalledTimes(1);
    expect(onLogin).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
    expect(limpiar).not.toHaveBeenCalled();
    expect(vista.result.current.procesando).toBe(false);
  });
});

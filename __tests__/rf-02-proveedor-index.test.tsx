import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Pressable, Text } from 'react-native';

import IndexRoute from '../app/index';
import { ProveedorSesion } from '@/features/cuenta/components/ProveedorSesion';
import { authService } from '@/services/auth.service';
import * as Eventos from '@/services/api/eventosSesion';
import * as Sesion from '@/services/sesion.service';

let mockPathname = '/panel';
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));
function MockInicioScreen() {
  return <Text>Inicio sin sesión</Text>;
}
function MockRestauracionScreen({
  estado,
  onReintentar,
}: {
  estado: string;
  onReintentar?: () => void;
}) {
  return (
    <>
      <Text>{`restauración:${estado}`}</Text>
      {onReintentar ? (
        <Pressable accessibilityRole="button" onPress={onReintentar}>
          <Text>Reintentar</Text>
        </Pressable>
      ) : null}
    </>
  );
}
jest.mock('@/features/cuenta/components/InicioScreen', () => ({
  InicioScreen: MockInicioScreen,
}));
jest.mock('@/features/cuenta/components/RestauracionSesionScreen', () => ({
  RestauracionSesionScreen: MockRestauracionScreen,
}));
jest.mock('@/services/sesion.service', () => ({
  obtenerSesionSegura: jest.fn(),
  limpiarSesionSeguraVerificada: jest.fn(),
  actualizarAccesoSeguro: jest.fn(),
}));
jest.mock('@/services/auth.service', () => ({ authService: { renovarSesion: jest.fn() } }));

const obtener = Sesion.obtenerSesionSegura as jest.MockedFunction<typeof Sesion.obtenerSesionSegura>;
const limpiar = Sesion.limpiarSesionSeguraVerificada as jest.MockedFunction<
  typeof Sesion.limpiarSesionSeguraVerificada
>;
const actualizar = Sesion.actualizarAccesoSeguro as jest.MockedFunction<
  typeof Sesion.actualizarAccesoSeguro
>;
const renovar = authService.renovarSesion as jest.MockedFunction<typeof authService.renovarSesion>;

const SESION_VIGENTE = {
  tokenAcceso: 'access-vigente',
  tokenRenovacion: 'refresh-vigente',
  accesoExpiraEn: '2099-11-27T12:15:00.000Z',
  renovacionExpiraEn: '2099-12-27T12:00:00.000Z',
};

function puerta(contenido = 'contenido protegido') {
  return (
    <ProveedorSesion>
      <Text>{contenido}</Text>
    </ProveedorSesion>
  );
}

describe('RF-02 REST — puerta global real sobre rutas', () => {
  beforeEach(() => {
    mockPathname = '/panel';
    jest.clearAllMocks();
    obtener.mockReset();
    renovar.mockReset();
    limpiar.mockReset().mockResolvedValue({ tipo: 'limpiada' });
    actualizar.mockReset().mockResolvedValue({ tipo: 'actualizada' });
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test('RF-02 CA1/CA4: deep link /panel sin sesión nunca muestra contenido protegido', async () => {
    obtener.mockResolvedValue({ tipo: 'sinSesion' });
    const vista = await render(puerta());
    expect(vista.queryByText('contenido protegido')).toBeNull();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(vista.queryByText('contenido protegido')).toBeNull();
  });

  test('RF-02 CA1/CA4: deep link /panel con access vigente habilita el contenido', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION_VIGENTE });
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('contenido protegido')).toBeTruthy());
    expect(renovar).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: deep link /panel renovable permanece bloqueado hasta renovar y persistir', async () => {
    obtener.mockResolvedValue({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2020-01-01T00:00:00.000Z' },
    });
    let resolver!: (valor: {
      tipo: 'exito';
      tokenAcceso: string;
      accesoExpiraEn: string;
    }) => void;
    renovar.mockImplementationOnce(() => new Promise((resolve) => (resolver = resolve)));
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('restauración:renovando')).toBeTruthy());
    expect(vista.queryByText('contenido protegido')).toBeNull();
    await act(async () => {
      resolver({
        tipo: 'exito',
        tokenAcceso: 'access-nuevo',
        accesoExpiraEn: '2099-11-27T12:15:00.000Z',
      });
    });
    await waitFor(() => expect(vista.getByText('contenido protegido')).toBeTruthy());
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  test('RF-02 CA4: errorLimpieza en la puerta mantiene oculto el deep link protegido', async () => {
    obtener.mockResolvedValue({
      tipo: 'sesion',
      sesion: {
        ...SESION_VIGENTE,
        accesoExpiraEn: '2020-01-01T00:00:00.000Z',
        renovacionExpiraEn: '2020-01-02T00:00:00.000Z',
      },
    });
    limpiar.mockResolvedValue({ tipo: 'errorLimpieza' });
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('restauración:errorLimpieza')).toBeTruthy());
    expect(vista.queryByText('contenido protegido')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: actualizar access con errorLimpieza y Reintentar navega a /login solo tras limpiar', async () => {
    obtener.mockResolvedValue({
      tipo: 'sesion',
      sesion: { ...SESION_VIGENTE, accesoExpiraEn: '2020-01-01T00:00:00.000Z' },
    });
    renovar.mockResolvedValue({
      tipo: 'exito',
      tokenAcceso: 'access-nuevo',
      accesoExpiraEn: '2099-11-27T12:15:00.000Z',
    });
    actualizar.mockResolvedValue({ tipo: 'errorLimpieza' });
    limpiar.mockResolvedValueOnce({ tipo: 'limpiada' });
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('restauración:errorLimpieza')).toBeTruthy());
    const boton = await vista.findByRole('button', { name: 'Reintentar' });
    expect(vista.queryByText('contenido protegido')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith('/login');
    await act(async () => fireEvent.press(boton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(limpiar).toHaveBeenCalledTimes(1);
  });

  test('RF-02 CA4 / RF-07 CA5: proveedor ignora eventos repetidos y navega una vez tras limpiar', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION_VIGENTE });
    let resolver!: (valor: { tipo: 'limpiada' }) => void;
    limpiar.mockImplementationOnce(() => new Promise((resolve) => (resolver = resolve)));
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('contenido protegido')).toBeTruthy());
    await act(async () => {
      Eventos.emitirSesionRevocada();
      Eventos.emitirSesionRevocada();
    });
    expect(vista.queryByText('contenido protegido')).toBeNull();
    expect(limpiar).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ tipo: 'limpiada' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/sesion-revocada'));
    // H-2: tras limpieza verificada, el contenido sigue bloqueado hasta observar el destino público.
    expect(vista.queryByText('contenido protegido')).toBeNull();
    expect(vista.getByText('restauración:verificando')).toBeTruthy();
    mockPathname = '/sesion-revocada';
    await act(async () => {
      await vista.rerender(puerta());
    });
    await waitFor(() => expect(vista.queryByText('restauración:verificando')).toBeNull());
    expect(
      mockReplace.mock.calls.filter(([ruta]) => ruta === '/sesion-revocada'),
    ).toHaveLength(1);
  });

  test('RF-02 CA4: proveedor desmontado durante limpieza no navega ni actualiza tarde', async () => {
    obtener.mockResolvedValue({ tipo: 'sesion', sesion: SESION_VIGENTE });
    let resolver!: (valor: { tipo: 'limpiada' }) => void;
    limpiar.mockImplementationOnce(() => new Promise((resolve) => (resolver = resolve)));
    const errorConsola = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const vista = await render(puerta());
    await waitFor(() => expect(vista.getByText('contenido protegido')).toBeTruthy());
    await act(async () => Eventos.emitirRequiereLogin(false));
    const llamadasAntes = mockReplace.mock.calls.length;
    await vista.unmount();
    await act(async () => resolver({ tipo: 'limpiada' }));
    expect(mockReplace).toHaveBeenCalledTimes(llamadasAntes);
    expect(errorConsola).not.toHaveBeenCalledWith(
      expect.stringContaining('state update on an unmounted component'),
    );
  });

  test('RF-02 CA1/CA4: entrar por / ejecuta una sola restauración y no duplica proveedor/index', async () => {
    mockPathname = '/';
    obtener.mockResolvedValue({ tipo: 'sinSesion' });
    const vista = await render(
      <ProveedorSesion>
        <IndexRoute />
      </ProveedorSesion>,
    );
    await waitFor(() => expect(vista.getByText('Inicio sin sesión')).toBeTruthy());
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

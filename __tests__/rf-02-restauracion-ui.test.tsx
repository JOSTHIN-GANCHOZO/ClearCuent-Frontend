import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { RestauracionSesionScreen } from '@/features/cuenta/components/RestauracionSesionScreen';

jest.mock('@/shared/components/LogoClearCuent', () => ({ LogoClearCuent: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('RF-02 CA1/CA4: UI accesible de restauración', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test.each([
    ['verificando', 'Comprobando tu sesión', 'Esto tomará solo un momento.'],
    ['renovando', 'Restableciendo tu sesión', 'Mantén ClearCuent abierto.'],
    [
      'sinConexion',
      'No hay conexión',
      'Conéctate a internet y vuelve a intentarlo. Tu sesión sigue guardada.',
    ],
    [
      'errorTecnico',
      'No pudimos restablecer tu sesión',
      'Tu sesión sigue guardada. Vuelve a intentarlo.',
    ],
    [
      'errorLimpieza',
      'No pudimos cerrar la sesión',
      'Por seguridad, no puedes continuar todavía. Vuelve a intentarlo.',
    ],
  ] as const)('RF-02 CA4: estado %s usa los microtextos exactos', async (estado, titulo, detalle) => {
    const vista = await render(<RestauracionSesionScreen estado={estado} />);
    expect(vista.getByRole('header', { name: titulo })).toBeTruthy();
    expect(vista.getByText(detalle)).toBeTruthy();
    expect(vista.getByText('ClearCuent Merchant')).toBeTruthy();
  });

  test('RF-02 CA4: carga está ocupada y no ofrece acción ni progreso inventado', async () => {
    const vista = await render(<RestauracionSesionScreen estado="verificando" />);
    expect(vista.getByText('Comprobando tu sesión').parent?.props.accessibilityState).toEqual({
      busy: true,
    });
    expect(vista.queryByRole('button')).toBeNull();
    expect(vista.queryByText(/%|paso|segundos restantes/i)).toBeNull();
  });

  test('RF-02 CA4: Reintentar expone rol, nombre y evita envíos mientras procesa', async () => {
    const onReintentar = jest.fn();
    const vista = await render(
      <RestauracionSesionScreen
        estado="sinConexion"
        onReintentar={onReintentar}
        procesando
      />,
    );
    const boton = vista.getByRole('button', { name: 'Reintentar', disabled: true });
    expect(boton.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(boton);
    expect(onReintentar).not.toHaveBeenCalled();
  });

  test('RF-02 CA4: Reintentar conserva un área táctil mínima de 44 puntos', async () => {
    const vista = await render(<RestauracionSesionScreen estado="sinConexion" />);
    const estilo = StyleSheet.flatten(vista.getByRole('button', { name: 'Reintentar' }).props.style);
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
  });

  test('RF-02 CA4 (RNF-05): Retry-After válido muestra espera comprensible y deshabilita la acción', async () => {
    const vista = await render(
      <RestauracionSesionScreen estado="limiteSolicitudes" segundosRestantes={90} />,
    );
    expect(vista.getByText('Espera para reintentar')).toBeTruthy();
    expect(
      vista.getByText('Podrás intentarlo de nuevo en 1 min 30 s. Tu sesión sigue guardada.'),
    ).toBeTruthy();
    expect(vista.getByRole('button', { disabled: true })).toBeTruthy();
  });

  test('RF-02 CA4 (RNF-05): al terminar la espera habilita y anuncia Reintentar sin contador', async () => {
    const vista = await render(
      <RestauracionSesionScreen estado="limiteSolicitudes" segundosRestantes={0} />,
    );
    expect(vista.getByText('Ya puedes volver a intentarlo.')).toBeTruthy();
    expect(vista.getByRole('button', { disabled: false })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Ya puedes volver a intentarlo',
    );
  });

  test('RF-02 CA4 / RF-07 CA5: errorLimpieza enfoca el encabezado y solo ofrece reintento', async () => {
    const vista = await render(<RestauracionSesionScreen estado="errorLimpieza" />);
    expect(vista.getByRole('header', { name: 'No pudimos cerrar la sesión' })).toBeTruthy();
    expect(vista.getAllByRole('button')).toHaveLength(1);
  });
});

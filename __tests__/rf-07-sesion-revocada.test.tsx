import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';

import { SesionRevocadaScreen } from '@/features/cuenta/components/SesionRevocadaScreen';

let vista: Awaited<ReturnType<typeof render>>;

async function montar(componente: Parameters<typeof render>[0]) {
  vista = await render(componente);
  return vista;
}

describe('SesionRevocadaScreen', () => {
  test('RF-07 CA5: informa la revocación y permite iniciar sesión de nuevo mediante callback', async () => {
    const onIniciarSesion = jest.fn();
    await montar(<SesionRevocadaScreen onIniciarSesion={onIniciarSesion} />);

    expect(vista.getByText('Tu sesión dejó de estar activa')).toBeOnTheScreen();
    expect(vista.getByText('Por seguridad, vuelve a iniciar sesión para continuar.')).toBeOnTheScreen();
    expect(vista.getByLabelText('ClearCuent')).toBeOnTheScreen();
    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión nuevamente' }));
    expect(onIniciarSesion).toHaveBeenCalledTimes(1);
  });

  test('RF-07 CA5: la sesión revocada no expone acciones de sync fuera de esta iteración', async () => {
    await montar(<SesionRevocadaScreen onIniciarSesion={jest.fn()} />);

    expect(vista.queryByRole('button', { name: /sincronizar|descartar pendientes/i })).not.toBeOnTheScreen();
    expect(vista.getAllByRole('button')).toHaveLength(1);
  });
});

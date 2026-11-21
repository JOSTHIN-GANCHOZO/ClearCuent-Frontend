import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';

import { CambioDispositivoScreen } from '@/features/cuenta/components/CambioDispositivoScreen';
import type { ResultadoCambioDispositivoUi } from '@/features/cuenta/hooks/useCambioDispositivoViewModel';

const cambioExitoso = async (): Promise<ResultadoCambioDispositivoUi> => 'exito';

let vista: Awaited<ReturnType<typeof render>>;

async function montar(componente: Parameters<typeof render>[0]) {
  vista = await render(componente);
  return vista;
}

describe('CambioDispositivoScreen', () => {
  test('RF-07 CA2: advierte inequívocamente que los datos no sincronizados se perderán', async () => {
    await montar(<CambioDispositivoScreen onCancelar={jest.fn()} onConfirmar={cambioExitoso} />);

    expect(vista.getByText('Existe una sesión activa en otro dispositivo.')).toBeOnTheScreen();
    expect(
      vista.getByText(
        'Los datos no sincronizados del dispositivo anterior se perderán. La sesión anterior será revocada.',
      ),
    ).toBeOnTheScreen();
    expect(vista.getByLabelText('ClearCuent')).toBeOnTheScreen();
    expect(vista.queryByText(/iphone|android|modelo|última conexión/i)).not.toBeOnTheScreen();
  });

  test('RF-07 CA4: cancelar conserva el flujo mediante callback sin confirmar el cambio', async () => {
    const onCancelar = jest.fn();
    const onConfirmar = jest.fn(async () => 'exito' as const);
    await montar(<CambioDispositivoScreen onCancelar={onCancelar} onConfirmar={onConfirmar} />);

    await fireEvent.press(vista.getByRole('button', { name: 'Cancelar' }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  test('RF-07 CA2: al confirmar muestra procesamiento y deshabilita ambas decisiones', async () => {
    const onConfirmar = jest.fn(async () => 'exito' as const);
    await montar(<CambioDispositivoScreen onCancelar={jest.fn()} onConfirmar={onConfirmar} />);

    await fireEvent.press(vista.getByRole('button', { name: 'Continuar en este dispositivo' }));

    expect(await vista.findByText('Confirmando cambio de dispositivo…')).toBeOnTheScreen();
    expect(vista.getByRole('button', { name: 'Confirmando…' })).toBeDisabled();
    expect(vista.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(onConfirmar).toHaveBeenCalledTimes(1);

  });

  test.each([false, true])(
    'RF-07 CA2: muestra error recuperable cuando el callback %s rechaza',
    async (lanzaExcepcion) => {
      const onConfirmar = jest.fn(async () => {
        if (lanzaExcepcion) throw new Error('fallo técnico sintético');
        return 'error' as const;
      });
      await montar(<CambioDispositivoScreen onCancelar={jest.fn()} onConfirmar={onConfirmar} />);
      await fireEvent.press(vista.getByRole('button', { name: 'Continuar en este dispositivo' }));

      expect(
        await vista.findByText('No pudimos completar el cambio de dispositivo'),
      ).toBeOnTheScreen();
      expect(
        vista.getByText('Intenta nuevamente más tarde. Si cancelas, conservarás tu sesión anterior.'),
      ).toBeOnTheScreen();
      expect(vista.getByRole('button', { name: 'Intentar nuevamente' })).toBeEnabled();
      expect(vista.queryByText('fallo técnico sintético')).not.toBeOnTheScreen();
    },
  );

  test('RF-07 CA2: la interfaz de cambio no ofrece acciones de sincronización', async () => {
    await montar(<CambioDispositivoScreen onCancelar={jest.fn()} onConfirmar={cambioExitoso} />);

    expect(vista.queryByRole('button', { name: /sincronizar|descartar pendientes/i })).not.toBeOnTheScreen();
  });
});

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import LoginRoute from '../app/login';
import { authService } from '@/services/auth.service';

const CORREO = 'comerciante@example.test';
const CONTRASENA = 'Clave-Sintetica-1';

// Router simulado del proyecto, con la misma forma usada en inicio-arranque-apoyo.test.tsx.
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

describe('Ruta de login — transito hacia el panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test('RF-02 CA1: credenciales correctas en LoginScreen navegan a /panel', async () => {
    // El servicio se simula para aislar el cableado de navegacion de la ruta;
    // la autenticacion HTTP se comprueba por separado en auth.service.test.ts.
    const iniciarSesion = jest
      .spyOn(authService, 'iniciarSesion')
      .mockResolvedValue({ tipo: 'exito' });
    const vista = await render(<LoginRoute />);

    await fireEvent.changeText(vista.getByPlaceholderText('tu@negocio.com'), CORREO);
    await fireEvent.changeText(vista.getByPlaceholderText('Ingresa tu contraseña'), CONTRASENA);
    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/panel'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(iniciarSesion).toHaveBeenCalledWith({ correo: CORREO, contrasena: CONTRASENA });
  });
});

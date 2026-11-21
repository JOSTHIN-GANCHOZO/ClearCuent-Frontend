import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, jest, test } from '@jest/globals';
import { processColor, StyleSheet } from 'react-native';

import { LoginScreen } from '@/features/cuenta/components/LoginScreen';
import type { ResultadoLoginUi } from '@/features/cuenta/hooks/useLoginViewModel';
import type { LoginForm } from '@/features/cuenta/schemas/login.schema';
import { colores, coloresMarca } from '@/shared/theme/colores';

const CORREO = 'comerciante@example.test';
const CONTRASENA = 'Clave-Sintetica-1';
const inicioExitoso = async (_datos: LoginForm): Promise<ResultadoLoginUi> => 'exito';
let vista: Awaited<ReturnType<typeof render>>;

async function montar(componente: Parameters<typeof render>[0]) {
  vista = await render(componente);
  return vista;
}

async function completarFormulario() {
  await fireEvent.changeText(vista.getByPlaceholderText('tu@negocio.com'), CORREO);
  await fireEvent.changeText(vista.getByPlaceholderText('Ingresa tu contraseña'), CONTRASENA);
}

describe('LoginScreen', () => {
  test('RF-02 CA2: valida localmente y comunica cada error con propiedades accesibles nativas', async () => {
    const onIniciarSesion = jest.fn(inicioExitoso);
    await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);

    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    const correo = await vista.findByLabelText('Correo electrónico');
    const contrasena = vista.getByLabelText('Contraseña');

    expect(onIniciarSesion).not.toHaveBeenCalled();
    expect(correo).toHaveProp('accessibilityHint', 'Ingresa un correo electrónico válido.');
    expect(correo).toHaveProp('accessibilityValue', {
      text: 'Error: Ingresa un correo electrónico válido.',
    });
    expect(contrasena).toHaveProp('accessibilityHint', 'Ingresa tu contraseña.');
    expect(contrasena).toHaveProp('accessibilityValue', {
      text: 'Error: Ingresa tu contraseña.',
    });
    expect(vista.getByText('Ingresa un correo electrónico válido.')).toBeOnTheScreen();
    expect(vista.getByText('Ingresa tu contraseña.')).toBeOnTheScreen();
  });

  test('RF-02 CA2: muestra el mismo error genérico para credenciales incorrectas', async () => {
    const onIniciarSesion = jest.fn(async (_datos: LoginForm) => 'credencialesIncorrectas' as const);
    await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);
    await completarFormulario();

    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await vista.findByText('Correo o contraseña incorrectos')).toBeOnTheScreen();
    expect(vista.queryByText(/no existe|registrado|cuenta encontrada/i)).not.toBeOnTheScreen();
    expect(onIniciarSesion).toHaveBeenCalledWith({ correo: CORREO, contrasena: CONTRASENA });
  });

  test('RF-02 CA3: comunica cinco intentos y 15 minutos, y bloquea un nuevo envío', async () => {
    const onIniciarSesion = jest.fn(async () => 'bloqueado' as const);
    await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);
    await completarFormulario();
    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await vista.findByText('Acceso bloqueado temporalmente')).toBeOnTheScreen();
    expect(
      vista.getByText(
        'Después de cinco intentos fallidos, el acceso queda bloqueado durante 15 minutos.',
      ),
    ).toBeOnTheScreen();

    const enviar = vista.getByRole('button', { name: 'Iniciar sesión' });
    expect(enviar).toBeDisabled();
    await fireEvent.press(enviar);
    expect(onIniciarSesion).toHaveBeenCalledTimes(1);
  });

  test('RF-02 CA3: mantiene el bloqueo antes de 15 minutos y habilita el acceso al cumplirse', async () => {
    jest.useFakeTimers();
    try {
      const onIniciarSesion = jest.fn(async () => 'bloqueado' as const);
      await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);
      await completarFormulario();
      await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

      const enviarBloqueado = await vista.findByRole('button', { name: 'Iniciar sesión' });
      expect(enviarBloqueado).toBeDisabled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
      });
      expect(vista.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
      });
      expect(vista.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
      expect(vista.queryByText('Acceso bloqueado temporalmente')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  test('RF-02 CA2: durante Verificando… deshabilita campos y acciones', async () => {
    const onIniciarSesion = jest.fn(async () => 'exito' as const);
    const onCrearCuenta = jest.fn();
    const onRecuperarContrasena = jest.fn();
    await montar(
      <LoginScreen
        onCrearCuenta={onCrearCuenta}
        onIniciarSesion={onIniciarSesion}
        onRecuperarContrasena={onRecuperarContrasena}
      />,
    );
    await completarFormulario();
    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await vista.findByText('Verificando…')).toBeOnTheScreen();
    expect(vista.getByPlaceholderText('tu@negocio.com')).not.toBeEnabled();
    expect(vista.getByPlaceholderText('Ingresa tu contraseña')).not.toBeEnabled();
    expect(vista.getByRole('button', { name: 'Mostrar contraseña' })).toBeDisabled();
    expect(vista.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toBeDisabled();
    expect(vista.getByRole('button', { name: /Crear cuenta/ })).toBeDisabled();
    expect(vista.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
    await waitFor(() => expect(onIniciarSesion).toHaveBeenCalledTimes(1));
  });

  test.each([
    ['sinConexion', 'Iniciar sesión requiere conexión a internet'],
    ['limiteSolicitudes', 'Demasiadas solicitudes. Intenta nuevamente más tarde'],
    ['errorTecnico', 'No pudimos completar la solicitud. Intenta nuevamente más tarde'],
  ] as const)(
    'RF-02 CA2: representa el estado %s y permite reintentar mediante el callback',
    async (resultado, mensaje) => {
      const onIniciarSesion = jest.fn(async () => resultado);
      await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);
      await completarFormulario();
      await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

      expect(await vista.findByText(mensaje)).toBeOnTheScreen();
      const reintentar = vista.getByRole('button', { name: 'Reintentar' });
      expect(reintentar).toBeEnabled();
      await fireEvent.press(reintentar);
      expect(onIniciarSesion).toHaveBeenCalledTimes(2);
    },
  );

  test('RF-02 CA2: convierte el rechazo técnico del callback en un mensaje no sensible', async () => {
    const onIniciarSesion = jest.fn(async () => {
      throw new Error('detalle interno sintético');
    });
    await montar(<LoginScreen onIniciarSesion={onIniciarSesion} />);
    await completarFormulario();
    await fireEvent.press(vista.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await vista.findByText('No pudimos completar la solicitud. Intenta nuevamente más tarde'),
    ).toBeOnTheScreen();
    expect(vista.queryByText('detalle interno sintético')).not.toBeOnTheScreen();
    expect(vista.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  test('RF-02 CA2: Mostrar/Ocultar mide al menos 44x44 y los placeholders tienen contraste activo', async () => {
    await montar(<LoginScreen onIniciarSesion={inicioExitoso} />);

    const correo = vista.getByPlaceholderText('tu@negocio.com');
    const contrasena = vista.getByPlaceholderText('Ingresa tu contraseña');
    const mostrar = vista.getByRole('button', { name: 'Mostrar contraseña' });
    const estilo = StyleSheet.flatten(mostrar.props.style);

    expect(correo).toHaveProp('placeholderTextColor', colores.textoSecundario);
    expect(contrasena).toHaveProp('placeholderTextColor', colores.textoSecundario);
    expect(correo).not.toHaveProp('placeholderTextColor', colores.textoApagado);
    expect(contrasena).not.toHaveProp('placeholderTextColor', colores.textoApagado);
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
    expect(estilo.minWidth).toBeGreaterThanOrEqual(44);

    await fireEvent.press(mostrar);
    expect(vista.getByRole('button', { name: 'Ocultar contraseña' })).toBeOnTheScreen();
    expect(contrasena).toHaveProp('secureTextEntry', false);
  });

  test('RF-02 CA2: conserva logo e identidad Merchant sin funciones comerciales fuera de alcance', async () => {
    await montar(<LoginScreen onIniciarSesion={inicioExitoso} />);

    expect(vista.getByLabelText('ClearCuent')).toBeOnTheScreen();
    expect(vista.getByText('ClearCuent Merchant')).toBeOnTheScreen();
    expect(vista.queryByText(/ventas|clientes|sincronizar/i)).not.toBeOnTheScreen();
    const logoRenderizado = JSON.stringify(vista.toJSON());
    const colorNativo = (color: string) => Number(processColor(color)) >>> 0;
    expect(logoRenderizado).toContain(`"payload":${colorNativo(coloresMarca.fondoIcono)}`);
    expect(logoRenderizado).toContain(`"payload":${colorNativo(coloresMarca.trazoIcono)}`);
    expect(logoRenderizado).toContain(`"payload":${colorNativo(coloresMarca.acentoIcono)}`);
  });
});

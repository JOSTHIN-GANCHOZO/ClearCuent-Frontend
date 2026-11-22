import { isAxiosError } from 'axios';
import { z } from 'zod';

import type { LoginForm } from '@/features/cuenta/schemas/login.schema';
import { crearClienteApi } from '@/services/api/clienteApi';
import { obtenerUrlEndpoint } from '@/services/api/configuracionApi';
import { obtenerDispositivoId } from '@/services/dispositivo.service';
import { guardarSesionSegura } from '@/services/sesion.service';

const respuestaLoginSchema = z
  .object({
    datos: z
      .object({
        usuario: z
          .object({
            id: z.string().uuid(),
            nombre: z.string(),
            negocio: z.string(),
            correo: z.string().email(),
            rol: z.literal('MERCHANT'),
            zonaHoraria: z.string(),
          })
          .strict(),
        sesion: z
          .object({
            tokenAcceso: z.string().min(1),
            tokenRenovacion: z.string().min(1),
            accesoExpiraEn: z.string().datetime({ offset: true }),
            renovacionExpiraEn: z.string().datetime({ offset: true }),
            dispositivoId: z.string().uuid(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const respuestaErrorSchema = z
  .object({
    error: z
      .object({
        codigo: z.string(),
        mensaje: z.string(),
        detalles: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

type CredencialesPendientes = LoginForm;

export type ResultadoAutenticacion =
  | { tipo: 'exito' }
  | { tipo: 'credencialesIncorrectas' }
  | { tipo: 'otraSesionActiva' }
  | { tipo: 'sesionRevocada' }
  | { tipo: 'bloqueado'; reintentarEnSegundos?: number }
  | { tipo: 'limiteSolicitudes'; reintentarEnSegundos?: number }
  | { tipo: 'sinConexion' }
  | { tipo: 'errorTecnico' };

function leerRetryAfter(valor: unknown): number | undefined {
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    return undefined;
  }

  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos >= 0) {
    return Math.ceil(segundos);
  }

  if (typeof valor === 'string') {
    const fecha = Date.parse(valor);
    if (Number.isFinite(fecha)) {
      return Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
    }
  }
  return undefined;
}

function mapearError(error: unknown): ResultadoAutenticacion {
  if (!isAxiosError(error)) {
    return { tipo: 'errorTecnico' };
  }
  if (!error.response) {
    return { tipo: 'sinConexion' };
  }

  const cuerpo = respuestaErrorSchema.safeParse(error.response.data);
  if (!cuerpo.success) {
    return { tipo: 'errorTecnico' };
  }

  const { codigo } = cuerpo.data.error;
  if (error.response.status === 401 && codigo === 'credenciales_invalidas') {
    return { tipo: 'credencialesIncorrectas' };
  }
  // RF-07 CA5: el contrato define 401 sesion_revocada. La detección real durante la
  // sincronización sigue pendiente del contrato /sync aprobado; aquí solo se mapea el código.
  if (error.response.status === 401 && codigo === 'sesion_revocada') {
    return { tipo: 'sesionRevocada' };
  }
  if (error.response.status === 409 && codigo === 'otra_sesion_activa') {
    return { tipo: 'otraSesionActiva' };
  }
  if (error.response.status === 429) {
    const reintentarEnSegundos = leerRetryAfter(error.response.headers['retry-after']);
    if (codigo === 'acceso_bloqueado') {
      return { tipo: 'bloqueado', reintentarEnSegundos };
    }
    if (codigo === 'limite_solicitudes') {
      return { tipo: 'limiteSolicitudes', reintentarEnSegundos };
    }
  }
  return { tipo: 'errorTecnico' };
}

class AuthService {
  private credencialesPendientes: CredencialesPendientes | null = null;

  async iniciarSesion(credenciales: LoginForm): Promise<ResultadoAutenticacion> {
    const resultado = await this.solicitarLogin(credenciales, false);
    this.credencialesPendientes =
      resultado.tipo === 'otraSesionActiva' ? { ...credenciales } : null;
    return resultado;
  }

  async confirmarCambioDispositivo(): Promise<ResultadoAutenticacion> {
    if (!this.credencialesPendientes) {
      return { tipo: 'errorTecnico' };
    }

    const resultado = await this.solicitarLogin(this.credencialesPendientes, true);
    if (resultado.tipo === 'exito' || resultado.tipo === 'credencialesIncorrectas') {
      this.credencialesPendientes = null;
    }
    return resultado;
  }

  cancelarCambioDispositivo(): void {
    // RF-07 CA4: cancelar descarta la contraseña en memoria y no hace otra petición.
    this.credencialesPendientes = null;
  }

  private async solicitarLogin(
    credenciales: LoginForm,
    confirmarCambioDispositivo: boolean,
  ): Promise<ResultadoAutenticacion> {
    try {
      const dispositivoId = await obtenerDispositivoId();
      const cliente = crearClienteApi();
      const respuesta = await cliente.post(obtenerUrlEndpoint('/api/v1/auth/login'), {
        correo: credenciales.correo,
        contrasena: credenciales.contrasena,
        dispositivoId,
        tokenExpo: null,
        ...(confirmarCambioDispositivo ? { confirmar_cambio_dispositivo: true } : {}),
      });
      const validacion = respuestaLoginSchema.safeParse(respuesta.data);
      if (!validacion.success || validacion.data.datos.sesion.dispositivoId !== dispositivoId) {
        return { tipo: 'errorTecnico' };
      }

      await guardarSesionSegura(validacion.data.datos.sesion);
      return { tipo: 'exito' };
    } catch (error) {
      return mapearError(error);
    }
  }
}

export const authService = new AuthService();

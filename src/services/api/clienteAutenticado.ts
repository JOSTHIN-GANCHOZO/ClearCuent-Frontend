import {
  isAxiosError,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { z } from 'zod';

import { authService } from '@/services/auth.service';
import { crearClienteApi } from '@/services/api/clienteApi';
import {
  emitirErrorLimpieza,
  emitirRequiereLogin,
  emitirSesionRevocada,
} from '@/services/api/eventosSesion';
import {
  actualizarAccesoSeguro,
  obtenerSesionSegura,
} from '@/services/sesion.service';

declare module 'axios' {
  export interface AxiosRequestConfig {
    reintentoSesionAutorizado?: boolean;
    reintentoSesionRealizado?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    reintentoSesionAutorizado?: boolean;
    reintentoSesionRealizado?: boolean;
  }
}

const errorApiSchema = z
  .object({ error: z.object({ codigo: z.string() }).passthrough() })
  .passthrough();

export class ErrorClienteAutenticado extends Error {
  constructor(public readonly codigo: 'sesion_no_disponible' | 'renovacion_fallida') {
    super(codigo);
    this.name = 'ErrorClienteAutenticado';
  }
}

let renovacionEnCurso: Promise<string> | null = null;

async function renovarAcceso(tokenRenovacion: string): Promise<string> {
  const resultado = await authService.renovarSesion(tokenRenovacion);
  if (resultado.tipo === 'sesionRevocada') {
    emitirSesionRevocada();
    throw new ErrorClienteAutenticado('sesion_no_disponible');
  }
  if (resultado.tipo === 'requiereLogin') {
    emitirRequiereLogin(false);
    throw new ErrorClienteAutenticado('sesion_no_disponible');
  }
  if (resultado.tipo !== 'exito') throw new ErrorClienteAutenticado('renovacion_fallida');

  const actualizacion = await actualizarAccesoSeguro(
    resultado.tokenAcceso,
    resultado.accesoExpiraEn,
  );
  if (actualizacion.tipo !== 'actualizada') {
    if (actualizacion.tipo === 'requiereLogin') emitirRequiereLogin(true);
    else emitirErrorLimpieza();
    throw new ErrorClienteAutenticado('sesion_no_disponible');
  }
  return resultado.tokenAcceso;
}

function compartirRenovacion(tokenRenovacion: string): Promise<string> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = renovarAcceso(tokenRenovacion).finally(() => {
      renovacionEnCurso = null;
    });
  }
  return renovacionEnCurso;
}

async function obtenerAccessVigente(): Promise<string> {
  const lectura = await obtenerSesionSegura();
  if (lectura.tipo === 'errorLectura') {
    throw new ErrorClienteAutenticado('renovacion_fallida');
  }
  if (lectura.tipo !== 'sesion') {
    emitirRequiereLogin(false);
    throw new ErrorClienteAutenticado('sesion_no_disponible');
  }

  const ahora = Date.now();
  if (Date.parse(lectura.sesion.accesoExpiraEn) > ahora) return lectura.sesion.tokenAcceso;
  if (Date.parse(lectura.sesion.renovacionExpiraEn) <= ahora) {
    emitirRequiereLogin(false);
    throw new ErrorClienteAutenticado('sesion_no_disponible');
  }
  return compartirRenovacion(lectura.sesion.tokenRenovacion);
}

function codigoRespuesta(error: AxiosError): string | undefined {
  const validacion = errorApiSchema.safeParse(error.response?.data);
  return validacion.success ? validacion.data.error.codigo : undefined;
}

function puedeReintentarse(configuracion: InternalAxiosRequestConfig): boolean {
  const metodo = configuracion.method?.toUpperCase();
  return metodo === 'GET' || metodo === 'HEAD' || configuracion.reintentoSesionAutorizado === true;
}

export function crearClienteAutenticado(): AxiosInstance {
  const cliente = crearClienteApi();

  cliente.interceptors.request.use(async (configuracion) => {
    const tokenAcceso = await obtenerAccessVigente();
    configuracion.headers.set('Authorization', `Bearer ${tokenAcceso}`);
    return configuracion;
  });

  cliente.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error) || !error.config || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const codigo = codigoRespuesta(error);
    if (codigo === 'sesion_revocada') {
      emitirSesionRevocada();
      return Promise.reject(error);
    }
    if (codigo === 'token_invalido') {
      emitirRequiereLogin(false);
      return Promise.reject(error);
    }
    if (codigo !== 'token_vencido' || error.config.reintentoSesionRealizado) {
      return Promise.reject(error);
    }

    const lectura = await obtenerSesionSegura();
    if (lectura.tipo === 'errorLectura') return Promise.reject(error);
    if (lectura.tipo !== 'sesion') {
      emitirRequiereLogin(false);
      return Promise.reject(error);
    }
    if (Date.parse(lectura.sesion.renovacionExpiraEn) <= Date.now()) {
      emitirRequiereLogin(false);
      return Promise.reject(error);
    }

    let tokenAcceso: string;
    try {
      tokenAcceso = await compartirRenovacion(lectura.sesion.tokenRenovacion);
    } catch {
      return Promise.reject(error);
    }

    // RF-02 CA4: una escritura no se repite sin autorización contractual explícita.
    if (!puedeReintentarse(error.config)) return Promise.reject(error);
    error.config.reintentoSesionRealizado = true;
    error.config.headers.set('Authorization', `Bearer ${tokenAcceso}`);
    return cliente.request(error.config);
  });

  return cliente;
}

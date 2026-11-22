const MENSAJE_CONFIGURACION_INVALIDA = 'La configuración de red no está disponible.';

export class ErrorConfiguracionApi extends Error {
  constructor() {
    super(MENSAJE_CONFIGURACION_INVALIDA);
    this.name = 'ErrorConfiguracionApi';
  }
}

export function obtenerUrlApi(): URL {
  const valor = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!valor) {
    throw new ErrorConfiguracionApi();
  }

  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new ErrorConfiguracionApi();
    }
    return url;
  } catch (error) {
    if (error instanceof ErrorConfiguracionApi) {
      throw error;
    }
    throw new ErrorConfiguracionApi();
  }
}

export function obtenerUrlEndpoint(ruta: string): string {
  const urlApi = obtenerUrlApi();
  return new URL(ruta, urlApi.origin).toString();
}

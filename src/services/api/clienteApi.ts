import { create, type AxiosInstance } from 'axios';

import { obtenerUrlApi } from '@/services/api/configuracionApi';

export function crearClienteApi(): AxiosInstance {
  // RF-02: validar la configuración antes de permitir cualquier solicitud de autenticación.
  obtenerUrlApi();
  return create({
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
}

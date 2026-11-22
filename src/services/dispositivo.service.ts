import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const CLAVE_DISPOSITIVO = 'dispositivoId';
const uuidSchema = z.string().uuid();

let solicitudDispositivo: Promise<string> | undefined;

async function resolverDispositivoId(): Promise<string> {
  const existente = await SecureStore.getItemAsync(CLAVE_DISPOSITIVO);
  if (existente !== null) {
    const validacion = uuidSchema.safeParse(existente);
    if (!validacion.success) {
      throw new Error('identificador_dispositivo_invalido');
    }
    return validacion.data;
  }

  // RF-07 / RN 5.6.6: el UUID identifica esta instalación y no cada intento de login.
  const nuevo = randomUUID();
  await SecureStore.setItemAsync(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

export function obtenerDispositivoId(): Promise<string> {
  solicitudDispositivo ??= resolverDispositivoId().catch((error: unknown) => {
    solicitudDispositivo = undefined;
    throw error;
  });
  return solicitudDispositivo;
}

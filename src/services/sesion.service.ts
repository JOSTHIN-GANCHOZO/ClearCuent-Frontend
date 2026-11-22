import * as SecureStore from 'expo-secure-store';

export type DatosSesionSegura = {
  tokenAcceso: string;
  tokenRenovacion: string;
  accesoExpiraEn: string;
  renovacionExpiraEn: string;
};

const CLAVES_SESION = {
  tokenAcceso: 'sesion.tokenAcceso',
  tokenRenovacion: 'sesion.tokenRenovacion',
  accesoExpiraEn: 'sesion.accesoExpiraEn',
  renovacionExpiraEn: 'sesion.renovacionExpiraEn',
} as const;

export async function limpiarSesionSegura(): Promise<void> {
  await Promise.allSettled(
    Object.values(CLAVES_SESION).map((clave) => SecureStore.deleteItemAsync(clave)),
  );
}

export async function guardarSesionSegura(sesion: DatosSesionSegura): Promise<void> {
  try {
    // RF-02 CA4: tokens y expiraciones se conservan exclusivamente en SecureStore.
    await SecureStore.setItemAsync(CLAVES_SESION.tokenAcceso, sesion.tokenAcceso);
    await SecureStore.setItemAsync(CLAVES_SESION.tokenRenovacion, sesion.tokenRenovacion);
    await SecureStore.setItemAsync(CLAVES_SESION.accesoExpiraEn, sesion.accesoExpiraEn);
    await SecureStore.setItemAsync(CLAVES_SESION.renovacionExpiraEn, sesion.renovacionExpiraEn);
  } catch {
    // RF-02 CA4: una escritura parcial nunca deja una sesión utilizable.
    await limpiarSesionSegura();
    throw new Error('sesion_no_persistida');
  }
}

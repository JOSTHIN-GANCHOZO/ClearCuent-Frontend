import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';

import {
  ErrorConfiguracionApi,
  obtenerUrlApi,
  obtenerUrlEndpoint,
} from '@/services/api/configuracionApi';

const CLAVE_URL = 'EXPO_PUBLIC_API_URL';
const MENSAJE = 'La configuración de red no está disponible.';
let valorOriginal: string | undefined;

describe('configuracionApi — comunicacion cifrada', () => {
  beforeEach(() => {
    valorOriginal = process.env[CLAVE_URL];
  });

  afterEach(() => {
    if (valorOriginal === undefined) {
      delete process.env[CLAVE_URL];
    } else {
      process.env[CLAVE_URL] = valorOriginal;
    }
  });

  test('RNF-02: rechaza una URL http sin cifrar', () => {
    process.env[CLAVE_URL] = 'http://api.example.test';

    expect(() => obtenerUrlApi()).toThrow(ErrorConfiguracionApi);
    expect(() => obtenerUrlApi()).toThrow(MENSAJE);
  });

  test('RNF-02: acepta una URL https y construye el endpoint sobre su origen', () => {
    process.env[CLAVE_URL] = 'https://api.example.test/base';

    expect(obtenerUrlApi().protocol).toBe('https:');
    expect(obtenerUrlEndpoint('/api/v1/auth/login')).toBe(
      'https://api.example.test/api/v1/auth/login',
    );
  });

  test('RNF-02: rechaza la configuracion ausente o vacia', () => {
    delete process.env[CLAVE_URL];
    expect(() => obtenerUrlApi()).toThrow(ErrorConfiguracionApi);

    process.env[CLAVE_URL] = '   ';
    expect(() => obtenerUrlApi()).toThrow(ErrorConfiguracionApi);
  });

  test('RNF-02: rechaza una URL con credenciales incrustadas', () => {
    process.env[CLAVE_URL] = 'https://usuario:clave@api.example.test';

    expect(() => obtenerUrlApi()).toThrow(ErrorConfiguracionApi);
  });

  test('RNF-02: rechaza una URL malformada', () => {
    process.env[CLAVE_URL] = 'no-es-una-url';

    expect(() => obtenerUrlApi()).toThrow(ErrorConfiguracionApi);
  });
});

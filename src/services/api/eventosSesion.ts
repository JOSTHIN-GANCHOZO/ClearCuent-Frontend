export type EventoSesion =
  | { tipo: 'sesionRevocada' }
  | { tipo: 'requiereLogin'; limpiezaVerificada: boolean }
  | { tipo: 'errorLimpieza' };

type SuscriptorSesion = (evento: EventoSesion) => void;

const suscriptores = new Set<SuscriptorSesion>();

export function emitirSesionRevocada(): void {
  emitirEventoSesion({ tipo: 'sesionRevocada' });
}

export function emitirRequiereLogin(limpiezaVerificada: boolean): void {
  emitirEventoSesion({ tipo: 'requiereLogin', limpiezaVerificada });
}

export function emitirErrorLimpieza(): void {
  emitirEventoSesion({ tipo: 'errorLimpieza' });
}

function emitirEventoSesion(evento: EventoSesion): void {
  suscriptores.forEach((suscriptor) => suscriptor(evento));
}

export function suscribirEventosSesion(suscriptor: SuscriptorSesion): () => void {
  suscriptores.add(suscriptor);
  return () => suscriptores.delete(suscriptor);
}

// Identidad Emerald & Mint: fuente única docs/diseno/paleta.md.
export const colores = {
  verdeProfundo: '#12352B',
  primario: '#166534',
  esmeralda: '#16A36A',
  menta: '#34D399',
  mentaClaro: '#A7F3D0',
  fondo: '#F8FAF8',
  superficie: '#FFFFFF',
  superficieSecundaria: '#F1F5F3',
  fondoSuave: '#DCFCE7',
  textoPrincipal: '#1F2937',
  textoSecundario: '#475569',
  textoApagado: '#94A3A0',
  borde: '#E2E8E5',
  exito: '#15803D',
  exitoFondo: '#DCFCE7',
  advertencia: '#B45309',
  advertenciaFondo: '#FEF3C7',
  error: '#B91C1C',
  errorFondo: '#FEE2E2',
  informacion: '#1D4ED8',
  informacionFondo: '#DBEAFE',
} as const;

// Marca institucional: fuente única docs/diseno/logo/clearcuent-icon.svg.
export const coloresMarca = {
  fondoIcono: '#12302A',
  trazoIcono: '#FFFFFF',
  acentoIcono: '#2EE59D',
} as const;

export type Colores = typeof colores;

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { EstadoRestauracionSesion } from '@/features/cuenta/hooks/useRestauracionSesionViewModel';
import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

type RestauracionSesionScreenProps = {
  estado: Exclude<EstadoRestauracionSesion, 'inicio' | 'autorizada'>;
  onReintentar?: () => void;
  procesando?: boolean;
  segundosRestantes?: number;
};

type ContenidoEstado = {
  titulo: string;
  detalle: string;
  semantica: 'actividad' | 'informacion' | 'advertencia' | 'error';
};

function formatearEspera(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (minutos === 0) return `${resto} s`;
  if (resto === 0) return `${minutos} min`;
  return `${minutos} min ${resto} s`;
}

function obtenerContenido(
  estado: RestauracionSesionScreenProps['estado'],
  segundosRestantes?: number,
): ContenidoEstado {
  switch (estado) {
    case 'verificando':
      return {
        titulo: 'Comprobando tu sesión',
        detalle: 'Esto tomará solo un momento.',
        semantica: 'actividad',
      };
    case 'renovando':
      return {
        titulo: 'Restableciendo tu sesión',
        detalle: 'Mantén ClearCuent abierto.',
        semantica: 'actividad',
      };
    case 'sinConexion':
      return {
        titulo: 'No hay conexión',
        detalle: 'Conéctate a internet y vuelve a intentarlo. Tu sesión sigue guardada.',
        semantica: 'informacion',
      };
    case 'limiteSolicitudes':
      return {
        titulo: 'Espera para reintentar',
        detalle:
          segundosRestantes && segundosRestantes > 0
            ? `Podrás intentarlo de nuevo en ${formatearEspera(segundosRestantes)}. Tu sesión sigue guardada.`
            : 'Ya puedes volver a intentarlo.',
        semantica: 'advertencia',
      };
    case 'errorLimpieza':
      return {
        titulo: 'No pudimos cerrar la sesión',
        detalle: 'Por seguridad, no puedes continuar todavía. Vuelve a intentarlo.',
        semantica: 'error',
      };
    default:
      return {
        titulo: 'No pudimos restablecer tu sesión',
        detalle: 'Tu sesión sigue guardada. Vuelve a intentarlo.',
        semantica: 'error',
      };
  }
}

export function RestauracionSesionScreen({
  estado,
  onReintentar,
  procesando = false,
  segundosRestantes,
}: RestauracionSesionScreenProps) {
  const [movimientoReducido, setMovimientoReducido] = useState(false);
  const tituloNodoRef = useRef<number | null | undefined>(null);
  const contenido = obtenerContenido(estado, segundosRestantes);
  const esActividad = contenido.semantica === 'actividad';
  const reintentoBloqueado =
    procesando || (estado === 'limiteSolicitudes' && (segundosRestantes ?? 0) > 0);
  const muestraAccion = !esActividad;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setMovimientoReducido);
    const suscripcion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setMovimientoReducido,
    );
    return () => suscripcion.remove();
  }, []);

  useEffect(() => {
    if (esActividad) return;
    if (tituloNodoRef.current) AccessibilityInfo.setAccessibilityFocus(tituloNodoRef.current);
  }, [esActividad, estado]);

  useEffect(() => {
    if (estado === 'limiteSolicitudes' && segundosRestantes === 0) {
      AccessibilityInfo.announceForAccessibility('Ya puedes volver a intentarlo');
    }
  }, [estado, segundosRestantes]);

  const estiloInsignia =
    contenido.semantica === 'advertencia'
      ? styles.insigniaAdvertencia
      : contenido.semantica === 'informacion'
        ? styles.insigniaInformacion
        : styles.insigniaError;
  const estiloSimbolo =
    contenido.semantica === 'advertencia'
      ? styles.simboloAdvertencia
      : contenido.semantica === 'informacion'
        ? styles.simboloInformacion
        : styles.simboloError;

  return (
    <SafeAreaView style={styles.seguro}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.logo}
        >
          <LogoClearCuent />
        </View>

        <View accessibilityState={{ busy: esActividad || procesando }} style={styles.centro}>
          {esActividad ? (
            movimientoReducido ? (
              <View accessibilityElementsHidden style={styles.marcaEstatica} />
            ) : (
              <ActivityIndicator
                accessibilityElementsHidden
                color={colores.primario}
                importantForAccessibility="no-hide-descendants"
                size="large"
              />
            )
          ) : (
            <View accessibilityElementsHidden style={[styles.insignia, estiloInsignia]}>
              <Text style={[styles.simbolo, estiloSimbolo]}>
                {contenido.semantica === 'informacion' ? 'i' : '!'}
              </Text>
            </View>
          )}

          <Text
            accessibilityLiveRegion={esActividad ? 'polite' : 'none'}
            accessibilityRole="header"
            ref={(elemento) => {
              tituloNodoRef.current = findNodeHandle(elemento);
            }}
            style={styles.titulo}
          >
            {contenido.titulo}
          </Text>
          <Text style={styles.detalle}>{contenido.detalle}</Text>

          {muestraAccion ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: reintentoBloqueado }}
              disabled={reintentoBloqueado}
              onPress={onReintentar}
              style={({ pressed }) => [
                styles.boton,
                reintentoBloqueado && styles.botonDeshabilitado,
                pressed && !reintentoBloqueado && styles.botonPresionado,
              ]}
            >
              <Text
                style={[
                  styles.botonTexto,
                  reintentoBloqueado && styles.botonTextoDeshabilitado,
                ]}
              >
                Reintentar
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.pie}>ClearCuent Merchant</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seguro: { backgroundColor: colores.fondo, flex: 1 },
  contenido: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logo: { alignItems: 'center', marginTop: 72 },
  centro: { alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%' },
  marcaEstatica: {
    backgroundColor: colores.primario,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  insignia: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  insigniaInformacion: { backgroundColor: colores.informacionFondo },
  insigniaAdvertencia: { backgroundColor: colores.advertenciaFondo },
  insigniaError: { backgroundColor: colores.errorFondo },
  simbolo: { fontSize: 24, fontWeight: '800' },
  simboloInformacion: { color: colores.informacion },
  simboloAdvertencia: { color: colores.advertencia },
  simboloError: { color: colores.error },
  titulo: {
    color: colores.verdeProfundo,
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 24,
    textAlign: 'center',
  },
  detalle: {
    color: colores.textoSecundario,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  boton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colores.primario,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  botonPresionado: { backgroundColor: colores.verdeProfundo },
  botonDeshabilitado: { backgroundColor: colores.superficieSecundaria },
  botonTexto: { color: colores.superficie, fontSize: 16, fontWeight: '700' },
  botonTextoDeshabilitado: { color: colores.textoApagado },
  pie: {
    color: colores.textoSecundario,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    textAlign: 'center',
  },
});

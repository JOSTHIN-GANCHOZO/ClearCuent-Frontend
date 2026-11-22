import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type ResultadoCambioDispositivoUi,
  useCambioDispositivoViewModel,
} from '@/features/cuenta/hooks/useCambioDispositivoViewModel';
import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

type CambioDispositivoScreenProps = {
  onCancelar: () => void;
  onConfirmar: () => Promise<ResultadoCambioDispositivoUi>;
};

export function CambioDispositivoScreen({
  onCancelar,
  onConfirmar,
}: CambioDispositivoScreenProps) {
  const { confirmar, estado, reintentarEnSegundos } = useCambioDispositivoViewModel({
    onConfirmar,
  });
  const procesando = estado === 'procesando';
  const conEspera = estado === 'bloqueado' || estado === 'limiteSolicitudes';
  const espera = reintentarEnSegundos !== undefined && reintentarEnSegundos > 0;
  // RF-02 CA3 / RF-07 CA2: se muestra el tiempo informado por el backend sin revelar si el correo existe.
  const detalleRechazo = espera
    ? `Intenta nuevamente en ${reintentarEnSegundos} segundos. Si cancelas, conservarás tu sesión anterior.`
    : 'Intenta nuevamente más tarde. Si cancelas, conservarás tu sesión anterior.';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.seguro}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <LogoClearCuent compacto />
        <View style={styles.tarjeta}>
          <View style={styles.insignia}>
            <Text accessibilityElementsHidden style={styles.insigniaTexto}>
              !
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.titulo}>
            {conEspera
              ? estado === 'bloqueado'
                ? 'Acceso bloqueado temporalmente'
                : 'Demasiadas solicitudes. Intenta nuevamente más tarde'
              : estado === 'error'
                ? 'No pudimos completar el cambio de dispositivo'
                : procesando
                  ? 'Confirmando cambio de dispositivo…'
                  : 'Otra sesión activa'}
          </Text>

          {conEspera || estado === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={styles.descripcion}>
              {detalleRechazo}
            </Text>
          ) : procesando ? (
            <Text style={styles.descripcion}>Estamos validando tu solicitud. No cierres la aplicación.</Text>
          ) : (
            <View>
              <Text style={styles.descripcion}>Existe una sesión activa en otro dispositivo.</Text>
              <View style={styles.advertencia}>
                <Text style={styles.advertenciaTitulo}>Antes de continuar</Text>
                <Text style={styles.advertenciaTexto}>
                  Los datos no sincronizados del dispositivo anterior se perderán. La sesión anterior
                  será revocada.
                </Text>
              </View>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: procesando, disabled: procesando }}
            disabled={procesando}
            onPress={confirmar}
            style={({ pressed }) => [
              styles.botonPrincipal,
              procesando && styles.botonDeshabilitado,
              pressed && !procesando && styles.botonPresionado,
            ]}
          >
            {procesando ? <ActivityIndicator color={colores.superficie} size="small" /> : null}
            <Text style={styles.botonPrincipalTexto}>
              {procesando
                ? 'Confirmando…'
                : estado === 'error' || conEspera
                  ? 'Intentar nuevamente'
                  : 'Continuar en este dispositivo'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: procesando }}
            disabled={procesando}
            onPress={onCancelar}
            style={({ pressed }) => [styles.botonSecundario, pressed && styles.secundarioPresionado]}
          >
            <Text style={[styles.botonSecundarioTexto, procesando && styles.textoDeshabilitado]}>
              Cancelar
            </Text>
          </Pressable>
        </View>
        <Text style={styles.pie}>ClearCuent Merchant</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seguro: { backgroundColor: colores.fondo, flex: 1 },
  contenido: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 30,
    padding: 22,
  },
  insignia: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colores.advertenciaFondo,
    borderRadius: 22,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  insigniaTexto: { color: colores.advertencia, fontSize: 36, fontWeight: '800' },
  titulo: {
    color: colores.verdeProfundo,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 31,
    marginTop: 22,
    textAlign: 'center',
  },
  descripcion: {
    color: colores.textoSecundario,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'center',
  },
  advertencia: {
    backgroundColor: colores.advertenciaFondo,
    borderColor: colores.advertencia,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  advertenciaTitulo: { color: colores.advertencia, fontSize: 14, fontWeight: '800' },
  advertenciaTexto: {
    color: colores.textoPrincipal,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  botonPrincipal: {
    alignItems: 'center',
    backgroundColor: colores.primario,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  botonDeshabilitado: { backgroundColor: colores.textoApagado },
  botonPresionado: { backgroundColor: colores.verdeProfundo },
  botonPrincipalTexto: { color: colores.superficie, fontSize: 15, fontWeight: '800' },
  botonSecundario: { alignItems: 'center', justifyContent: 'center', minHeight: 50, marginTop: 8 },
  botonSecundarioTexto: { color: colores.primario, fontSize: 15, fontWeight: '700' },
  secundarioPresionado: { backgroundColor: colores.fondoSuave, borderRadius: 14 },
  textoDeshabilitado: { color: colores.textoApagado },
  pie: { color: colores.textoSecundario, fontSize: 12, marginTop: 18, textAlign: 'center' },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

type SesionRevocadaScreenProps = {
  onIniciarSesion: () => void;
};

export function SesionRevocadaScreen({ onIniciarSesion }: SesionRevocadaScreenProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.seguro}>
      <View style={styles.contenido}>
        <LogoClearCuent compacto />
        <View style={styles.tarjeta}>
          <View style={styles.insignia}>
            <Text accessibilityElementsHidden style={styles.insigniaTexto}>
              !
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.titulo}>
            Tu sesión dejó de estar activa
          </Text>
          <Text style={styles.descripcion}>
            Por seguridad, vuelve a iniciar sesión para continuar.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onIniciarSesion}
            style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
          >
            <Text style={styles.botonTexto}>Iniciar sesión nuevamente</Text>
          </Pressable>
        </View>
        <Text style={styles.pie}>ClearCuent Merchant</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seguro: { backgroundColor: colores.fondo, flex: 1 },
  contenido: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  tarjeta: {
    alignItems: 'center',
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 30,
    padding: 24,
  },
  insignia: {
    alignItems: 'center',
    backgroundColor: colores.informacionFondo,
    borderRadius: 22,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  insigniaTexto: { color: colores.informacion, fontSize: 36, fontWeight: '800' },
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
    marginTop: 10,
    textAlign: 'center',
  },
  boton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colores.primario,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  botonPresionado: { backgroundColor: colores.verdeProfundo },
  botonTexto: { color: colores.superficie, fontSize: 15, fontWeight: '800' },
  pie: { color: colores.textoSecundario, fontSize: 12, marginTop: 18, textAlign: 'center' },
});

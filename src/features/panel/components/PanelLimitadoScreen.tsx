import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

export function PanelLimitadoScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.seguro}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.marca}>
          <LogoClearCuent />
        </View>

        <Text accessibilityRole="header" style={styles.titulo}>
          Panel
        </Text>

        <View style={styles.bloqueInformativo}>
          <View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.barraDecorativa}
          />
          <View style={styles.informacion}>
            <Text style={styles.tituloInformativo}>Información todavía no disponible</Text>
            <Text style={styles.detalle}>
              Este panel todavía no muestra información de tu negocio.
            </Text>
          </View>
        </View>

        <View style={styles.espacio} />
        <Text style={styles.pie}>ClearCuent Merchant</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seguro: { backgroundColor: colores.fondo, flex: 1 },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  marca: { alignItems: 'center' },
  titulo: {
    color: colores.verdeProfundo,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 38,
  },
  bloqueInformativo: {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    overflow: 'hidden',
  },
  barraDecorativa: {
    backgroundColor: colores.esmeralda,
    width: 6,
  },
  informacion: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  tituloInformativo: {
    color: colores.textoPrincipal,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  detalle: {
    color: colores.textoSecundario,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  espacio: { flex: 1, minHeight: 72 },
  pie: {
    color: colores.textoSecundario,
    fontSize: 12,
    marginTop: 18,
    textAlign: 'center',
  },
});

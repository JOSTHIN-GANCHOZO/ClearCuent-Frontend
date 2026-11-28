import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInicioViewModel } from '@/features/cuenta/hooks/useInicioViewModel';
import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

export function InicioScreen() {
  useInicioViewModel();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.seguro}>
      <View style={styles.decoracionSuperior} />
      <View style={styles.decoracionInferior} />

      <View
        accessible
        accessibilityLabel="ClearCuent. Preparando la aplicación."
        style={styles.contenido}
      >
        <View style={styles.centro}>
          <LogoClearCuent />
          <View style={styles.acento} />

          <View style={styles.estado}>
            <ActivityIndicator
              accessibilityElementsHidden
              color={colores.primario}
              importantForAccessibility="no-hide-descendants"
              size="large"
            />
            <Text accessibilityLiveRegion="polite" style={styles.estadoTexto}>
              Preparando ClearCuent…
            </Text>
          </View>
        </View>

        <Text style={styles.pie}>ClearCuent Merchant</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  seguro: {
    backgroundColor: colores.fondo,
    flex: 1,
    overflow: 'hidden',
  },
  decoracionSuperior: {
    backgroundColor: colores.fondoSuave,
    borderRadius: 180,
    height: 280,
    left: -150,
    opacity: 0.55,
    position: 'absolute',
    top: -130,
    width: 280,
  },
  decoracionInferior: {
    backgroundColor: colores.superficieSecundaria,
    borderRadius: 160,
    bottom: -125,
    height: 250,
    opacity: 0.8,
    position: 'absolute',
    right: -125,
    width: 250,
  },
  contenido: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  centro: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  acento: {
    backgroundColor: colores.esmeralda,
    borderRadius: 2,
    height: 4,
    marginTop: 16,
    width: 56,
  },
  estado: {
    alignItems: 'center',
    gap: 14,
    marginTop: 48,
  },
  estadoTexto: {
    color: colores.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  pie: {
    color: colores.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 18,
    textAlign: 'center',
  },
});

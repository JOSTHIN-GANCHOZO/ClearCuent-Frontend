import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { colores, coloresMarca } from '@/shared/theme/colores';

type LogoClearCuentProps = {
  compacto?: boolean;
};

export function LogoClearCuent({ compacto = false }: LogoClearCuentProps) {
  const tamano = compacto ? 38 : 52;

  return (
    <View accessible accessibilityLabel="ClearCuent" style={styles.contenedor}>
      {/* Marca oficial: geometría de docs/diseno/logo/clearcuent-icon.svg. */}
      <Svg height={tamano} viewBox="0 0 200 200" width={tamano}>
        <Rect fill={coloresMarca.fondoIcono} height="200" rx="32" width="200" />
        <Path
          d="M123 77 A35 35 0 1 0 123 123"
          fill="none"
          stroke={coloresMarca.trazoIcono}
          strokeLinecap="butt"
          strokeWidth="22"
        />
        <Circle cx="137" cy="112" fill={coloresMarca.acentoIcono} r="6.5" />
      </Svg>
      <Text style={[styles.nombre, compacto && styles.nombreCompacto]}>ClearCuent</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  nombre: {
    color: colores.verdeProfundo,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  nombreCompacto: {
    fontSize: 22,
  },
});

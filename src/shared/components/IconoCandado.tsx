import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colores } from '@/shared/theme/colores';

type IconoCandadoProps = Pick<SvgProps, 'style'> & {
  color?: string;
};

// RF-02 (UI/UX aprobada, login-moderno.md §5): icono guia del campo de contrasena.
// Decorativo: el nombre accesible lo aporta el TextInput, no el SVG.
export function IconoCandado({ color = colores.textoSecundario, style }: IconoCandadoProps) {
  return (
    <Svg
      accessible={false}
      fill="none"
      height={20}
      importantForAccessibility="no-hide-descendants"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      style={style}
      viewBox="0 0 24 24"
      width={20}
    >
      <Path d="M8 10 V7 A4 4 0 0 1 16 7 V10" />
      <Rect height="10" rx="2.5" width="14" x="5" y="10" />
      <Circle cx="12" cy="14.5" fill={color} r="1.2" stroke="none" />
    </Svg>
  );
}

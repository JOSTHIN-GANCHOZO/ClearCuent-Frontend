import type { SvgProps } from 'react-native-svg';
import Svg, { Path, Rect } from 'react-native-svg';

import { colores } from '@/shared/theme/colores';

type IconoCorreoProps = Pick<SvgProps, 'style'> & {
  color?: string;
};

// RF-02 (UI/UX aprobada, login-moderno.md §5): icono guia del campo de correo.
// Decorativo: el nombre accesible lo aporta el TextInput, no el SVG.
export function IconoCorreo({ color = colores.textoSecundario, style }: IconoCorreoProps) {
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
      <Rect height="14" rx="3" width="20" x="2" y="5" />
      <Path d="M3 7 L12 13 L21 7" />
    </Svg>
  );
}

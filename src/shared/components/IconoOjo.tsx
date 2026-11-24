import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Path } from 'react-native-svg';

import { colores } from '@/shared/theme/colores';

type IconoOjoProps = Pick<SvgProps, 'style'> & {
  color?: string;
  tachado?: boolean;
};

// RF-02 (UI/UX aprobada, login-moderno.md §5): abierto = accion «Mostrar»,
// tachado = accion «Ocultar». Sin fundido (decision cerrada §6).
// Decorativo: el nombre accesible lo aporta el Pressable, no el SVG.
export function IconoOjo({
  color = colores.primario,
  style,
  tachado = false,
}: IconoOjoProps) {
  return (
    <Svg
      accessible={false}
      fill="none"
      height={22}
      importantForAccessibility="no-hide-descendants"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      style={style}
      viewBox="0 0 24 24"
      width={22}
    >
      <Path d="M2 12 C4.5 7.5 8 6 12 6 C16 6 19.5 7.5 22 12 C19.5 16.5 16 18 12 18 C8 18 4.5 16.5 2 12 Z" />
      <Circle cx="12" cy="12" r="3" />
      {tachado ? <Path d="M4 4 L20 20" /> : null}
    </Svg>
  );
}

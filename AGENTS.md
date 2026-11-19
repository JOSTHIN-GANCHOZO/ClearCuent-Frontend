# AGENTS.md — app móvil de ClearCuent

Abrir OpenCode desde el hub `ClearCuent/`. Aplicar las reglas globales de `../AGENTS.md` y los requisitos de `../docs/DERCAS.md`; este archivo **solo** añade reglas específicas de mobile. DA-12/AM-43: `mobile/` será un repositorio independiente y la documentación/agentes permanecen en el hub. D-03 instaló Expo SDK 58 el 18/11/2026; no hay Git ni implementación de RF.

## Stack y estructura

- React Native, Expo (development build, **no Expo Go** para cifrado/offline), TypeScript, Expo Router, expo-sqlite. Apoyo aprobado en DERCAS 5.2: React Hook Form + Zod, Axios, date-fns, expo-crypto, expo-secure-store, expo-notifications, expo-network, expo-task-manager + expo-background-task, expo-file-system, expo-image-picker, expo-print, react-native-view-shot, expo-sharing y Linking (`wa.me`). Sin librerías nuevas sin aprobación.
- `app/` contiene solo rutas de Expo Router; pantallas usan hooks ViewModel de `src/features/<modulo>/{components,hooks,schemas}` (clientes, ventas, abonos, egresos, panel, catalogo, recordatorios y cuenta). ADMIN pasa a `../adminweb/` Angular + TypeScript (RF-58/AM-47, autorización 14/11/2026). Componentes nunca llaman Axios ni SQLite directamente. `src/db/` para SQLite/repositorios, `src/sync/` para cola/sincronización/tareas, `src/services/` para API/notificaciones/comprobantes y `src/shared/` para componentes, utilidades y tema.
- Las escrituras de negocio pasan por cola offline persistente con UUID `randomUUID()` e `id_operacion` único (`POST /sync/push`); lecturas por `GET /sync/cambios`. Esperar contrato compartido aprobado en `../docs/diseno/` antes de implementar `/sync`; no inventar cuerpos ni cifrado. Un solo dispositivo activo y restricciones offline siguen `../AGENTS.md` y DERCAS RF-07/08/46–50.

## Interfaz y seguridad

- Usar `../docs/diseno/paleta.md` y los SVG de `../docs/diseno/logo/`, conservando la marca Emerald & Mint. No hay constantes de tema implementadas: crear `src/shared/theme/colores.ts` a partir de la paleta solo en tarea móvil aprobada; no importar rutas inexistentes. Nunca hexadecimales sueltos en componentes; colores semánticos distintos para éxito/advertencia/error/info. Menta y verde claro no como texto pequeño sobre blanco. Máximo uno o dos degradados por pantalla; pedir aprobación para `expo-linear-gradient` antes de añadirlo.
- Tokens móviles en `expo-secure-store`, no en componentes; no crear `features/admin` ni conceder acceso comercial a `ADMIN` (RF-58). Notificaciones de cuotas locales (30 días, hasta 60); push servidor solo resumen diario; WhatsApp siempre manual y solo con conexión, sin abrir chat ni registrar «iniciado» offline (AM-46 resuelto el 16/11/2026). Comprobantes y pagos según reglas del hub; dinero internamente en centavos, solo UI lo formatea con `dinero.ts`.
- A4 `desarrollador-frontend` implementa móvil con los permisos existentes; A2 `disenador` solo propone UI/UX en `../docs/diseno/ui-ux/**` usando paleta/logos, sin código ni diseño técnico. A6 revisa y Josthin aprueba antes de implementar; los cambios de contrato/seguridad requieren sus aprobaciones específicas.
- `EXPO_PUBLIC_API_URL` por perfil EAS es propuesta D-13, no decisión aprobada; nunca secretos en `EXPO_PUBLIC_*`. Cifrado local, claves y tokens requieren aprobación humana específica.

## Verificación y límites

- Desde `mobile/`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`; `npx expo start` y EAS solo tras sus autorizaciones. Expo Doctor 20/20, pares, lint/typecheck y descubrimiento Jest/RNTL pasan. Cero casos no equivale a suite funcional ejecutada.
- Pruebas de componentes con React Native Testing Library; nombrar casos con RF/CA. No editar `../docs/`, `../.opencode/` ni backend como parte de una tarea exclusivamente móvil. Las operaciones Git siguen las autorizaciones, revisiones, flujo y límites de la sección **Git** de `../AGENTS.md`; ningún agente despliega aplicaciones ni publica releases.

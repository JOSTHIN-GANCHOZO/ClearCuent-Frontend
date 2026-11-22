import { Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LoginForm } from '@/features/cuenta/schemas/login.schema';
import {
  type EstadoLoginUi,
  type ResultadoLoginUi,
  useLoginViewModel,
} from '@/features/cuenta/hooks/useLoginViewModel';
import { LogoClearCuent } from '@/shared/components/LogoClearCuent';
import { colores } from '@/shared/theme/colores';

type LoginScreenProps = {
  onCrearCuenta?: () => void;
  onIniciarSesion: (datos: LoginForm) => Promise<ResultadoLoginUi>;
  onRecuperarContrasena?: () => void;
};

const MENSAJES: Partial<Record<EstadoLoginUi, { titulo: string; detalle?: string }>> = {
  credencialesIncorrectas: { titulo: 'Correo o contraseña incorrectos' },
  bloqueado: {
    titulo: 'Acceso bloqueado temporalmente',
    detalle: 'Después de cinco intentos fallidos, el acceso queda bloqueado durante 15 minutos.',
  },
  sinConexion: {
    titulo: 'Iniciar sesión requiere conexión a internet',
    detalle: 'Conéctate e inténtalo de nuevo.',
  },
  limiteSolicitudes: { titulo: 'Demasiadas solicitudes. Intenta nuevamente más tarde' },
  errorTecnico: { titulo: 'No pudimos completar la solicitud. Intenta nuevamente más tarde' },
};

export function LoginScreen({
  onCrearCuenta,
  onIniciarSesion,
  onRecuperarContrasena,
}: LoginScreenProps) {
  const {
    alternarContrasena,
    control,
    enviar,
    estado,
    formState: { errors },
    mostrarContrasena,
    reintentarEnSegundos,
  } = useLoginViewModel({ onIniciarSesion });
  const procesando = estado === 'procesando';
  const esperaServidor = reintentarEnSegundos !== undefined && reintentarEnSegundos > 0;
  const envioBloqueado = procesando || estado === 'bloqueado' || esperaServidor;
  const mensajeBase = MENSAJES[estado];
  const mensaje =
    mensajeBase && reintentarEnSegundos !== undefined
      ? {
          ...mensajeBase,
          detalle: `Intenta nuevamente en ${reintentarEnSegundos} segundos.`,
        }
      : mensajeBase;
  const textoBoton = procesando
    ? 'Verificando…'
    : estado === 'sinConexion' ||
        estado === 'limiteSolicitudes' ||
        estado === 'errorTecnico'
      ? 'Reintentar'
      : 'Iniciar sesión';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.seguro}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cabecera}>
            <LogoClearCuent />
            <Text accessibilityRole="header" style={styles.titulo}>
              Bienvenido de nuevo
            </Text>
            <Text style={styles.subtitulo}>Ingresa para continuar con tu negocio.</Text>
          </View>

          <View style={styles.tarjeta}>
            {mensaje ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.mensaje,
                  estado === 'sinConexion' || estado === 'limiteSolicitudes'
                    ? styles.mensajeAdvertencia
                    : styles.mensajeError,
                ]}
              >
                <Text style={styles.mensajeTitulo}>{mensaje.titulo}</Text>
                {mensaje.detalle ? <Text style={styles.mensajeDetalle}>{mensaje.detalle}</Text> : null}
              </View>
            ) : null}

            <View style={styles.grupoCampo}>
              <Text style={styles.etiqueta}>Correo electrónico</Text>
              <Controller
                control={control}
                name="correo"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextInput
                    accessibilityHint={errors.correo?.message ?? 'Ingresa el correo de tu cuenta.'}
                    accessibilityLabel="Correo electrónico"
                    accessibilityValue={
                      errors.correo?.message ? { text: `Error: ${errors.correo.message}` } : undefined
                    }
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!procesando}
                    inputMode="email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="tu@negocio.com"
                    placeholderTextColor={colores.textoSecundario}
                    returnKeyType="next"
                    style={[styles.campo, errors.correo && styles.campoError]}
                    value={value}
                  />
                )}
              />
              {errors.correo?.message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  nativeID="error-correo"
                  style={styles.errorCampo}
                >
                  {errors.correo.message}
                </Text>
              ) : null}
            </View>

            <View style={styles.grupoCampo}>
              <Text style={styles.etiqueta}>Contraseña</Text>
              <View style={[styles.campoConAccion, errors.contrasena && styles.campoError]}>
                <Controller
                  control={control}
                  name="contrasena"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      accessibilityHint={
                        errors.contrasena?.message ?? 'Ingresa la contraseña de tu cuenta.'
                      }
                      accessibilityLabel="Contraseña"
                      accessibilityValue={
                        errors.contrasena?.message
                          ? { text: `Error: ${errors.contrasena.message}` }
                          : undefined
                      }
                      autoCapitalize="none"
                      autoComplete="current-password"
                      editable={!procesando}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder="Ingresa tu contraseña"
                      placeholderTextColor={colores.textoSecundario}
                      secureTextEntry={!mostrarContrasena}
                      style={styles.campoContrasena}
                      value={value}
                    />
                  )}
                />
                <Pressable
                  accessibilityLabel={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: procesando }}
                  disabled={procesando}
                  onPress={alternarContrasena}
                  style={({ pressed }) => [styles.mostrar, pressed && styles.presionado]}
                >
                  <Text style={styles.mostrarTexto}>{mostrarContrasena ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>
              {errors.contrasena?.message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  nativeID="error-contrasena"
                  style={styles.errorCampo}
                >
                  {errors.contrasena.message}
                </Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !onRecuperarContrasena || procesando }}
              disabled={!onRecuperarContrasena || procesando}
              onPress={onRecuperarContrasena}
              style={styles.enlaceDerecha}
            >
              <Text
                style={[
                  styles.enlace,
                  (!onRecuperarContrasena || procesando) && styles.enlaceDeshabilitado,
                ]}
              >
                ¿Olvidaste tu contraseña?
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: procesando, disabled: envioBloqueado }}
              disabled={envioBloqueado}
              onPress={() => void enviar()}
              style={({ pressed }) => [
                styles.botonPrincipal,
                envioBloqueado && styles.botonDeshabilitado,
                pressed && !envioBloqueado && styles.botonPresionado,
              ]}
            >
              {procesando ? <ActivityIndicator color={colores.superficie} size="small" /> : null}
              <Text style={styles.botonPrincipalTexto}>
                {textoBoton}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !onCrearCuenta || procesando }}
            disabled={!onCrearCuenta || procesando}
            onPress={onCrearCuenta}
            style={styles.crearCuenta}
          >
            <Text style={styles.crearCuentaTexto}>¿Aún no tienes cuenta? </Text>
            <Text
              style={[
                styles.enlace,
                (!onCrearCuenta || procesando) && styles.enlaceDeshabilitado,
              ]}
            >
              Crear cuenta
            </Text>
          </Pressable>

          <Text style={styles.pie}>ClearCuent Merchant</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  seguro: { backgroundColor: colores.fondo, flex: 1 },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  cabecera: { alignItems: 'center', marginBottom: 28 },
  titulo: {
    color: colores.verdeProfundo,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 28,
    textAlign: 'center',
  },
  subtitulo: {
    color: colores.textoSecundario,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  mensaje: { borderRadius: 14, borderWidth: 1, marginBottom: 18, padding: 13 },
  mensajeError: { backgroundColor: colores.errorFondo, borderColor: colores.error },
  mensajeAdvertencia: {
    backgroundColor: colores.advertenciaFondo,
    borderColor: colores.advertencia,
  },
  mensajeTitulo: { color: colores.textoPrincipal, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  mensajeDetalle: { color: colores.textoSecundario, fontSize: 13, lineHeight: 19, marginTop: 4 },
  grupoCampo: { marginBottom: 16 },
  etiqueta: { color: colores.textoPrincipal, fontSize: 14, fontWeight: '700', marginBottom: 7 },
  campo: {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 13,
    borderWidth: 1,
    color: colores.textoPrincipal,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  campoConAccion: {
    alignItems: 'center',
    borderColor: colores.borde,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  campoContrasena: {
    color: colores.textoPrincipal,
    flex: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  campoError: { borderColor: colores.error, borderWidth: 1.5 },
  mostrar: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 74,
    paddingHorizontal: 10,
  },
  mostrarTexto: { color: colores.primario, fontSize: 14, fontWeight: '700' },
  errorCampo: { color: colores.error, fontSize: 13, lineHeight: 18, marginTop: 6 },
  enlaceDerecha: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -6 },
  enlace: { color: colores.primario, fontSize: 14, fontWeight: '700' },
  enlaceDeshabilitado: { color: colores.textoApagado },
  botonPrincipal: {
    alignItems: 'center',
    backgroundColor: colores.primario,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 8,
    paddingHorizontal: 18,
  },
  botonDeshabilitado: { backgroundColor: colores.textoApagado },
  botonPresionado: { backgroundColor: colores.verdeProfundo },
  botonPrincipalTexto: { color: colores.superficie, fontSize: 16, fontWeight: '800' },
  crearCuenta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 14,
  },
  crearCuentaTexto: { color: colores.textoSecundario, fontSize: 14 },
  pie: { color: colores.textoSecundario, fontSize: 12, marginTop: 18, textAlign: 'center' },
  presionado: { opacity: 0.65 },
});

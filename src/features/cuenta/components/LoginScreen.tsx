import { useState } from 'react';
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
import { IconoCandado } from '@/shared/components/IconoCandado';
import { IconoCorreo } from '@/shared/components/IconoCorreo';
import { IconoOjo } from '@/shared/components/IconoOjo';
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

type EstadoCampo = 'reposo' | 'foco' | 'error' | 'deshabilitado';

// RF-02, UI/UX aprobada (login-moderno.md §4): prioridad deshabilitado > error > foco > reposo.
function resolverEstadoCampo(
  deshabilitado: boolean,
  conError: boolean,
  enfocado: boolean,
): EstadoCampo {
  if (deshabilitado) return 'deshabilitado';
  if (conError) return 'error';
  if (enfocado) return 'foco';
  return 'reposo';
}

// RF-02, UI/UX aprobada (login-moderno.md §4-5): trazo del icono guia segun el estado.
function colorIconoGuia(estado: EstadoCampo): string {
  switch (estado) {
    case 'deshabilitado':
      return colores.textoApagado;
    case 'error':
      return colores.error;
    case 'foco':
      return colores.primario;
    default:
      return colores.textoSecundario;
  }
}

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
  // RF-02, UI/UX aprobada (§9.1): foco local solo para el estilo, sin tocar RHF ni mensajes.
  const [correoEnfocado, setCorreoEnfocado] = useState(false);
  const [contrasenaEnfocada, setContrasenaEnfocada] = useState(false);
  const procesando = estado === 'procesando';
  const estadoCorreo = resolverEstadoCampo(procesando, Boolean(errors.correo), correoEnfocado);
  const estadoContrasena = resolverEstadoCampo(
    procesando,
    Boolean(errors.contrasena),
    contrasenaEnfocada,
  );
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
            <View style={styles.cabeceraContenido}>
              {/* RF-02, decisión de Josthin 23/11: tarjetita verde que abraza icono y palabra. */}
              <View style={styles.fondoMarca} testID="fondo-marca">
                <LogoClearCuent variante="oscuro" />
              </View>
              <Text accessibilityRole="header" style={styles.titulo}>
                Bienvenido de nuevo
              </Text>
              <Text style={styles.subtitulo}>Ingresa para continuar con tu negocio.</Text>
            </View>
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
                  <View
                    style={[
                      styles.campo,
                      estadoCorreo === 'foco' && styles.campoFoco,
                      estadoCorreo === 'error' && styles.campoError,
                      estadoCorreo === 'deshabilitado' && styles.campoDeshabilitado,
                    ]}
                  >
                    <IconoCorreo color={colorIconoGuia(estadoCorreo)} style={styles.iconoGuia} />
                    <TextInput
                      accessibilityHint={errors.correo?.message ?? 'Ingresa el correo de tu cuenta.'}
                      accessibilityLabel="Correo electrónico"
                      // RF-02, adicion explicita aprobada (§4 y §7): editable=false no basta para el lector.
                      accessibilityState={{ disabled: procesando }}
                      accessibilityValue={
                        errors.correo?.message
                          ? { text: `Error: ${errors.correo.message}` }
                          : undefined
                      }
                      autoCapitalize="none"
                      autoComplete="email"
                      editable={!procesando}
                      inputMode="email"
                      onBlur={() => {
                        onBlur();
                        setCorreoEnfocado(false);
                      }}
                      onChangeText={onChange}
                      onFocus={() => setCorreoEnfocado(true)}
                      placeholder="tu@negocio.com"
                      placeholderTextColor={colores.textoSecundario}
                      returnKeyType="next"
                      style={[
                        styles.campoTexto,
                        estadoCorreo === 'deshabilitado' && styles.valorDeshabilitado,
                      ]}
                      value={value}
                    />
                  </View>
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
              <View
                style={[
                  styles.campo,
                  estadoContrasena === 'foco' && styles.campoFoco,
                  estadoContrasena === 'error' && styles.campoError,
                  estadoContrasena === 'deshabilitado' && styles.campoDeshabilitado,
                ]}
              >
                <IconoCandado
                  color={colorIconoGuia(estadoContrasena)}
                  style={styles.iconoGuia}
                />
                <Controller
                  control={control}
                  name="contrasena"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      accessibilityHint={
                        errors.contrasena?.message ?? 'Ingresa la contraseña de tu cuenta.'
                      }
                      accessibilityLabel="Contraseña"
                      // RF-02, adicion explicita aprobada (§4 y §7): editable=false no basta para el lector.
                      accessibilityState={{ disabled: procesando }}
                      accessibilityValue={
                        errors.contrasena?.message
                          ? { text: `Error: ${errors.contrasena.message}` }
                          : undefined
                      }
                      autoCapitalize="none"
                      autoComplete="current-password"
                      editable={!procesando}
                      onBlur={() => {
                        onBlur();
                        setContrasenaEnfocada(false);
                      }}
                      onChangeText={onChange}
                      onFocus={() => setContrasenaEnfocada(true)}
                      placeholder="Ingresa tu contraseña"
                      placeholderTextColor={colores.textoSecundario}
                      secureTextEntry={!mostrarContrasena}
                      style={[
                        styles.campoTexto,
                        estadoContrasena === 'deshabilitado' && styles.valorDeshabilitado,
                      ]}
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
                  <IconoOjo
                    color={procesando ? colores.textoApagado : colores.primario}
                    tachado={mostrarContrasena}
                  />
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
  cabecera: { alignItems: 'center', marginBottom: 28, position: 'relative' },
  // Ajuste N-1 de A6: conserva el centrado del bloque de cabecera.
  cabeceraContenido: { alignItems: 'center', zIndex: 1 },
  // RF-02, decisión de Josthin 23/11: tarjetita verde; sin capas absolutas ni zIndex.
  fondoMarca: {
    alignItems: 'center',
    backgroundColor: colores.primario,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
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
  // RF-02, UI/UX aprobada (§4): fila de campo; estados resueltos por prioridad.
  campo: {
    alignItems: 'center',
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  campoFoco: { borderColor: colores.primario, borderWidth: 1.5 },
  campoError: { borderColor: colores.error, borderWidth: 1.5 },
  campoDeshabilitado: {
    backgroundColor: colores.superficieSecundaria,
    borderColor: colores.borde,
    borderWidth: 1,
  },
  iconoGuia: { marginLeft: 14, marginRight: 10 },
  campoTexto: {
    color: colores.textoPrincipal,
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  valorDeshabilitado: { color: colores.textoApagado },
  mostrar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    minHeight: 44,
    minWidth: 44,
  },
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

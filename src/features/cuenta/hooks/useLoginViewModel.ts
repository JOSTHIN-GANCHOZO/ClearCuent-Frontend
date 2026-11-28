import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { type LoginForm, loginSchema } from '@/features/cuenta/schemas/login.schema';

export type EstadoLoginUi =
  | 'inicial'
  | 'procesando'
  | 'credencialesIncorrectas'
  | 'bloqueado'
  | 'sinConexion'
  | 'limiteSolicitudes'
  | 'errorTecnico';

type ResultadoLoginConEspera = {
  estado: 'bloqueado' | 'limiteSolicitudes';
  reintentarEnSegundos?: number;
};

export type ResultadoLoginUi =
  | Exclude<EstadoLoginUi, 'inicial' | 'procesando'>
  | ResultadoLoginConEspera
  | 'cambioDispositivo'
  // RF-07 CA5: la ruta decide navegar a /sesion-revocada; el formulario no muestra un error.
  | 'sesionRevocada'
  | 'exito';

type UseLoginViewModelParams = {
  onIniciarSesion: (datos: LoginForm) => Promise<ResultadoLoginUi>;
};

export function useLoginViewModel({ onIniciarSesion }: UseLoginViewModelParams) {
  const [estado, setEstado] = useState<EstadoLoginUi>('inicial');
  const [reintentarEnSegundos, setReintentarEnSegundos] = useState<number>();
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const form = useForm<LoginForm>({
    defaultValues: { correo: '', contrasena: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (estado !== 'bloqueado' && reintentarEnSegundos === undefined) {
      return;
    }

    // RF-02 CA3: Retry-After gobierna el bloqueo; 15 minutos conserva el CA si falta el header.
    const espera = reintentarEnSegundos ?? 15 * 60;
    const desbloqueo = setTimeout(() => {
      setEstado('inicial');
      setReintentarEnSegundos(undefined);
    }, espera * 1000);
    return () => clearTimeout(desbloqueo);
  }, [estado, reintentarEnSegundos]);

  const enviar = form.handleSubmit(async (valores) => {
    form.clearErrors();
    const validacion = loginSchema.safeParse(valores);

    if (!validacion.success) {
      for (const problema of validacion.error.issues) {
        const campo = problema.path[0];
        if (campo === 'correo' || campo === 'contrasena') {
          form.setError(campo, { message: problema.message, type: 'validacion' });
        }
      }
      return;
    }

    setEstado('procesando');
    try {
      const resultado = await onIniciarSesion(validacion.data);
      // RF-07 CA5: ambos resultados delegan la navegación; no se muestra un estado de error.
      if (resultado === 'cambioDispositivo' || resultado === 'sesionRevocada') {
        setEstado('inicial');
        setReintentarEnSegundos(undefined);
        return;
      }
      if (resultado !== 'exito') {
        if (typeof resultado === 'string') {
          setReintentarEnSegundos(undefined);
          setEstado(resultado);
        } else {
          setReintentarEnSegundos(resultado.reintentarEnSegundos);
          setEstado(resultado.estado);
        }
      }
    } catch {
      setEstado('errorTecnico');
    }
  });

  return {
    ...form,
    enviar,
    estado,
    mostrarContrasena,
    reintentarEnSegundos,
    alternarContrasena: () => setMostrarContrasena((visible) => !visible),
  };
}

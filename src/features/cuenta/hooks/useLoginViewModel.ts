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

export type ResultadoLoginUi = Exclude<EstadoLoginUi, 'inicial' | 'procesando'> | 'exito';

type UseLoginViewModelParams = {
  onIniciarSesion: (datos: LoginForm) => Promise<ResultadoLoginUi>;
};

export function useLoginViewModel({ onIniciarSesion }: UseLoginViewModelParams) {
  const [estado, setEstado] = useState<EstadoLoginUi>('inicial');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const form = useForm<LoginForm>({
    defaultValues: { correo: '', contrasena: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (estado !== 'bloqueado') {
      return;
    }

    // RF-02 CA3: esta transición visual se ajustará a Retry-After al conectar la API.
    const desbloqueo = setTimeout(() => setEstado('inicial'), 15 * 60 * 1000);
    return () => clearTimeout(desbloqueo);
  }, [estado]);

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
      if (resultado !== 'exito') {
        setEstado(resultado);
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
    alternarContrasena: () => setMostrarContrasena((visible) => !visible),
  };
}

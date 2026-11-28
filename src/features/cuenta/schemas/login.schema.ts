import { z } from 'zod';

// RF-02: validación local sin incluir valores recibidos en los mensajes.
export const loginSchema = z.object({
  correo: z.string().trim().email('Ingresa un correo electrónico válido.'),
  contrasena: z.string().min(1, 'Ingresa tu contraseña.'),
});

export type LoginForm = z.infer<typeof loginSchema>;

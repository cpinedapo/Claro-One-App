/**
 * Quién está mirando. Toda página y toda acción de servidor empieza aquí.
 *
 * En producción: la sesión de Better Auth (Google Workspace) → correo → `empleado`.
 * En desarrollo, y SOLO en desarrollo, `DEV_LOGIN_EMAIL` entra como ese correo si no hay sesión,
 * para trabajar sin credenciales de Google. Con `NODE_ENV=production` se ignora por completo.
 *
 * **Ver como (soporte).** Un Administrador puede navegar la plataforma con la identidad de otro
 * empleado para reproducir lo que esa persona ve. Se sostiene en tres reglas:
 *   1. La cookie solo se honra si quien INICIÓ SESIÓN es Administrador. Se revisa en cada petición:
 *      una cookie puesta por cualquier otra persona no tiene efecto.
 *   2. Es de solo lectura: `exigirEmpleadoParaEscribir` rechaza toda escritura mientras dura.
 *   3. Entrar y salir dejan evento en el rastro (`features/soporte`).
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { esConfiguradorAdmin } from '@arc2-0/claro-one-kit/dominio';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { mensajesServidor } from '@/i18n/servidor';
import { auth, esCorreoCorporativo } from './auth';
import { empleadoPorEmail, empleadoPorId } from './datos';

export const ES_DESARROLLO = process.env.NODE_ENV === 'development';
export const COOKIE_VER_COMO = 'claro_ver_como';

export interface Sesion {
  email: string;
  /** Con quién se navega: el propio empleado, o la persona que el Administrador está viendo. */
  empleado: EmpleadoConCorreo | null;
  /** Quién inició sesión de verdad. Es el actor de toda escritura y de todo evento. */
  real: EmpleadoConCorreo | null;
  /** true mientras un Administrador ve la plataforma como otra persona. */
  viendoComo: boolean;
  /** true si la identidad viene de un atajo de desarrollo y no de un login real. */
  simulada: boolean;
}

async function identidad(): Promise<Omit<Sesion, 'empleado' | 'viendoComo'> | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (s?.user.email) {
    if (!esCorreoCorporativo(s.user.email)) return null;
    return { email: s.user.email, real: await empleadoPorEmail(s.user.email), simulada: false };
  }
  const devEmail = process.env.DEV_LOGIN_EMAIL;
  if (ES_DESARROLLO && devEmail) {
    return { email: devEmail, real: await empleadoPorEmail(devEmail), simulada: true };
  }
  return null;
}

export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const base = await identidad();
  if (!base) return null;

  const objetivoId = (await cookies()).get(COOKIE_VER_COMO)?.value;
  if (objetivoId && base.real && esConfiguradorAdmin(base.real) && objetivoId !== base.real.id) {
    const objetivo = await empleadoPorId(objetivoId);
    if (objetivo) return { ...base, empleado: objetivo, viendoComo: true };
  }
  return { ...base, empleado: base.real, viendoComo: false };
});

/** Para páginas: sin sesión → login; con sesión pero sin empleado → «Sin acceso». */
export async function exigirEmpleado(): Promise<{ empleado: EmpleadoConCorreo; sesion: Sesion }> {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (!sesion.empleado) redirect('/sin-acceso');
  return { empleado: sesion.empleado, sesion };
}

/** Para acciones que escriben: siempre con la identidad REAL, y nunca mientras se ve como otro. */
export async function exigirEmpleadoParaEscribir(): Promise<
  { ok: true; empleado: EmpleadoConCorreo } | { ok: false; motivo: string }
> {
  const sesion = await sesionActual();
  const m = await mensajesServidor();
  if (!sesion?.real) return { ok: false, motivo: m.servidor.sesionTerminada };
  if (sesion.viendoComo) return { ok: false, motivo: m.servidor.soloLectura(sesion.empleado?.nombre ?? '—') };
  return { ok: true, empleado: sesion.real };
}

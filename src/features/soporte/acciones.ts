'use server';
/**
 * Ver como: entrar y salir. El actor es siempre quien inició sesión DE VERDAD (`sesion.real`), y
 * lo que se persiste es la cookie de la sesión de soporte, más el evento en el rastro.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { actorPara } from '@/dominio/actor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import { cargarEmpleados } from '@/server/datos';
import { mensajesServidor } from '@/i18n/servidor';
import { COOKIE_VER_COMO, sesionActual } from '@/server/sesion';
import { CAPACIDAD_SOPORTE } from './contrato';
import type { EstadoSoporte } from './contrato';

/** Una sesión de soporte no sobrevive a la jornada: se corta sola a las 8 horas. */
const DURACION_SEGUNDOS = 8 * 60 * 60;

async function ejecutar(accionId: string, entrada: Record<string, string>): Promise<ResultadoEjecucion> {
  const sesion = await sesionActual();
  if (!sesion?.real) return { ok: false, motivo: (await mensajesServidor()).servidor.sesionTerminada };
  const real = sesion.real;
  const tarro = await cookies();

  const r = await ejecutarYPersistir<EstadoSoporte>({
    capacidad: CAPACIDAD_SOPORTE,
    accionId,
    actor: actorPara(real, CAPACIDAD_SOPORTE.acciones[accionId]),
    canal: 'ui',
    entrada,
    cargar: async (tx) => ({
      viendoA: sesion.viendoComo && sesion.empleado ? { id: sesion.empleado.id, nombre: sesion.empleado.nombre } : null,
      empleados: (await cargarEmpleados(tx)).map((e) => ({ id: e.id, nombre: e.nombre })),
    }),
    // Nada que escribir en tablas: el evento lo guarda `ejecutarYPersistir`. La cookie va DESPUÉS,
    // cuando el evento ya quedó: nunca hay una sesión de soporte sin su registro.
    persistir: async () => {},
  });

  if (r.ok && r.modo === 'ejecuta') {
    if (accionId === 'iniciar-ver-como') {
      tarro.set(COOKIE_VER_COMO, entrada.empleadoId!, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: DURACION_SEGUNDOS,
      });
    } else {
      tarro.delete(COOKIE_VER_COMO);
    }
  }

  if (r.ok) revalidatePath('/', 'layout');
  return r;
}

export async function iniciarVerComo(empleadoId: string) {
  return ejecutar('iniciar-ver-como', { empleadoId });
}

export async function terminarVerComo() {
  return ejecutar('terminar-ver-como', {});
}

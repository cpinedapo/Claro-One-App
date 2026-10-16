'use server';
/**
 * La única puerta de escritura del Calendario. Mismo patrón que las demás: el navegador manda acción y
 * entrada; el actor y la hora salen del servidor; el contrato valida; se persiste la diferencia y el
 * evento queda en el rastro (también un rechazo).
 */
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { actorPara } from '@/dominio/actor';
import { mensajesServidor } from '@/i18n/servidor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import { cargarBaselinesVigentes, cargarEmpleados, cargarTareas } from '@/server/datos';
import type { Tx } from '@/server/db';
import { taskStatusHistory, taskTimeEntries, taskTimers, tasks } from '@/server/db/schema';
import { exigirEmpleadoParaEscribir } from '@/server/sesion';
import { RUTAS } from '@/routes/rutas';
import { CAPACIDAD_ACTIVIDADES } from './contrato';
import type { EstadoActividades, OperacionTarea } from './contrato';

export type AccionCalendario =
  | 'crear-tarea' | 'tomar-tarea' | 'cambiar-estado-tarea' | 'registrar-tiempo' | 'iniciar-cronometro' | 'detener-cronometro' | 'exportar-tareas';

async function cargar(tx: Tx): Promise<EstadoActividades> {
  const [{ tareas, cronometros }, empleados, baselines] = await Promise.all([cargarTareas(tx), cargarEmpleados(tx), cargarBaselinesVigentes(tx)]);
  const ahora = Date.now();
  return { tareas, cronometros, empleados, areas: baselines.areas.map((a) => a.codigo), hoy: new Date(ahora).toISOString().slice(0, 10), ahora, operaciones: [] };
}

async function escribir(tx: Tx, o: OperacionTarea) {
  switch (o.tipo) {
    case 'crear': {
      const t = o.tarea;
      const [fila] = await tx
        .insert(tasks)
        .values({
          title: t.titulo, type: t.tipo, priority: t.prioridad, startDate: t.fechaInicio, endDate: t.fechaFin, status: 'pendiente', reason: t.motivo,
          createdBy: t.creadaPor, team: t.equipoId, assigneeId: t.responsableId,
          relatedKind: t.cliente?.tipo ?? null, relatedId: t.cliente?.id ?? null, relatedName: t.cliente?.nombre ?? null, description: t.descripcion,
        })
        .returning({ id: tasks.id });
      await tx.insert(taskStatusHistory).values({ taskId: fila!.id, status: 'pendiente', employeeId: t.creadaPor, reason: t.motivo });
      return;
    }
    case 'tomar': {
      const [fila] = await tx.update(tasks).set({ assigneeId: o.responsableId, reason: o.motivo }).where(eq(tasks.id, Number(o.id))).returning({ status: tasks.status });
      await tx.insert(taskStatusHistory).values({ taskId: Number(o.id), status: fila!.status, employeeId: o.responsableId, reason: o.motivo });
      return;
    }
    case 'estado':
      await tx.update(tasks).set({ status: o.estado, reason: o.motivo }).where(eq(tasks.id, Number(o.id)));
      await tx.insert(taskStatusHistory).values({ taskId: Number(o.id), status: o.estado, employeeId: o.quien, reason: o.motivo });
      return;
    case 'tiempo':
      await tx.insert(taskTimeEntries).values({ taskId: Number(o.id), employeeId: o.empleadoId, minutes: o.minutos, date: o.fecha, origin: o.origen, note: o.nota });
      return;
    case 'cronometro-inicio':
      await tx.insert(taskTimers).values({ employeeId: o.empleadoId, taskId: Number(o.tareaId), startedAt: sql`now()` });
      return;
    case 'cronometro-fin':
      await tx.delete(taskTimers).where(eq(taskTimers.employeeId, o.empleadoId));
      return;
  }
}

async function persistir(tx: Tx, _antes: EstadoActividades, despues: EstadoActividades) {
  for (const o of despues.operaciones) await escribir(tx, o);
}

export async function ejecutarCalendario(accionId: AccionCalendario, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_ACTIVIDADES.acciones[accionId];
  if (!accion) return { ok: false, motivo: (await mensajesServidor()).servidor.accionNoDeclarada(accionId) };
  const r = await ejecutarYPersistir<EstadoActividades>({
    capacidad: CAPACIDAD_ACTIVIDADES,
    accionId,
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada,
    cargar,
    persistir,
  });
  if (r.ok && r.evento.tipo === 'cambio') revalidatePath(RUTAS.calendario);
  return r;
}

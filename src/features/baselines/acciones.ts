'use server';
/**
 * La única puerta de escritura de Baselines. Mismo patrón que Gestión de agencias: el navegador manda
 * acción y entrada; el actor sale de la sesión real; el contrato valida; se persiste la diferencia y
 * el evento queda en el rastro (también un rechazo).
 */
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { actorPara } from '@/dominio/actor';
import { mensajesServidor } from '@/i18n/servidor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import { filasBaselines } from '@/server/datos';
import type { Tx } from '@/server/db';
import { baselines } from '@/server/db/schema';
import { exigirEmpleadoParaEscribir } from '@/server/sesion';
import { RUTAS } from '@/routes/rutas';
import { CAPACIDAD_BASELINES } from './contrato';
import type { EstadoBaselines } from './contrato';

export type AccionBaselines = 'agregar-valor' | 'editar-valor' | 'desactivar-valor' | 'reactivar-valor' | 'importar-territorios';

async function cargar(tx: Tx): Promise<EstadoBaselines> {
  return { valores: await filasBaselines(tx), operaciones: [] };
}

/** Alta: fila nueva vigente desde hoy. Baja: cierra el intervalo. Nunca se borra. */
async function persistir(tx: Tx, _antes: EstadoBaselines, despues: EstadoBaselines) {
  for (const o of despues.operaciones) {
    switch (o.tipo) {
      case 'alta':
        await tx.insert(baselines).values({ kind: o.valor.tipo, code: o.valor.codigo, name: o.valor.nombre, lobs: o.valor.lobs, roles: o.valor.roles, parent: o.valor.padre, areas: o.valor.areas, state: o.valor.estado, subregion: o.valor.subregion, zips: o.valor.zips });
        break;
      case 'edicion':
        await tx.update(baselines).set({ name: o.nombre, lobs: o.lobs, roles: o.roles, parent: o.padre, areas: o.areas, state: o.estado, subregion: o.subregion, zips: o.zips }).where(eq(baselines.id, Number(o.id)));
        break;
      case 'baja':
        await tx.update(baselines).set({ validTo: sql`CURRENT_DATE` }).where(eq(baselines.id, Number(o.id)));
        break;
    }
  }
}

export async function ejecutarBaselines(accionId: AccionBaselines, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_BASELINES.acciones[accionId];
  if (!accion) return { ok: false, motivo: (await mensajesServidor()).servidor.accionNoDeclarada(accionId) };

  const r = await ejecutarYPersistir<EstadoBaselines>({
    capacidad: CAPACIDAD_BASELINES,
    accionId,
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada,
    cargar,
    persistir,
  });
  if (r.ok) {
    revalidatePath(RUTAS.baselines);
    revalidatePath(RUTAS.directorio);
  }
  return r;
}

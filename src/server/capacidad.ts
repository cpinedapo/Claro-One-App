/**
 * La costura de **escrituras** (ESTRUCTURA-DEL-FRONT §7): contrato primero, persistir después.
 *
 * El prototipo ejecutaba `CAPACIDAD.ejecutar` en el navegador y guardaba el resultado en un
 * `useState`. Aquí la misma llamada corre en el servidor, dentro de una transacción:
 *
 *   1. carga el estado que el contrato necesita,
 *   2. ejecuta el contrato del kit (permiso, canal, regla, consecuencia),
 *   3. persiste la diferencia entre el estado de antes y el de después,
 *   4. escribe el evento en el rastro.
 *
 * El navegador nunca dice quién es el actor: lo decide el servidor a partir de la sesión. Un
 * rechazo del contrato también queda en el rastro, como evento `rechazo`.
 */
import 'server-only';
import type { Actor, Canal, Capacidad, EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';
import { mensajesServidor } from '@/i18n/servidor';
import { db } from './db';
import type { Tx } from './db';
import { evento as tablaEvento } from './db/schema';

export type ResultadoEjecucion =
  | { ok: true; modo: 'ejecuta' | 'propone'; evento: Evento }
  | { ok: false; motivo: string };

export interface Ejecucion<E> {
  capacidad: Capacidad<E>;
  accionId: string;
  actor: Actor;
  canal: Canal;
  entrada: EntradaAccion;
  cargar: (tx: Tx) => Promise<E>;
  persistir: (tx: Tx, antes: E, despues: E, evento: Evento) => Promise<void>;
}

export async function ejecutarYPersistir<E>(e: Ejecucion<E>): Promise<ResultadoEjecucion> {
  try {
    return await db.transaction(async (tx) => {
      const antes = await e.cargar(tx);
      const r = e.capacidad.ejecutar({ accionId: e.accionId, actor: e.actor, canal: e.canal, entrada: e.entrada }, antes);
      if (!r.ok) {
        await registrarRechazo(tx, e, r.motivo);
        return { ok: false as const, motivo: r.motivo };
      }
      if (r.modo === 'ejecuta') await e.persistir(tx, antes, r.estado, r.evento);
      await registrarEvento(tx, e.capacidad.def.id, r.evento);
      return { ok: true as const, modo: r.modo, evento: r.evento };
    });
  } catch (err) {
    console.error(`[capacidad] ${e.capacidad.def.id}/${e.accionId}`, err);
    return { ok: false, motivo: (await mensajesServidor()).servidor.noGuardado };
  }
}

function registrarEvento(tx: Tx, capacidadId: string, ev: Evento) {
  return tx.insert(tablaEvento).values({
    capacidadId,
    accion: ev.accion,
    nombreAccion: ev.nombreAccion,
    tipo: ev.tipo,
    actor: ev.actor,
    canal: ev.canal,
    cuando: ev.cuando,
    regla: ev.regla,
    entrada: ev.entrada,
    cambios: ev.cambios,
    salida: ev.salida ?? null,
    datos: ev.datos ?? null,
    emite: ev.emite ?? [],
    procedencia: ev.procedencia ?? null,
    motivo: ev.motivo ?? null,
  });
}

function registrarRechazo<E>(tx: Tx, e: Ejecucion<E>, motivo: string) {
  const accion = e.capacidad.acciones[e.accionId];
  return registrarEvento(tx, e.capacidad.def.id, {
    accion: e.accionId,
    nombreAccion: accion?.nombre ?? e.accionId,
    tipo: 'rechazo',
    actor: e.actor,
    canal: e.canal,
    cuando: new Date(),
    regla: accion?.regla ?? '—',
    entrada: e.entrada,
    cambios: [],
    motivo,
  });
}

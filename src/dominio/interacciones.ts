/**
 * La línea de tiempo unificada de interacciones del Directorio (MN7, reunión de managers de Service,
 * 2026-10-07). Portada de `PB-002-v2.6/logica-directorio.js` del arnés.
 *
 * - Junta en una sola lista, la más reciente primero, todos los contactos con un agente o una agencia
 *   (Interaction · E-062): correos, mensajes del portal, llamadas, SMS, chats, casos, avisos del
 *   carrier y sesiones.
 * - Por defecto, una agencia ve solo lo suyo. Con «incluir su red» suma lo de sus sub-agencias y de
 *   todos los agentes de su downline; la red sale de `agency_tree`.
 *
 * Puro: sin React, sin antd, sin base de datos.
 */
import { agenciaYDescendientes, downline } from './directorio';
import type { DirectorioCompleto } from './directorio';

export type TipoInteraccion = 'correo' | 'portal' | 'llamada' | 'sms' | 'chat' | 'caso' | 'aviso' | 'sesion';

export interface Interaccion {
  id: string;
  tipo: TipoInteraccion;
  direccion: 'entrada' | 'salida' | null;
  /** ISO 8601. */
  cuando: string;
  titulo: string;
  detalle: string | null;
  /** El sujeto: un agente o una agencia, nunca los dos. */
  agenteId: string | null;
  agenciaId: string | null;
  fuente: string | null;
}

/** Los filtros que ve la persona: agrupan los tipos. */
export type GrupoInteraccion = 'todo' | 'mensajes' | 'llamadas' | 'texto' | 'casos' | 'otros';

export const GRUPOS: Record<GrupoInteraccion, TipoInteraccion[] | null> = {
  todo: null,
  mensajes: ['correo', 'portal'],
  llamadas: ['llamada'],
  texto: ['sms', 'chat'],
  casos: ['caso'],
  otros: ['aviso', 'sesion'],
};

export const ORDEN_GRUPOS: GrupoInteraccion[] = ['todo', 'mensajes', 'llamadas', 'texto', 'casos', 'otros'];

/** La línea de tiempo de una agencia, la más reciente primero. */
export function lineaDeTiempoDeAgencia(
  dir: DirectorioCompleto,
  interacciones: Interaccion[],
  agenciaId: string,
  opciones: { grupo?: GrupoInteraccion; incluirRed?: boolean } = {},
): Interaccion[] {
  const tipos = GRUPOS[opciones.grupo ?? 'todo'];
  const agencias = opciones.incluirRed ? agenciaYDescendientes(dir.arbol, agenciaId) : new Set([agenciaId]);
  const agentes = new Set(opciones.incluirRed ? downline(dir, agenciaId).map((a) => a.id) : []);
  return interacciones
    .filter((i) => (i.agenteId ? agentes.has(i.agenteId) : !!i.agenciaId && agencias.has(i.agenciaId)))
    .filter((i) => !tipos || tipos.includes(i.tipo))
    .sort((a, b) => (a.cuando === b.cuando ? b.id.localeCompare(a.id) : b.cuando.localeCompare(a.cuando)));
}

/** Cuántas hay por grupo, para mostrarlo junto al filtro. */
export function conteoPorGrupo(dir: DirectorioCompleto, interacciones: Interaccion[], agenciaId: string, incluirRed: boolean) {
  const todas = lineaDeTiempoDeAgencia(dir, interacciones, agenciaId, { incluirRed });
  return Object.fromEntries(
    ORDEN_GRUPOS.map((g) => [g, GRUPOS[g] ? todas.filter((i) => GRUPOS[g]!.includes(i.tipo)).length : todas.length]),
  ) as Record<GrupoInteraccion, number>;
}

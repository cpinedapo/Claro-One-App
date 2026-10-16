/**
 * El Calendario (Gestor de actividades del prototipo PB-002 v2.6, pedido de negocio 2026-10-01):
 * tareas propias y para otros equipos, con prioridad, fechas, estado con motivo y tiempo invertido.
 * Entidad: Task · E-063.
 *
 * Quién ve qué (HIPÓTESIS DE FORMA del prototipo, adaptada):
 * - El equipo de una persona es su área de la organización (Datos base, H-018).
 * - Mis tareas = las que tengo como responsable. Es lo único que ve un Doer en su calendario.
 * - Bandeja de mi equipo = asignadas a mi equipo que nadie tomó todavía. Cualquiera del equipo la toma.
 * - Creadas por mí para otros = las que creé y tiene otro responsable u otro equipo. Solo las veo.
 * - Del equipo (Manager, Coordinator, CEO Level) = las de las personas de su área; con alcance global,
 *   las de todos.
 *
 * Puro: sin React, sin antd, sin base.
 */
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';

export const ESTADOS_TAREA = ['pendiente', 'en-curso', 'cerrada'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];
/** El estado de negocio del kit que corresponde a cada estado de una tarea (color e icono, GLB-R07). */
export const ESTADO_NEGOCIO_DE_TAREA: Record<EstadoTarea, string> = { pendiente: 'pending', 'en-curso': 'waiting', cerrada: 'ok' };

export const PRIORIDADES = ['urgente', 'alta', 'normal', 'baja'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const TIPOS_TAREA = ['tarea', 'reunion', 'llamada', 'visita', 'evento'] as const;
export type TipoTarea = (typeof TIPOS_TAREA)[number];

export interface RegistroTiempo {
  id: string;
  empleadoId: string;
  minutos: number;
  fecha: string;
  origen: 'manual' | 'cronometro';
  nota: string | null;
}

export interface CambioDeEstado {
  estado: EstadoTarea;
  cuando: string;
  quien: string;
  motivo: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  tipo: TipoTarea;
  prioridad: Prioridad;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoTarea;
  motivo: string;
  creadaPor: string;
  /** El equipo (área) al que se asignó; null si es propia. */
  equipoId: string | null;
  /** Quién la trabaja; null si está en la bandeja de un equipo y nadie la tomó. */
  responsableId: string | null;
  cliente: { tipo: 'agente' | 'agencia' | 'lead'; id: string; nombre: string } | null;
  descripcion: string | null;
  tiempo: RegistroTiempo[];
  historial: CambioDeEstado[];
}

/** Un cronómetro corriendo: uno por persona. */
export interface Cronometro {
  empleadoId: string;
  tareaId: string;
  inicio: string;
}

const ROLES_GESTOR = ['manager', 'coordinator', 'ceo-level'];
const activas = (e: Empleado) => e.asignaciones.filter((a) => a.est === 'ok');

export const esGestor = (e: Empleado) => activas(e).some((a) => ROLES_GESTOR.includes(a.rolId));

/** Las personas a cargo de un gestor: las de su área o, con alcance global, todas. */
export function personasACargo(e: Empleado, empleados: Empleado[]): Empleado[] {
  if (!esGestor(e)) return [];
  const global = activas(e).some((a) => ROLES_GESTOR.includes(a.rolId) && a.alcanceTipo === 'global');
  return empleados.filter((x) => x.id !== e.id && (global || x.areaId === e.areaId));
}

export const esMia = (t: Tarea, empleadoId: string) => t.responsableId === empleadoId;
export const enBandeja = (t: Tarea, e: Empleado) => !t.responsableId && !!t.equipoId && t.equipoId === e.areaId;
export const creadaParaOtros = (t: Tarea, empleadoId: string) => t.creadaPor === empleadoId && t.responsableId !== empleadoId;

export const misTareas = (ts: Tarea[], empleadoId: string) => ts.filter((t) => esMia(t, empleadoId));
export const bandejaDeEquipo = (ts: Tarea[], e: Empleado) => ts.filter((t) => enBandeja(t, e));
export const creadasParaOtros = (ts: Tarea[], empleadoId: string) => ts.filter((t) => creadaParaOtros(t, empleadoId));
export function delEquipo(ts: Tarea[], e: Empleado, empleados: Empleado[]) {
  const ids = new Set(personasACargo(e, empleados).map((x) => x.id));
  return ts.filter((t) => t.responsableId !== null && ids.has(t.responsableId));
}

/** ¿Puede esta persona ver esta tarea? Es la regla que aplica la exportación. */
export function puedeVer(t: Tarea, e: Empleado, empleados: Empleado[]) {
  if (esMia(t, e.id) || t.creadaPor === e.id || enBandeja(t, e)) return true;
  return personasACargo(e, empleados).some((x) => x.id === t.responsableId);
}

export const minutosDe = (t: Tarea) => t.tiempo.reduce((s, x) => s + x.minutos, 0);
export function duracion(min: number) {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
/** Minutos que registra un cronómetro: lo transcurrido, redondeado, nunca menos de 1. */
export const minutosCronometro = (inicioMs: number, finMs: number) => Math.max(1, Math.round((finMs - inicioMs) / 60000));

export const tocaDia = (t: { fechaInicio: string; fechaFin: string }, fecha: string) => t.fechaInicio <= fecha && fecha <= t.fechaFin;
export const tocaRango = (t: { fechaInicio: string; fechaFin: string }, desde: string, hasta: string) => t.fechaInicio <= hasta && t.fechaFin >= desde;
export const vencida = (t: Tarea, hoy: string) => t.estado !== 'cerrada' && t.fechaFin < hoy;

export function ordenar(ts: Tarea[]) {
  const e = (x: EstadoTarea) => ESTADOS_TAREA.indexOf(x);
  const p = (x: Prioridad) => PRIORIDADES.indexOf(x);
  return [...ts].sort((a, b) => e(a.estado) - e(b.estado) || p(a.prioridad) - p(b.prioridad) || a.fechaFin.localeCompare(b.fechaFin));
}

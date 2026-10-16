/**
 * El catálogo de permisos del producto (H-032, H-035), atado a lo que cada permiso deja hacer de verdad.
 *
 * Parte del catálogo del kit (`PERMISOS`) y le aplica lo que el negocio ya decidió:
 * - Salen «Capturar lead», «Calificar lead» y «Convertir lead → account/contact»: no correspondían a una función real.
 * - Entran los permisos de Leads: Importar, Ver, Editar y Convertir.
 * - **Por ahora ningún permiso sale de un rol** (H-035): el `ROLE_PERMISOS` del kit era de prueba. Todos se encienden
 *   por persona. Cuando el negocio levante los permisos por defecto de cada rol y cargo (p. ej. «Doer de X cargo»),
 *   entran aquí como punto de partida.
 *
 * Es un puente: el catálogo vive en el kit. Hay que proponer allá este cambio y, cuando llegue, borrar este archivo.
 *
 * Puro: sin React, sin antd, sin base.
 */
import { PERMISOS as PERMISOS_KIT } from '@arc2-0/claro-one-kit/dominio';
import type { Permiso } from '@arc2-0/claro-one-kit/dominio';

export const PERMISOS_LEADS = [
  { id: 'leads.importar', nombre: 'Leads: importar', flujoId: 'lead-conversion', tipo: 'ejecutar' },
  { id: 'leads.ver', nombre: 'Leads: ver', flujoId: 'lead-conversion', tipo: 'ejecutar' },
  { id: 'leads.editar', nombre: 'Leads: editar', flujoId: 'lead-conversion', tipo: 'ejecutar' },
  { id: 'leads.convertir', nombre: 'Leads: convertir', flujoId: 'lead-conversion', tipo: 'ejecutar' },
] as const satisfies readonly Permiso[];

export type PermisoLeads = (typeof PERMISOS_LEADS)[number]['id'];

/** Los del kit que el negocio retiró. */
const RETIRADOS = ['lead.capturar', 'lead.calificar', 'lead.convertir'];

export const PERMISOS: Permiso[] = [...PERMISOS_LEADS, ...PERMISOS_KIT.filter((p) => !RETIRADOS.includes(p.id))];

/** Todos se encienden por persona (H-035). */
export const PERMISOS_DIRECTOS: readonly string[] = PERMISOS.map((p) => p.id);

/** Lo que una persona puede: los permisos que se le encendieron, en el orden del catálogo. Hoy ningún rol suma. */
export const permisosDe = (directos: readonly string[]): string[] => PERMISOS.map((p) => p.id).filter((id) => directos.includes(id));

export const tiene = (directos: readonly string[], permiso: string) => directos.includes(permiso);

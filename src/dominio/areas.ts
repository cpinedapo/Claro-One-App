/**
 * Áreas, sub-áreas y cargos (H-036, H-038): de los cargos de una persona salen su área y sus roles.
 *
 * El negocio trabaja con 5 áreas principales y sus sub-áreas (Configuración › Datos base):
 * - Operations: Service, BOB & Commissions, Contracting, Telecomunicaciones, Quality.
 * - Commercial: Growth, New Business.
 * - Strategy: Marketing, Technology, Product.
 * - Finance y Management CEO, sin sub-áreas.
 * Cada cargo dice su rol y su área o sub-áreas. Una persona tiene uno o varios cargos.
 *
 * El alcance lo da el rol (H-036): CEO Level y Administrador → toda la empresa; Manager → su área (vertical);
 * Coordinator → su sub-área (equipo); Doer → lo suyo, dentro de su sub-área.
 *
 * El kit decide qué Flujos ve cada persona con su propio árbol de áreas (`AREAS`). Mientras el kit no adopte estas,
 * `RAMA_KIT` dice qué rama del kit cubre cada área o sub-área. Proponerlo al kit y borrar el puente.
 *
 * Puro: sin React, sin antd, sin base.
 */
import { AREAS } from '@arc2-0/claro-one-kit/dominio';
import type { AlcanceTipo } from '@arc2-0/claro-one-kit/dominio';
import type { AreaOpcion, CargoOpcion } from './baselines';

/** Área o sub-área (código de Datos base) → la rama del kit que cubre. `null`: el kit no tiene Flujos para ella.
 *  Va primero el área y después sus sub-áreas: cuando dos comparten rama, la etiqueta usa la primera. */
export const RAMA_KIT: Record<string, string | null> = {
  Operations: 'coo',
  'BOB & Commissions': 'bob-commissions',
  Service: 'broker-support',
  Contracting: 'contracting-telco',
  Telecomunicaciones: 'contracting-telco',
  Quality: 'quality',
  Finance: 'vpf',
  Commercial: 'ceo-commercial',
  'New Business': 'new-business',
  Growth: 'gr',
  Strategy: 'vp-strategy',
  Marketing: 'vp-strategy',
  Technology: 'vp-strategy',
  Product: 'product',
  'Management CEO': 'ceo',
  Legal: null,
};

export const ALCANCE_DE_ROL: Record<string, AlcanceTipo> = {
  'ceo-level': 'global',
  'configurador-admin': 'global',
  manager: 'vertical',
  coordinator: 'team',
  doer: 'self',
};

export const alcanceDeRol = (rolId: string): AlcanceTipo => ALCANCE_DE_ROL[rolId] ?? 'self';
export const esGlobal = (rolId: string) => alcanceDeRol(rolId) === 'global';

/** La asignación que corresponde a un rol en un área o sub-área. Sin LOB: la LOB es un dato del área (H-036). */
export function asignacionDeRol(rolId: string, area: string) {
  const alcanceTipo = alcanceDeRol(rolId);
  // «plataforma» (el área de los Administradores del arranque) ya es un área del kit.
  const rama = RAMA_KIT[area] ?? (AREAS.some((a) => a.id === area) ? area : null);
  return { rolId, alcanceTipo, alcanceValor: alcanceTipo === 'global' ? null : rama, lob: null as string | null };
}

/** El área estándar que contiene un área del kit (sube por el árbol hasta una rama conocida). */
export function areaEstandarDeKit(kitId: string | null): string | null {
  let actual = kitId ? AREAS.find((a) => a.id === kitId) : undefined;
  while (actual) {
    const estandar = Object.keys(RAMA_KIT).find((k) => RAMA_KIT[k] === actual!.id);
    if (estandar) return estandar;
    actual = actual.parentId ? AREAS.find((a) => a.id === actual!.parentId) : undefined;
  }
  return null;
}

/** El área principal de un área o sub-área: la sub-área sube a su área; un área es su propia raíz. */
export const raizDe = (areas: AreaOpcion[], codigo: string) => areas.find((a) => a.codigo === codigo)?.padre ?? codigo;

export interface PerfilDeCargos {
  /** Las áreas o sub-áreas de sus cargos, sin repetir, en el orden de los cargos. */
  unidades: string[];
  /** Sus áreas principales. */
  raices: string[];
  /** La primera unidad: el área que se guarda en la persona. */
  principal: string | null;
  /** Las asignaciones que le dan sus cargos (rol + alcance + área del kit). */
  asignaciones: ReturnType<typeof asignacionDeRol>[];
  /** Cada rol con su área, para mostrar: «Manager · Growth». */
  roles: { rolId: string; area: string | null }[];
}

/** Las áreas principales de una persona: las de sus cargos; si no tiene cargos del catálogo, la de su área guardada. */
export function areasPrincipales(e: { cargos: string[]; areaId: string }, base: { cargos: CargoOpcion[]; areas: AreaOpcion[] }): string[] {
  const raices = perfilDeCargos(e.cargos, base.cargos, base.areas).raices;
  return raices.length ? raices : [raizDe(base.areas, e.areaId)];
}

/** Lo que dan unos cargos: área, sub-áreas y roles (H-038). */
export function perfilDeCargos(codigos: string[], cargos: CargoOpcion[], areas: AreaOpcion[]): PerfilDeCargos {
  const elegidos = codigos.map((c) => cargos.find((x) => x.codigo === c)).filter((c): c is CargoOpcion => !!c);
  const unidades = [...new Set(elegidos.flatMap((c) => c.areas))];
  const raices = [...new Set(unidades.map((u) => raizDe(areas, u)))];
  const asignaciones: PerfilDeCargos['asignaciones'] = [];
  const roles: PerfilDeCargos['roles'] = [];
  const agregar = (a: ReturnType<typeof asignacionDeRol>, area: string | null) => {
    if (asignaciones.some((x) => x.rolId === a.rolId && x.alcanceValor === a.alcanceValor)) return;
    asignaciones.push(a);
    roles.push({ rolId: a.rolId, area });
  };
  for (const c of elegidos) {
    for (const rolId of c.roles) {
      if (esGlobal(rolId)) agregar(asignacionDeRol(rolId, c.areas[0] ?? ''), null);
      else for (const u of c.areas) agregar(asignacionDeRol(rolId, u), u);
    }
  }
  return { unidades, raices, principal: unidades[0] ?? null, asignaciones, roles };
}

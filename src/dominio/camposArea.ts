/**
 * Campos específicos por área (H-027): cada área de la organización (Datos base) define los datos extra que
 * necesita de sus usuarios para sus procesos. El Administrador los configura; cada usuario los llena según su área.
 *
 * Las listas toman sus opciones de dos lados: las escritas en el campo, o un catálogo de Datos base (líneas de
 * negocio, carriers, estados, territorios), que se administra en Configuración y nunca se copia al campo (H-018).
 *
 * Un campo puede pedirse solo a algunos (H-040): «Solo para» un rol en ciertas sub-áreas (p. ej. Doer de New Business
 * o Growth) y «Solo si» otro campo del área tiene un valor (p. ej. On field = Sí).
 *
 * Puro: sin React, sin antd, sin base.
 */
import type { BaselinesVigentes, OpcionBaseline, TerritorioOpcion } from './baselines';

export const TIPOS_CAMPO = ['texto', 'numero', 'fecha', 'si-no', 'lista', 'multi-lista'] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

/** De dónde salen las opciones de una lista: las propias del campo o un catálogo de Datos base. */
export const FUENTES_OPCIONES = ['propias', 'lob', 'carrier', 'state', 'territorio'] as const;
export type FuenteOpciones = (typeof FUENTES_OPCIONES)[number];

export const esLista = (tipo: TipoCampo) => tipo === 'lista' || tipo === 'multi-lista';

export interface CampoArea {
  id: string;
  /** Código del área de Datos base. */
  area: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Solo listas. */
  fuente: FuenteOpciones;
  /** Solo listas con fuente `propias`: las opciones. */
  opciones: string[];
  obligatorio: boolean;
  orden: number;
  /** «Solo para» (H-040): roles del kit (vacío = todos)… */
  soloRoles: string[];
  /** …en estas sub-áreas (vacío = cualquiera del área). */
  soloSubareas: string[];
  /** «Solo si» (H-040): aparece cuando el campo `dependeDe` vale `dependeValor`. */
  dependeDe: string | null;
  dependeValor: string | null;
  /** «Filtrar opciones por» (H-041): una lista de territorios ofrece solo los de los estados elegidos en este campo. */
  filtradoPor: string | null;
  vigente: boolean;
}

/** El valor vigente de un campo para un usuario. Una multi-lista guarda un arreglo JSON de códigos. */
export interface ValorCampoArea {
  id: string;
  empleadoId: string;
  campoId: string;
  valor: string;
  desde: string;
}

/** Los catálogos de Datos base que una lista puede usar como opciones. */
export type CatalogosCampos = { lob: OpcionBaseline[]; carrier: OpcionBaseline[]; state: OpcionBaseline[]; territorio: TerritorioOpcion[] };

export const catalogosDe = (b: Pick<BaselinesVigentes, 'lobs' | 'carriers' | 'estados' | 'territorios'>): CatalogosCampos => ({ lob: b.lobs, carrier: b.carriers, state: b.estados, territorio: b.territorios });

/** Cómo leer el valor (guardado o en borrador) de otro campo, para «Solo si». */
export type LeerValor = (campoId: string) => string | string[] | null | undefined;

/** Los códigos de un valor, venga guardado (texto o JSON) o del borrador (arreglo). */
export const codigosDeValor = (v: string | string[] | null | undefined): string[] => (Array.isArray(v) ? v : codigosDe(v ?? null));

/**
 * Las opciones vigentes de una lista. Si el campo se filtra por otro (H-041), solo las de lo elegido allá: los
 * territorios de los estados marcados. Sin `leer` no se filtra (para mostrar lo guardado).
 */
export function opcionesDe(campo: CampoArea, catalogos: CatalogosCampos, leer?: LeerValor): OpcionBaseline[] {
  if (campo.fuente === 'propias') return campo.opciones.map((o) => ({ codigo: o, nombre: o }));
  if (campo.fuente === 'territorio' && campo.filtradoPor && leer) {
    const estados = codigosDeValor(leer(campo.filtradoPor));
    return catalogos.territorio.filter((t) => t.estado !== null && estados.includes(t.estado));
  }
  return catalogos[campo.fuente];
}

/** Los códigos que guarda una multi-lista. */
export function codigosDe(valor: string | null): string[] {
  if (!valor) return [];
  try {
    const v = JSON.parse(valor) as unknown;
    return Array.isArray(v) ? v.map(String) : [valor];
  } catch {
    return [valor];
  }
}

export const camposDeArea = (campos: CampoArea[], area: string) => campos.filter((c) => c.area === area && c.vigente).sort((a, b) => a.orden - b.orden);

export const valorDe = (valores: ValorCampoArea[], empleadoId: string, campoId: string) =>
  valores.find((v) => v.empleadoId === empleadoId && v.campoId === campoId)?.valor ?? null;

/** Un rol de la persona en un área o sub-área (sale de sus cargos, H-038). */
export type RolEnArea = { rolId: string; area: string | null };


/** Si un campo se le pide a esta persona: «Solo para» sus roles y sub-áreas, y «Solo si» el otro campo vale lo pedido. */
export function aplica(campo: CampoArea, roles: RolEnArea[], leer: LeerValor): boolean {
  if (campo.soloRoles.length && !roles.some((r) => campo.soloRoles.includes(r.rolId) && (!campo.soloSubareas.length || (r.area !== null && campo.soloSubareas.includes(r.area))))) return false;
  if (campo.dependeDe) return leer(campo.dependeDe) === campo.dependeValor;
  return true;
}

/** Los campos de sus áreas principales que se le piden a una persona, en orden. */
export const camposDePersona = (campos: CampoArea[], raices: string[], roles: RolEnArea[], leer: LeerValor) =>
  raices.flatMap((r) => camposDeArea(campos, r)).filter((c) => aplica(c, roles, leer));

/** Los campos obligatorios de su área que un usuario todavía no tiene. */
export const faltantes = (campos: CampoArea[], valores: ValorCampoArea[], empleadoId: string, areas: string[], roles: RolEnArea[]) =>
  camposDePersona(campos, areas, roles, (id) => valorDe(valores, empleadoId, id)).filter((c) => c.obligatorio && !valorDe(valores, empleadoId, c.id));

/** Valida y normaliza un valor según el tipo del campo. Vacío = sin valor. */
export function leerValor(campo: CampoArea, crudo: string | null | undefined, catalogos: CatalogosCampos, leer?: LeerValor): { valor: string | null } | { error: string } {
  const v = (crudo ?? '').trim();
  const vacio = campo.tipo === 'multi-lista' ? codigosDe(v).length === 0 : !v;
  if (vacio) return campo.obligatorio ? { error: `«${campo.etiqueta}» es obligatorio.` } : { valor: null };
  const validos = esLista(campo.tipo) ? opcionesDe(campo, catalogos, leer).map((o) => o.codigo) : [];
  switch (campo.tipo) {
    case 'numero':
      return Number.isFinite(Number(v)) ? { valor: String(Number(v)) } : { error: `«${campo.etiqueta}» tiene que ser un número.` };
    case 'fecha':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? { valor: v } : { error: `«${campo.etiqueta}» tiene que ser una fecha (AAAA-MM-DD).` };
    case 'si-no':
      return v === 'si' || v === 'no' ? { valor: v } : { error: `«${campo.etiqueta}» es sí o no.` };
    case 'lista':
      return validos.includes(v) ? { valor: v } : { error: `«${v}» no es una opción de «${campo.etiqueta}».` };
    case 'multi-lista': {
      const codigos = [...new Set(codigosDe(v))];
      const ajeno = codigos.find((c) => !validos.includes(c));
      if (ajeno) return { error: `«${ajeno}» no es una opción de «${campo.etiqueta}».` };
      return { valor: JSON.stringify(validos.filter((c) => codigos.includes(c))) };
    }
    default:
      return v.length <= 500 ? { valor: v } : { error: `«${campo.etiqueta}» tiene hasta 500 caracteres.` };
  }
}

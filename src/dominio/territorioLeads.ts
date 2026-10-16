/**
 * Territorio y responsable de los leads (H-042).
 *
 * 1. Un lead con dirección tiene ZIP: su territorio es el de Datos base que contiene ese ZIP.
 * 2. Si el ZIP no está en ningún territorio, Ask Claro **propone**: un territorio existente con su confianza y su
 *    motivo, o uno nuevo con el estado del lead. Hoy es una regla local, sin IA externa (decisión de la usuaria,
 *    2026-10-15): compara el prefijo del ZIP, la ciudad de otros leads y los ZIP vecinos. Se cambia por un modelo
 *    cuando haya clave.
 * 3. Con los territorios resueltos, el responsable de un lead es un **Doer de New Business** que atiende su tipo de
 *    cliente, cubre sus líneas de negocio y su territorio. Si el lead no tiene territorio, la regla ignora el
 *    territorio; si no tiene LOB, ignora la LOB; sin ninguno, solo pide el tipo. Entre varios, el de menos leads abiertos.
 *
 * Puro: sin React, sin antd, sin base.
 */
import type { Lead, TipoLead } from './leads';
import { perfilDeCargos } from './areas';
import type { AreaOpcion, CargoOpcion } from './baselines';
import { codigosDe, valorDe } from './camposArea';
import type { CampoArea, ValorCampoArea } from './camposArea';

export interface TerritorioZip {
  codigo: string;
  nombre: string;
  estado: string | null;
  zips: string[];
}

/** El ZIP de la dirección de un lead, si tiene uno de 5 dígitos. */
export function zipDeLead(l: Pick<Lead, 'direccion'>): string | null {
  const z = (l.direccion?.zip ?? '').trim();
  return /^\d{5}$/.test(z) ? z : null;
}

export const territorioDeZip = (zip: string | null, territorios: TerritorioZip[]) => (zip ? (territorios.find((t) => t.zips.includes(zip)) ?? null) : null);

/** Si el territorio de un lead es uno vigente de Datos base (antes era texto libre). */
export const tieneTerritorio = (l: Pick<Lead, 'territorio'>, territorios: TerritorioZip[]) => !!l.territorio && territorios.some((t) => t.codigo === l.territorio);

/** Los leads con ZIP cuyo territorio por ZIP existe y que todavía no lo tienen. */
export function porAsignarTerritorio(leads: Lead[], territorios: TerritorioZip[]): { leadId: string; territorio: string }[] {
  return leads.flatMap((l) => {
    const t = territorioDeZip(zipDeLead(l), territorios);
    return t && l.territorio !== t.codigo ? [{ leadId: l.id, territorio: t.codigo }] : [];
  });
}

export interface ZipSinTerritorio {
  zip: string;
  estado: string | null;
  ciudad: string | null;
  leads: string[];
}

/** Los ZIP de leads que no están en ningún territorio, agrupados por ZIP. */
export function zipsSinTerritorio(leads: Lead[], territorios: TerritorioZip[]): ZipSinTerritorio[] {
  const grupos = new Map<string, ZipSinTerritorio>();
  for (const l of leads) {
    const zip = zipDeLead(l);
    if (!zip || territorioDeZip(zip, territorios)) continue;
    const g = grupos.get(zip) ?? { zip, estado: l.direccion?.estado || null, ciudad: l.direccion?.ciudad || null, leads: [] };
    g.leads.push(l.id);
    grupos.set(zip, g);
  }
  return [...grupos.values()].sort((a, b) => a.zip.localeCompare(b.zip));
}

export interface PropuestaTerritorio {
  zip: string;
  estado: string | null;
  ciudad: string | null;
  leads: string[];
  /** `existente`: agregar el ZIP a ese territorio. `nuevo`: crear un territorio con su estado. */
  tipo: 'existente' | 'nuevo';
  territorio: string | null;
  /** Solo `nuevo`: el nombre propuesto. Los ZIP de una misma ciudad comparten territorio nuevo. */
  nombreNuevo: string | null;
  /** 0 a 1. Para un territorio nuevo, qué tan segura está la propuesta de que no encaja en uno existente. */
  confianza: number;
  motivo: string;
}

const redondear = (x: number) => Math.round(x * 100) / 100;

/** Ask Claro, regla local: propone el territorio de cada ZIP sin territorio. */
export function proponerTerritorios(sin: ZipSinTerritorio[], territorios: TerritorioZip[], leads: Lead[]): PropuestaTerritorio[] {
  return sin.map((g): PropuestaTerritorio => {
    const delEstado = territorios.filter((t) => !g.estado || t.estado === g.estado);
    const base = { zip: g.zip, estado: g.estado, ciudad: g.ciudad, leads: g.leads };

    // 1. El prefijo de 3 dígitos (la zona postal): ¿qué territorio del estado tiene más ZIP con ese prefijo?
    const prefijo = g.zip.slice(0, 3);
    const conPrefijo = delEstado.map((t) => ({ t, n: t.zips.filter((z) => z.startsWith(prefijo)).length })).filter((x) => x.n > 0);
    const totalPrefijo = conPrefijo.reduce((s, x) => s + x.n, 0);
    const mejorPrefijo = conPrefijo.sort((a, b) => b.n - a.n)[0];

    // 2. La ciudad: otros leads de la misma ciudad y estado que ya tienen territorio.
    const vecinos = g.ciudad
      ? leads.filter((l) => l.direccion?.ciudad?.toLowerCase() === g.ciudad!.toLowerCase() && (!g.estado || l.direccion?.estado === g.estado) && tieneTerritorio(l, territorios))
      : [];
    const porCiudad = new Map<string, number>();
    for (const l of vecinos) porCiudad.set(l.territorio!, (porCiudad.get(l.territorio!) ?? 0) + 1);
    const mejorCiudad = [...porCiudad.entries()].sort((a, b) => b[1] - a[1])[0];

    // 3. El ZIP más cercano del estado (por número), si está muy cerca.
    const cercano = delEstado
      .flatMap((t) => t.zips.map((z) => ({ t, d: Math.abs(Number(z) - Number(g.zip)) })))
      .sort((a, b) => a.d - b.d)[0];

    const opciones: PropuestaTerritorio[] = [];
    if (mejorPrefijo) {
      const parte = mejorPrefijo.n / totalPrefijo;
      opciones.push({ ...base, tipo: 'existente', territorio: mejorPrefijo.t.codigo, nombreNuevo: null, confianza: redondear(0.5 + 0.4 * parte), motivo: `Comparte la zona postal ${prefijo} con ${mejorPrefijo.n} ZIP de ${mejorPrefijo.t.nombre}.` });
    }
    if (mejorCiudad) {
      const t = territorios.find((x) => x.codigo === mejorCiudad[0])!;
      opciones.push({ ...base, tipo: 'existente', territorio: t.codigo, nombreNuevo: null, confianza: redondear(Math.min(0.85, 0.55 + 0.1 * mejorCiudad[1])), motivo: `${mejorCiudad[1]} ${mejorCiudad[1] === 1 ? 'lead' : 'leads'} de ${g.ciudad} ya ${mejorCiudad[1] === 1 ? 'está' : 'están'} en ${t.nombre}.` });
    }
    if (cercano && cercano.d <= 20) {
      opciones.push({ ...base, tipo: 'existente', territorio: cercano.t.codigo, nombreNuevo: null, confianza: redondear(0.45 - cercano.d / 100), motivo: `El ZIP más cercano de ${cercano.t.nombre} está a ${cercano.d} números.` });
    }
    const mejor = opciones.sort((a, b) => b.confianza - a.confianza)[0];
    if (mejor) return mejor;

    // 4. No encaja en ninguno: un territorio nuevo con el estado del lead.
    const nombre = g.ciudad ? `${g.ciudad} Area` : `ZIP ${prefijo}xx`;
    return {
      ...base,
      tipo: 'nuevo',
      territorio: null,
      nombreNuevo: nombre,
      confianza: g.estado ? 0.8 : 0.5,
      motivo: delEstado.length
        ? `Ningún territorio de ${g.estado ?? 'su estado'} tiene ZIP de la zona ${prefijo}, ni leads de ${g.ciudad ?? 'esa ciudad'}.`
        : `No hay territorios en ${g.estado ?? 'su estado'} todavía.`,
    };
  });
}

/* ------------------------------------------------------- responsable */

/** El tipo de lead, tal como lo nombra el campo «Tipo de clientes que atiende» (H-040). */
export const TIPO_CLIENTE_DE_LEAD: Record<TipoLead, string> = {
  agente: 'Agente',
  agencia: 'Agencias',
  'vendedor-sin-npn': 'Vendedor sin NPN',
  'benefit-coordinator': 'Benefit coordinator',
};

/** Un Doer de New Business con lo que atiende, de sus datos de Commercial (H-040, H-041). */
export interface CandidatoLead {
  empleadoId: string;
  nombre: string;
  lobs: string[];
  territorios: string[];
  tiposCliente: string[];
}

export type ReglaUsada = 'completa' | 'sin-territorio' | 'sin-lob' | 'solo-tipo';

export function reglaDe(lead: Pick<Lead, 'lobs'>, conTerritorio: boolean): ReglaUsada {
  const conLob = lead.lobs.length > 0;
  return conLob && conTerritorio ? 'completa' : conLob ? 'sin-territorio' : conTerritorio ? 'sin-lob' : 'solo-tipo';
}

/** Quienes cumplen la regla para un lead, el de menos carga primero (y por nombre si empatan). */
export function candidatosPara(lead: Lead, candidatos: CandidatoLead[], territorios: TerritorioZip[], carga: (empleadoId: string) => number) {
  const tipo = TIPO_CLIENTE_DE_LEAD[lead.tipo];
  const territorio = tieneTerritorio(lead, territorios) ? lead.territorio : null;
  return candidatos
    .filter((c) => c.tiposCliente.includes(tipo))
    .filter((c) => lead.lobs.every((l) => c.lobs.includes(l)))
    .filter((c) => !territorio || c.territorios.includes(territorio))
    .map((c) => ({ ...c, carga: carga(c.empleadoId) }))
    .sort((a, b) => a.carga - b.carga || a.nombre.localeCompare(b.nombre));
}

/** El motivo de una asignación, en palabras: qué pidió la regla. */
export function motivoRegla(lead: Lead, territorios: TerritorioZip[]): string {
  const t = tieneTerritorio(lead, territorios) ? territorios.find((x) => x.codigo === lead.territorio)?.nombre : null;
  return ['Doer de New Business', `atiende ${TIPO_CLIENTE_DE_LEAD[lead.tipo]}`, lead.lobs.length ? `cubre ${lead.lobs.join(', ')}` : null, t ? `está en ${t}` : null].filter(Boolean).join(', ');
}

/** Un lead está listo para asignarse si no tiene un ZIP pendiente de territorio. */
export const listoParaAsignar = (l: Lead, territorios: TerritorioZip[]) => !zipDeLead(l) || !!territorioDeZip(zipDeLead(l), territorios);

/** Los Doer de New Business con sus datos de Commercial: línea de negocio, territorios y tipo de clientes (H-040). */
export function candidatosDeLeads(
  empleados: { id: string; nombre: string; cargos: string[] }[],
  base: { cargos: CargoOpcion[]; areas: AreaOpcion[] },
  campos: CampoArea[],
  valores: ValorCampoArea[],
): CandidatoLead[] {
  const comercial = campos.filter((c) => c.area === 'Commercial' && c.vigente);
  const lob = comercial.find((c) => c.fuente === 'lob');
  const territorio = comercial.find((c) => c.fuente === 'territorio');
  const tipos = comercial.find((c) => c.etiqueta === CAMPO_TIPO_CLIENTES);
  const de = (empleadoId: string, campo?: CampoArea) => (campo ? codigosDe(valorDe(valores, empleadoId, campo.id)) : []);
  return empleados
    .filter((e) => perfilDeCargos(e.cargos, base.cargos, base.areas).roles.some((r) => r.rolId === 'doer' && r.area === 'New Business'))
    .map((e) => ({ empleadoId: e.id, nombre: e.nombre, lobs: de(e.id, lob), territorios: de(e.id, territorio), tiposCliente: de(e.id, tipos) }));
}

/** El campo de Commercial con el tipo de clientes que atiende cada Doer (creado en la migración 0029). */
export const CAMPO_TIPO_CLIENTES = 'Tipo de clientes que atiende';

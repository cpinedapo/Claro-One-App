/**
 * La información base del negocio (H-018): carriers, estados, líneas de negocio, cargos, áreas, tipos de comisión y
 * territorios (H-037). La mantiene el Administrador en Configuración › Datos base y el resto de la app la toma de aquí.
 *
 * Puro: sin React, sin antd, sin base.
 */

export const TIPOS_BASELINE = ['carrier', 'state', 'lob', 'cargo', 'area', 'tipo-comision', 'territorio'] as const;
export type TipoBaseline = (typeof TIPOS_BASELINE)[number];

/** Un valor de la información base. Los ids van como texto (en la base son bigint). */
export interface ValorBaseline {
  id: string;
  tipo: TipoBaseline;
  /** La llave que guardan las otras tablas. No cambia. */
  codigo: string;
  nombre: string;
  /** Solo carriers: los códigos de las LOB que vende. */
  lobs: string[];
  /** Solo cargos: los ids de rol del kit para los que aplica (doer, manager…). */
  roles: string[];
  /** Solo áreas (H-038): el área a la que pertenece una sub-área; null si es un área principal. */
  padre: string | null;
  /** Solo cargos (H-038): las áreas o sub-áreas donde trabaja quien lo tiene. */
  areas: string[];
  /** Solo territorios: el código del estado (Datos base) al que pertenece. */
  estado: string | null;
  /** Solo territorios (H-039): la subregión (condado), opcional. */
  subregion: string | null;
  /** Solo territorios: sus ZIP codes, de 5 dígitos, ordenados. */
  zips: string[];
  vigente: boolean;
  desde: string;
  hasta: string | null;
}

/** Lo que un formulario ofrece para elegir: solo valores vigentes. */
export interface OpcionBaseline {
  codigo: string;
  nombre: string;
}

/** Un área o sub-área vigente (H-038). */
export interface AreaOpcion extends OpcionBaseline {
  padre: string | null;
}

/** Un territorio vigente con su estado (H-041): así los estados filtran los territorios. */
export interface TerritorioOpcion extends OpcionBaseline {
  estado: string | null;
}

/** Un cargo vigente con lo que da: su rol (o roles) y su área o sub-áreas (H-038). */
export interface CargoOpcion extends OpcionBaseline {
  roles: string[];
  areas: string[];
}

/** Las opciones vigentes que el Directorio necesita. */
export interface BaselinesVigentes {
  lobs: OpcionBaseline[];
  estados: OpcionBaseline[];
  carriers: OpcionBaseline[];
  cargos: CargoOpcion[];
  /** Las áreas y sub-áreas de la organización (H-038): el área de cada persona (no el alcance de sus permisos). */
  areas: AreaOpcion[];
  /** Los tipos de comisión de una agencia (H-022). */
  tiposComision: OpcionBaseline[];
  /** Los territorios (H-037), con su estado. */
  territorios: TerritorioOpcion[];
}

/**
 * Lee los ZIP codes que alguien pega o escribe: separados por coma, espacio, punto y coma o renglón. Deja los de 5
 * dígitos, sin repetir y ordenados; los demás vuelven aparte para decir cuáles no sirven.
 */
export function leerZips(texto: string): { zips: string[]; invalidos: string[] } {
  const partes = texto.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const invalidos = [...new Set(partes.filter((x) => !/^\d{5}$/.test(x)))];
  const zips = [...new Set(partes.filter((x) => /^\d{5}$/.test(x)))].sort();
  return { zips, invalidos };
}

/** El nombre de un código; si ya no está en la información base, el propio código. */
export const nombreDe = (opciones: OpcionBaseline[], codigo: string) => opciones.find((o) => o.codigo === codigo)?.nombre ?? codigo;

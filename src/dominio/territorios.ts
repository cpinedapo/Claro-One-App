/**
 * Carga masiva de territorios (H-039): leer el archivo de la plantilla del negocio (`Public/territory_template.csv`)
 * y validar cada fila. La misma validación corre en el navegador (vista previa) y en el contrato (al importar).
 *
 * La plantilla trae 4 columnas: Territory Name, Region (el estado, por nombre o por sus 2 letras), Subregion (el
 * condado, opcional) y Zip Codes (separados por coma).
 *
 * Puro: sin React, sin antd, sin base.
 */
import { leerZips } from './baselines';
import type { OpcionBaseline } from './baselines';

export const COLUMNAS_TERRITORIO = ['Territory Name', 'Region', 'Subregion', 'Zip Codes'] as const;
export const MAX_TERRITORIOS = 500;

/** Una fila del archivo, tal como viene. `fila` es el renglón del archivo (el encabezado es el 1). */
export interface FilaTerritorio {
  fila: number;
  nombre: string;
  region: string;
  subregion: string;
  zips: string;
}

/** Una fila ya leída: lo que se guardaría, o sus errores. */
export interface TerritorioLeido {
  fila: number;
  nombre: string;
  estado: string | null;
  subregion: string | null;
  zips: string[];
  errores: string[];
}

/** Lee un CSV (comas, comillas dobles, renglones `\n` o `\r\n`). Devuelve las celdas de cada renglón no vacío. */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const limpio = texto.replace(/^﻿/, '');
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda);
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  fila.push(celda);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas;
}

/** El archivo, en filas. Si el encabezado no es el de la plantilla, dice cuál espera. */
export function filasDeCsv(texto: string): { filas: FilaTerritorio[] } | { error: string } {
  const [encabezado, ...resto] = leerCsv(texto);
  if (!encabezado) return { error: 'El archivo está vacío.' };
  const normal = (x: string) => x.trim().toLowerCase();
  const idx = COLUMNAS_TERRITORIO.map((c) => encabezado.findIndex((h) => normal(h) === normal(c)));
  const faltan = COLUMNAS_TERRITORIO.filter((_, i) => idx[i]! < 0);
  if (faltan.length) return { error: `Al encabezado le faltan columnas de la plantilla: ${faltan.join(', ')}.` };
  if (!resto.length) return { error: 'El archivo no trae territorios: solo el encabezado.' };
  if (resto.length > MAX_TERRITORIOS) return { error: `Hasta ${MAX_TERRITORIOS} territorios por archivo.` };
  const celda = (f: string[], i: number) => (f[idx[i]!] ?? '').trim();
  return { filas: resto.map((f, i) => ({ fila: i + 2, nombre: celda(f, 0), region: celda(f, 1), subregion: celda(f, 2), zips: celda(f, 3) })) };
}

/**
 * Valida todas las filas a la vez: cada una contra Datos base (estados vigentes, territorios vigentes) y contra las
 * demás filas del archivo (un nombre o un ZIP no se repite).
 */
export function validarTerritorios(
  filas: FilaTerritorio[],
  estados: OpcionBaseline[],
  existentes: { nombre: string; zips: string[] }[],
): TerritorioLeido[] {
  const leidos = filas.map((f): TerritorioLeido => {
    const errores: string[] = [];
    if (!f.nombre) errores.push('Falta el nombre del territorio.');
    else if (f.nombre.length > 60) errores.push('El nombre tiene más de 60 caracteres.');
    else if (existentes.some((e) => e.nombre.toLowerCase() === f.nombre.toLowerCase())) errores.push(`«${f.nombre}» ya existe en Datos base.`);
    const region = f.region.toLowerCase();
    const estado = estados.find((e) => e.codigo.toLowerCase() === region || e.nombre.toLowerCase() === region);
    if (!f.region) errores.push('Falta la región (el estado).');
    else if (!estado) errores.push(`«${f.region}» no es un estado vigente de Datos base.`);
    const { zips, invalidos } = leerZips(f.zips);
    if (invalidos.length) errores.push(`ZIP sin 5 dígitos: ${invalidos.slice(0, 5).join(', ')}${invalidos.length > 5 ? '…' : ''}.`);
    else if (!zips.length) errores.push('Faltan los ZIP codes.');
    for (const e of existentes) {
      const rep = zips.filter((z) => e.zips.includes(z));
      if (rep.length) errores.push(`${rep.slice(0, 5).join(', ')} ya ${rep.length === 1 ? 'está' : 'están'} en «${e.nombre}».`);
    }
    return { fila: f.fila, nombre: f.nombre, estado: estado?.codigo ?? null, subregion: f.subregion || null, zips, errores };
  });
  // Dentro del archivo: un nombre o un ZIP en dos filas.
  for (const a of leidos) {
    for (const b of leidos) {
      if (b.fila >= a.fila) continue;
      if (a.nombre && a.nombre.toLowerCase() === b.nombre.toLowerCase()) a.errores.push(`El nombre se repite en la fila ${b.fila}.`);
      const rep = a.zips.filter((z) => b.zips.includes(z));
      if (rep.length) a.errores.push(`${rep.slice(0, 5).join(', ')} también ${rep.length === 1 ? 'está' : 'están'} en la fila ${b.fila}.`);
    }
  }
  return leidos;
}

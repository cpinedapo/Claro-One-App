/**
 * Lector mínimo de .xlsx (solo lectura, primera hoja, valores como texto).
 *
 * Un .xlsx es un ZIP de XML. Se lee con `zlib` de Node para no sumar una dependencia: instalar una hoy
 * obliga a resolver el kit contra GitHub Packages, que pide el token (H-025). Cubre lo que traen las
 * plantillas de importación: textos compartidos, texto en línea y números. No evalúa fórmulas (lee su
 * último valor) ni interpreta fechas.
 */
import 'server-only';
import { inflateRawSync } from 'node:zlib';

/** Las entradas del ZIP: nombre → contenido descomprimido. */
function leerZip(buf: Buffer): Map<string, Buffer> {
  // Fin del directorio central: firma 0x06054b50, buscando desde el final (puede haber comentario).
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido.');
  const entradas = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = new Map<string, Buffer>();
  for (let n = 0; n < entradas; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('El archivo no es un .xlsx válido.');
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);
    // El encabezado local tiene su propio largo de nombre y de extra.
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(inicio, inicio + comprimido);
    if (metodo === 0) archivos.set(nombre, Buffer.from(datos));
    else if (metodo === 8) archivos.set(nombre, inflateRawSync(datos));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const entidades = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** El texto de un nodo con uno o varios `<t>` (texto enriquecido incluido). */
const textoDe = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => entidades(m[1]!)).join('');

/** «AB» → 27 (base 0: 27 es la columna 28). */
function columna(ref: string) {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

/** Las filas de la primera hoja: cada una con su número de fila de Excel y sus celdas como texto. */
export function leerPrimeraHoja(buf: Buffer): { fila: number; celdas: string[] }[] {
  const zip = leerZip(buf);
  const xml = (nombre: string) => zip.get(nombre)?.toString('utf8') ?? '';

  // La primera hoja según el libro y sus relaciones; si no, la primera que haya.
  const libro = xml('xl/workbook.xml');
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(libro)?.[1];
  const rels = xml('xl/_rels/workbook.xml.rels');
  const destino = rid ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1] : undefined;
  const ruta = destino ? (destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`) : [...zip.keys()].filter((k) => k.startsWith('xl/worksheets/sheet')).sort()[0];
  const hoja = ruta ? xml(ruta) : '';
  if (!hoja) throw new Error('El archivo no tiene hojas.');

  const compartidos = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]!));

  const filas: { fila: number; celdas: string[] }[] = [];
  for (const f of hoja.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const numero = Number(/\br="(\d+)"/.exec(f[1]!)?.[1] ?? filas.length + 1);
    const celdas: string[] = [];
    for (const c of f[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const cuerpo = c[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
      let valor = '';
      if (tipo === 's' && v !== undefined) valor = compartidos[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
      else if (v !== undefined) valor = entidades(v);
      celdas[ref ? columna(ref) : celdas.length] = valor;
    }
    filas.push({ fila: numero, celdas: Array.from(celdas, (x) => x ?? '') });
  }
  return filas;
}

/* ------------------------------------------------------------------ escritura */

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Un ZIP sin compresión (método 0): basta para un .xlsx de una hoja. */
function escribirZip(archivos: [string, string][]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const datos = Buffer.from(contenido, 'utf8');
    const n = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, n, datos);
    centrales.push(central, n);
    desplazamiento += local.length + n.length + datos.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, dir, fin]);
}

const xmlTexto = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letra = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** Un .xlsx de una hoja con una sola fila: los encabezados de una plantilla. */
export function plantillaXlsx(hoja: string, encabezados: string[]): Buffer {
  const celdas = encabezados.map((h, i) => `<c r="${letra(i)}1" t="inlineStr"><is><t>${xmlTexto(h)}</t></is></c>`).join('');
  return escribirZip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlTexto(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${celdas}</row></sheetData></worksheet>`],
  ]);
}

/**
 * Importación masiva de leads (H-025): las plantillas .xlsx del negocio (`public/`), una por tipo.
 *
 * Reglas del negocio (2026-10-15):
 * - Lo obligatorio va marcado con asterisco en la plantilla. Además, el nombre es obligatorio en las cuatro
 *   (sin nombre no hay lead) — HIPÓTESIS: el de Benefit Coordinator no trae ningún asterisco.
 * - Line of Business: solo las líneas de negocio vigentes de Configuración › Datos base.
 * - Source: On field, Marketing, Google Search, Event, Benefit coordinator. «Benefit coordinator» no aplica a un
 *   lead que es benefit coordinator.
 * - State: las iniciales de un estado vigente de Datos base.
 * - Priority: High, Medium, Low.
 * - El tipo de lead lo da la plantilla elegida, no la columna «Lead Type».
 * - Languages: solo los idiomas de preferencia permitidos (H-026).
 * - Un archivo entra completo o no entra: se importa solo si el 100 % de sus filas es válido (H-026).
 * - Status vacío = «New». Una importación solo se borra si todos sus leads siguen en «New» (H-026).
 *
 * Puro: sin React, sin antd, sin base. Lo usan la vista previa y el contrato (que vuelve a validar).
 */
import type { OpcionBaseline } from './baselines';
import type { TipoLead } from './leads';

export const TIPOS_IMPORTACION: TipoLead[] = ['agencia', 'agente', 'vendedor-sin-npn', 'benefit-coordinator'];

/** La plantilla de cada tipo, servida desde `public/`. */
export const PLANTILLAS: Record<TipoLead, string> = {
  agencia: 'Agency leads_template.xlsx',
  agente: 'Agent leads Tempalte.xlsx',
  'vendedor-sin-npn': 'Vendor leads Tempalte.xlsx',
  'benefit-coordinator': 'benefit_coordinators_template (4).xlsx',
};

/** Los campos que se leen, por el encabezado de la plantilla (sin asterisco ni mayúsculas). */
const COLUMNAS: Record<string, string> = {
  'agency name': 'nombre',
  name: 'nombre',
  address: 'calle',
  city: 'ciudad',
  state: 'estado',
  'zip code': 'zip',
  'line of business': 'lobs',
  source: 'fuente',
  status: 'estatus',
  priority: 'prioridad',
  'contact name': 'contactoNombre',
  'contact type': 'contactoTipo',
  phone: 'telefono1',
  'phone 2': 'telefono2',
  'phone 3': 'telefono3',
  email: 'email1',
  'email 2': 'email2',
  languages: 'idiomas',
  linkedin: 'linkedin',
  website: 'web1',
  'website 2': 'web2',
  'contact notes': 'notas',
  'aca members': 'miembrosACAFuera',
  'lob outside claro': 'lobFueraDeClaro',
  'years licensed': 'aniosLicencia',
  'licensed states': 'estadosLicenciados',
  'number of agents': 'numeroAgentes',
  'number of contracts': 'numeroContratos',
  'medical center': 'centroMedico',
};
export const normalizarEncabezado = (h: string) => h.replace(/\*/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Lo obligatorio por tipo: lo marcado con asterisco en cada plantilla, más el nombre. */
const OBLIGATORIOS: Record<TipoLead, string[]> = {
  agencia: ['nombre', 'telefono1'],
  agente: ['nombre', 'telefono1'],
  'vendedor-sin-npn': ['nombre', 'telefono1'],
  'benefit-coordinator': ['nombre'],
};
/** Los encabezados obligatorios de cada tipo, como aparecen en su plantilla (para la ayuda de la pantalla). */
export const OBLIGATORIOS_DE: Record<TipoLead, string[]> = {
  agencia: ['Agency Name', 'Phone'],
  agente: ['Name', 'Phone'],
  'vendedor-sin-npn': ['Name', 'Phone'],
  'benefit-coordinator': ['Name'],
};
/** Las columnas que delatan la plantilla de cada tipo. */
const PROPIAS: Partial<Record<TipoLead, string>> = { agencia: 'agency name', 'benefit-coordinator': 'medical center' };

export const FUENTES_IMPORTACION: Record<string, string> = {
  'on field': 'on-field',
  marketing: 'marketing',
  'google search': 'google-search',
  event: 'evento',
  'benefit coordinator': 'benefit-coordinator',
};
const PRIORIDADES: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

/** Una fila cruda: campo → texto, con su número de fila en Excel. */
export interface FilaCruda {
  fila: number;
  valores: Record<string, string>;
}

/** Un lead listo para crear. */
export interface LeadImportado {
  nombre: string;
  telefonos: string[];
  emails: string[];
  lobs: string[];
  fuente: string | null;
  disposicion: string | null;
  prioridad: string | null;
  contactoNombre: string | null;
  contactoTipo: string | null;
  idiomas: string[];
  linkedin: string | null;
  webs: string[];
  notas: string | null;
  direccion: { calle: string; ciudad: string; estado: string; zip: string; comercial: boolean } | null;
  centroMedico: string | null;
  infoNegocio: Record<string, number | string[]> | null;
  /** El territorio por su ZIP (H-042); lo pone el contrato al importar. */
  territorio?: string | null;
}

export interface ErrorFila {
  fila: number;
  /** El encabezado de la plantilla (Phone, Source…). */
  campo: string;
  /** El campo interno, para marcar la celda en la vista previa. */
  clave?: string;
  mensaje: string;
}

/** Los idiomas de preferencia permitidos (H-026). */
export const IDIOMAS_PERMITIDOS = [
  'English', 'Spanish', 'Creole', 'Vietnamese', 'Korean', 'Chinese', 'Arabic', 'French', 'Portuguese', 'Croatian', 'Haitian', 'Hindi', 'Hebrew',
] as const;

/** El status con el que entra un lead importado si la fila no trae uno. */
export const STATUS_INICIAL = 'New';
export const esStatusInicial = (d: string | null | undefined) => (d ?? STATUS_INICIAL).trim().toLowerCase() === STATUS_INICIAL.toLowerCase();

/** El encabezado de cada campo, para los errores. */
const ETIQUETA: Record<string, string> = {
  nombre: 'Name', telefono1: 'Phone', telefono2: 'Phone 2', telefono3: 'Phone 3', email1: 'Email', email2: 'Email 2', lobs: 'Line of Business',
  fuente: 'Source', prioridad: 'Priority', estado: 'State', zip: 'Zip Code', linkedin: 'LinkedIn', web1: 'Website', web2: 'Website 2', idiomas: 'Languages',
  miembrosACAFuera: 'ACA Members', aniosLicencia: 'Years Licensed', estadosLicenciados: 'Licensed States', numeroAgentes: 'Number of Agents', numeroContratos: 'Number of Contracts',
};
const CLAVE_DE: Record<string, string> = Object.fromEntries(Object.entries(ETIQUETA).map(([k, v]) => [v, k]));

/** De la hoja a filas crudas. Revisa que sea la plantilla del tipo elegido. */
export function filasDeHoja(tipo: TipoLead, hoja: { fila: number; celdas: string[] }[]): { filas: FilaCruda[] } | { error: string } {
  const [cabecera, ...resto] = hoja;
  if (!cabecera) return { error: 'El archivo está vacío.' };
  const encabezados = cabecera.celdas.map((c) => normalizarEncabezado(c ?? ''));
  const campos = encabezados.map((h) => COLUMNAS[h] ?? null);
  if (!campos.includes('nombre') || !campos.includes('telefono1')) return { error: 'No es una plantilla de leads: le faltan las columnas de nombre o teléfono.' };
  for (const [t, propia] of Object.entries(PROPIAS) as [TipoLead, string][]) {
    if (t !== tipo && encabezados.includes(propia)) return { error: 'Ese archivo es la plantilla de otro tipo de lead.' };
  }
  const propiaDelTipo = PROPIAS[tipo];
  if (propiaDelTipo && !encabezados.includes(propiaDelTipo)) return { error: 'Ese archivo no es la plantilla de este tipo de lead.' };
  const filas = resto
    .map((r) => ({
      fila: r.fila,
      valores: Object.fromEntries(campos.flatMap((campo, i) => (campo ? [[campo, (r.celdas[i] ?? '').trim()]] : []))) as Record<string, string>,
    }))
    .filter((r) => Object.values(r.valores).some((v) => v !== ''));
  return { filas };
}

const URL_ = /^https?:\/\/\S+\.\S+$/i;
const conEsquema = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const lista = (v: string | undefined) => (v ?? '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);

/** Valida una fila contra las reglas y los catálogos vigentes. */
export function validarFila(
  tipo: TipoLead,
  f: FilaCruda,
  catalogo: { lobs: OpcionBaseline[]; estados: string[] },
): { lead: LeadImportado | null; errores: ErrorFila[] } {
  const v = f.valores;
  const errores: ErrorFila[] = [];
  const error = (campo: string, mensaje: string) => errores.push({ fila: f.fila, campo, clave: CLAVE_DE[campo] ?? '', mensaje });

  for (const campo of OBLIGATORIOS[tipo]) if (!v[campo]) error(campo === 'telefono1' ? 'Phone' : 'Name', 'Es obligatorio.');
  const nombre = (v.nombre ?? '').replace(/\*+$/, '').trim();

  const telefonos: string[] = [];
  for (const [campo, etiqueta] of [['telefono1', 'Phone'], ['telefono2', 'Phone 2'], ['telefono3', 'Phone 3']] as const) {
    if (!v[campo]) continue;
    let d = v[campo]!.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length !== 10) error(etiqueta, `«${v[campo]}» no es un teléfono de 10 dígitos.`);
    else telefonos.push(d);
  }
  const emails: string[] = [];
  for (const [campo, etiqueta] of [['email1', 'Email'], ['email2', 'Email 2']] as const) {
    if (!v[campo]) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[campo]!)) error(etiqueta, `«${v[campo]}» no es un correo válido.`);
    else emails.push(v[campo]!.toLowerCase());
  }

  // Line of Business: solo las vigentes de Datos base (por código o por nombre, sin importar mayúsculas).
  const lobs: string[] = [];
  for (const l of lista(v.lobs)) {
    const o = catalogo.lobs.find((x) => x.codigo.toLowerCase() === l.toLowerCase() || x.nombre.toLowerCase() === l.toLowerCase());
    if (!o) error('Line of Business', `«${l}» no es una línea de negocio de Datos base.`);
    else if (!lobs.includes(o.codigo)) lobs.push(o.codigo);
  }

  let fuente: string | null = null;
  if (v.fuente) {
    fuente = FUENTES_IMPORTACION[v.fuente.trim().toLowerCase()] ?? null;
    if (!fuente) error('Source', `«${v.fuente}» no es una fuente permitida (On field, Marketing, Google Search, Event, Benefit coordinator).`);
    else if (fuente === 'benefit-coordinator' && tipo === 'benefit-coordinator') error('Source', '«Benefit coordinator» no aplica a un lead que es benefit coordinator.');
  }

  let prioridad: string | null = null;
  if (v.prioridad) {
    prioridad = PRIORIDADES[v.prioridad.trim().toLowerCase()] ?? null;
    if (!prioridad) error('Priority', `«${v.prioridad}» no es una prioridad (High, Medium, Low).`);
  }

  let estado = '';
  if (v.estado) {
    estado = v.estado.trim().toUpperCase();
    if (!catalogo.estados.includes(estado)) error('State', `«${v.estado}» no son las iniciales de un estado de Datos base.`);
  }
  let zip = '';
  if (v.zip) {
    zip = v.zip.replace(/\D/g, '');
    if (zip.length === 4) zip = `0${zip}`; // Excel le quita el cero inicial a un ZIP numérico.
    if (!/^\d{5}$/.test(zip)) error('Zip Code', `«${v.zip}» no es un ZIP de 5 dígitos.`);
  }

  let linkedin: string | null = null;
  if (v.linkedin) {
    linkedin = conEsquema(v.linkedin);
    if (!URL_.test(linkedin)) error('LinkedIn', `«${v.linkedin}» no es un enlace.`);
  }
  const webs: string[] = [];
  for (const [campo, etiqueta] of [['web1', 'Website'], ['web2', 'Website 2']] as const) {
    if (!v[campo]) continue;
    const w = conEsquema(v[campo]!);
    if (!URL_.test(w)) error(etiqueta, `«${v[campo]}» no es un enlace.`);
    else webs.push(w);
  }

  // Business Information (solo Agencia y Agente traen estas columnas).
  const info: Record<string, number | string[]> = {};
  for (const [campo, etiqueta] of [
    ['miembrosACAFuera', 'ACA Members'],
    ['aniosLicencia', 'Years Licensed'],
    ['estadosLicenciados', 'Licensed States'],
    ['numeroAgentes', 'Number of Agents'],
    ['numeroContratos', 'Number of Contracts'],
  ] as const) {
    if (!v[campo]) continue;
    const n = Number(v[campo]!.replace(/,/g, ''));
    if (!Number.isInteger(n) || n < 0) error(etiqueta, `«${v[campo]}» tiene que ser un número entero.`);
    else info[campo] = n;
  }
  if (v.lobFueraDeClaro) info.lobFueraDeClaro = lista(v.lobFueraDeClaro);

  const idiomas: string[] = [];
  for (const i of lista(v.idiomas)) {
    const permitido = IDIOMAS_PERMITIDOS.find((x) => x.toLowerCase() === i.toLowerCase());
    if (!permitido) error('Languages', `«${i}» no es un idioma permitido (${IDIOMAS_PERMITIDOS.join(', ')}).`);
    else if (!idiomas.includes(permitido)) idiomas.push(permitido);
  }

  if (errores.length) return { lead: null, errores };
  const hayDireccion = v.calle || v.ciudad || estado || zip;
  return {
    lead: {
      nombre,
      telefonos,
      emails,
      lobs,
      fuente,
      disposicion: v.estatus || STATUS_INICIAL,
      prioridad,
      contactoNombre: v.contactoNombre || (tipo === 'agencia' ? null : nombre),
      contactoTipo: v.contactoTipo || null,
      idiomas,
      linkedin,
      webs,
      notas: v.notas || null,
      direccion: hayDireccion ? { calle: v.calle ?? '', ciudad: v.ciudad ?? '', estado, zip, comercial: tipo === 'agencia' } : null,
      centroMedico: tipo === 'benefit-coordinator' ? v.centroMedico || null : null,
      infoNegocio: Object.keys(info).length ? info : null,
    },
    errores: [],
  };
}

/** La clave para detectar duplicados: nombre y teléfono principal. */
export const claveLead = (nombre: string, telefono: string | null | undefined) => `${nombre.trim().toLowerCase()}|${(telefono ?? '').replace(/\D/g, '').slice(-10)}`;

/** El tope de filas de una carga. */
export const MAX_FILAS = 2000;

/**
 * Valida un archivo completo: cada fila contra las reglas, y que no se repita ni en el archivo ni con un lead
 * que ya existe (mismo nombre y teléfono principal).
 */
export function validarImportacion(
  tipo: TipoLead,
  filas: FilaCruda[],
  catalogo: { lobs: OpcionBaseline[]; estados: string[] },
  existentes: Set<string>,
): { validos: { fila: number; lead: LeadImportado }[]; errores: ErrorFila[] } {
  const validos: { fila: number; lead: LeadImportado }[] = [];
  const errores: ErrorFila[] = [];
  const enArchivo = new Map<string, number>();
  for (const f of filas) {
    const r = validarFila(tipo, f, catalogo);
    if (!r.lead) {
      errores.push(...r.errores);
      continue;
    }
    const clave = claveLead(r.lead.nombre, r.lead.telefonos[0]);
    if (existentes.has(clave)) {
      errores.push({ fila: f.fila, campo: 'Name', clave: 'nombre', mensaje: 'Ya existe un lead con ese nombre y teléfono.' });
      continue;
    }
    const previa = enArchivo.get(clave);
    if (previa !== undefined) {
      errores.push({ fila: f.fila, campo: 'Name', clave: 'nombre', mensaje: `Repite la fila ${previa} del archivo.` });
      continue;
    }
    enArchivo.set(clave, f.fila);
    validos.push({ fila: f.fila, lead: r.lead });
  }
  return { validos, errores };
}

/** Una importación ya hecha, para el historial. */
export interface ImportacionHecha {
  id: string;
  tipo: TipoLead;
  archivo: string;
  por: string;
  cuando: string;
  total: number;
  importados: number;
  rechazados: number;
  errores: ErrorFila[];
  /** Si se eliminó (H-026): quién y cuándo. Queda en el historial. */
  eliminada: { cuando: string; por: string } | null;
}

/** Lo que necesita la vista previa: los encabezados del archivo, con su campo interno. */
export function encabezadosDeHoja(hoja: { celdas: string[] }[]): { clave: string; etiqueta: string }[] {
  return (hoja[0]?.celdas ?? []).flatMap((c) => {
    const clave = COLUMNAS[normalizarEncabezado(c ?? '')];
    return clave ? [{ clave, etiqueta: (c ?? '').trim() }] : [];
  });
}

/**
 * Lead Management (prototipo PB-002 v2.6, pipeline comercial): un pool único de contactos que se
 * mueve por fases (lead → onboarding → cliente). Lead Management muestra la fase `lead` (All Leads),
 * su Weekly Planner y su Daily Route. Las interacciones comerciales (llamada, visita, reunión, evento)
 * son la misma cola en el lead, en el Planner, en la Ruta y en el Calendario: no hay copias.
 *
 * Entidades: Prospect (hipótesis de nombre) e Interacción comercial (hipótesis), ver H-021.
 * Puro: sin React, sin antd, sin base.
 */
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';

export const TIPOS_LEAD = ['agente', 'agencia', 'vendedor-sin-npn', 'benefit-coordinator'] as const;
export type TipoLead = (typeof TIPOS_LEAD)[number];

export const FASES = ['lead', 'onboarding', 'cliente'] as const;
export type Fase = (typeof FASES)[number];

export const TIPOS_INTERACCION = ['llamada', 'visita', 'reunion', 'evento'] as const;
export type TipoInteraccionComercial = (typeof TIPOS_INTERACCION)[number];

export const RESULTADOS = ['exitosa', 'no-interesado', 'sin-exito'] as const;
export type Resultado = (typeof RESULTADOS)[number];

/** Los estados de negocio del kit que usa un lead o una interacción (siempre con motivo). */
export const ESTADOS_COMERCIALES = ['pending', 'waiting', 'ok', 'at-risk', 'blocked', 'neutral'] as const;

/** Fuentes: origen y canal (C-1, A-5). Ejemplos que el negocio configura. Ids estables; los nombres se
 *  traducen en la pantalla. */
export const ORIGENES_LEAD: { id: string; canales: string[] }[] = [
  { id: 'marketing', canales: ['Formulario de red social', 'Formulario web', 'Código QR', 'Webinar', 'Campaña de correo'] },
  { id: 'prospeccion', canales: ['Base cargada', 'Llamada en frío', 'Visita en campo'] },
  { id: 'referido', canales: ['Agente', 'Agencia', 'Benefit coordinator', 'Centro médico'] },
  { id: 'inbound', canales: ['Llamada entrante', 'Mensaje', 'Correo', 'Web'] },
  { id: 'evento', canales: ['Feria comercial', 'Evento presencial'] },
  // Fuentes permitidas en la importación (H-025).
  { id: 'on-field', canales: [] },
  { id: 'google-search', canales: [] },
  { id: 'benefit-coordinator', canales: [] },
];

/** Motivos de cierre (C-3), agrupados en dos familias. */
export const MOTIVOS_CIERRE: Record<'no-contactable' | 'no-interesado', string[]> = {
  'no-contactable': ['No se encontró', 'Contacto inválido', 'Ya está con Claro', 'Duplicado', 'Dejó los seguros', 'Cautivo o franquicia'],
  'no-interesado': ['Oferta poco atractiva', 'Mejor compensación en otro lado', 'Mala experiencia previa', 'Dejó de responder', 'No quiere cambiar'],
};
export type FamiliaCierre = keyof typeof MOTIVOS_CIERRE;

export interface Fuente {
  origen: string;
  canal: string;
  campana?: string;
}

/** Business Information (KeyLeadInfoPanel de «Claro Go»): todo opcional. */
export type InfoNegocio = Partial<Record<string, number | string | string[]>>;

export interface Lead {
  id: string;
  nombre: string;
  tipo: TipoLead;
  lobs: string[];
  fase: Fase;
  disposicion: string | null;
  estado: string;
  motivo: string;
  responsableId: string | null;
  fecha: string;
  contacto: { nombre: string | null; telefono: string | null; email: string | null };
  /** Contacto ampliado de las plantillas de importación (H-025). */
  contactoTipo: string | null;
  telefonos: string[];
  emails: string[];
  idiomas: string[];
  linkedin: string | null;
  webs: string[];
  notas: string | null;
  /** La importación de la que salió. */
  importacionId: string | null;
  fuentes: Fuente[];
  referidoPor: string | null;
  prioridad: string | null;
  territorio: string | null;
  idioma: string | null;
  direccion: { calle: string; ciudad: string; estado: string; zip: string; comercial: boolean } | null;
  centroMedico: string | null;
  cierre: { familia: FamiliaCierre; motivo: string; fecha: string } | null;
  infoNegocio: InfoNegocio | null;
  cadencia: { paso: string; hecho: boolean; fecha: string | null }[] | null;
  demo: boolean;
}

export interface InteraccionComercial {
  id: string;
  leadId: string;
  tipo: TipoInteraccionComercial;
  fecha: string;
  estado: string;
  motivo: string;
  empleadoId: string | null;
  nombre: string;
  notas: string | null;
  /** Por dónde entró: Manual, Weekly Planner, Daily Route, Calendario, Detalle de lead. */
  origen: string;
  contactoNombre: string | null;
  primera: boolean;
  seguimiento: boolean;
  personaContactada: string | null;
  disposicion: string | null;
  ordenRuta: number | null;
  resultado: Resultado | null;
  familiaResultado: FamiliaCierre | null;
  motivoResultado: string | null;
  siguientePaso: string | null;
}

export const leadsDeFase = (leads: Lead[], fase: Fase) => leads.filter((l) => l.fase === fase);
export const interaccionesDeLead = (is: InteraccionComercial[], leadId: string) => is.filter((i) => i.leadId === leadId);
export function interaccionesDeFase(leads: Lead[], is: InteraccionComercial[], fase: Fase) {
  const ids = new Set(leadsDeFase(leads, fase).map((l) => l.id));
  return is.filter((i) => ids.has(i.leadId));
}
/** Una interacción hecha (ok) a la que todavía le falta su resultado. */
export const faltaResultado = (i: InteraccionComercial) => i.estado === 'ok' && !i.resultado;

/**
 * IA-2: candidato a responsable de un lead: quien tenga una asignación activa en New Business o
 * Comercial que cubra la línea del lead, con menos leads abiertos. Regla de ejemplo del prototipo.
 */
export function sugerirResponsable(lead: Lead, empleados: Empleado[], leads: Lead[]): { empleadoId: string; nombre: string; abiertos: number } | null {
  const cubre = (e: Empleado) =>
    e.asignaciones.some((a) => a.est === 'ok' && ['new-business', 'comercial'].includes(a.alcanceValor ?? '') && (!a.lob || lead.lobs.includes(a.lob)));
  const abiertos = (id: string) => leads.filter((p) => p.fase === 'lead' && p.responsableId === id && !p.cierre).length;
  const candidatos = empleados.filter(cubre).map((e) => ({ e, n: abiertos(e.id) })).sort((a, b) => a.n - b.n);
  const primero = candidatos[0];
  return primero ? { empleadoId: primero.e.id, nombre: primero.e.nombre, abiertos: primero.n } : null;
}

/**
 * IA-3: lee la nota de la interacción y sugiere resultado, familia y motivo, y siguiente paso.
 * Heurística de ejemplo del prototipo; en el TARGET, un modelo sobre la transcripción.
 */
export function sugerirResultado(i: InteraccionComercial): { resultado: Resultado; familia: FamiliaCierre | null; motivo: string | null; siguientePaso: string; razon: string } {
  const notas = i.notas ?? '';
  const nota = notas.toLowerCase();
  const frase = (inicio: string) => {
    const k = nota.indexOf(inicio);
    if (k < 0) return null;
    const texto = notas.slice(k);
    const fin = texto.indexOf('.');
    return (fin >= 0 ? texto.slice(0, fin + 1) : texto).trim();
  };
  const siguiente = frase('volver a llamar') ?? frase('agendar');
  if (nota.includes('no le interesa') || nota.includes('no está interesad')) {
    return { resultado: 'no-interesado', familia: 'no-interesado', motivo: nota.includes('compensaci') ? 'Mejor compensación en otro lado' : 'Oferta poco atractiva', siguientePaso: 'Cerrar el lead con su motivo', razon: 'La nota dice que no le interesa.' };
  }
  if (nota.includes('número equivocado') || nota.includes('no contest') || nota.includes('buzón')) {
    return { resultado: 'sin-exito', familia: 'no-contactable', motivo: nota.includes('número equivocado') ? 'Contacto inválido' : 'No se encontró', siguientePaso: 'Reintentar en dos días', razon: 'La nota dice que no se logró el contacto.' };
  }
  if (nota.includes('interesa')) {
    return { resultado: 'exitosa', familia: null, motivo: null, siguientePaso: siguiente ?? 'Agendar seguimiento', razon: 'La nota muestra interés y un siguiente paso.' };
  }
  return { resultado: 'sin-exito', familia: null, motivo: null, siguientePaso: siguiente ?? 'Reintentar', razon: 'La nota no muestra un resultado claro.' };
}

/** Las secciones de Business Information y sus campos, en el orden de «Claro Go». */
export const SECCIONES_INFO_NEGOCIO: { id: string; campos: { key: string; tipo: 'numero' | 'texto' | 'lista' }[] }[] = [
  { id: 'metricas', campos: [{ key: 'miembrosACAFuera', tipo: 'numero' }, { key: 'miembrosMedicareFuera', tipo: 'numero' }, { key: 'lifeAPFuera', tipo: 'numero' }, { key: 'miembrosPCFuera', tipo: 'numero' }, { key: 'lobFueraDeClaro', tipo: 'lista' }, { key: 'interesadoEn', tipo: 'lista' }] },
  { id: 'volumen', campos: [{ key: 'acaComprometido', tipo: 'texto' }, { key: 'medicareComprometido', tipo: 'texto' }, { key: 'lifeComprometido', tipo: 'texto' }, { key: 'pcComprometido', tipo: 'texto' }] },
  { id: 'licencia', campos: [{ key: 'aniosLicencia', tipo: 'numero' }, { key: 'estadosLicenciados', tipo: 'numero' }, { key: 'numeroAgentes', tipo: 'numero' }, { key: 'numeroContratos', tipo: 'numero' }] },
  { id: 'carriers', campos: [{ key: 'carriersACA', tipo: 'lista' }, { key: 'carriersMedicare', tipo: 'lista' }, { key: 'carriersVida', tipo: 'lista' }, { key: 'carriersPC', tipo: 'lista' }] },
  { id: 'uplines', campos: [{ key: 'uplineACA', tipo: 'lista' }, { key: 'uplineMedicare', tipo: 'lista' }, { key: 'uplineVida', tipo: 'lista' }, { key: 'uplinePC', tipo: 'lista' }] },
  { id: 'notas', campos: [{ key: 'modeloNegocio', tipo: 'texto' }, { key: 'objecionesClave', tipo: 'texto' }, { key: 'proximosPasos', tipo: 'texto' }] },
];

export const tieneValor = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '');

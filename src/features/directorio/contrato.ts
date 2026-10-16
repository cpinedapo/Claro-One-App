/**
 * CONTRATO DE LA CAPABILITY · Gestión de agencias
 *
 * Crear una agencia y editar su información (`agencies`, modelo del negocio H-013). Es del producto:
 * ni el arnés ni el kit traen un contrato para esto (H-015). Por eso sus reglas citan la decisión y
 * no una RUL.
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta. Ninguna
 *   IA. Hipótesis: confirmar con el negocio si New Business o Contracting también crean agencias.
 * - La agencia madre se elige al CREAR y no se edita aquí: cambiar la jerarquía es su propio flujo
 *   (MN11 del arnés: formatos, firma, envío al carrier) y `parent_id` no guarda historia.
 * - Nombre y al menos una compañía interna son obligatorios. EIN de 9 dígitos y teléfono de 10. Ni el
 *   nombre bajo la misma agencia madre ni el NPN se repiten.
 * - Editar deja en el rastro cada campo que cambió, con su valor de antes y de después.
 *
 * La entrada del contrato es texto (`EntradaAccion`): listas separadas por coma, sí/no como
 * 'true'/'false', vacío como ''.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import type { Cambio, EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { COMPANIAS } from '@arc2-0/claro-one-kit/dominio';
import { NIVELES_PAGO, exigeCodigoPersona, masterDe, nivelesDe, pagoDeAgencia } from '@/dominio/pagos';

export const ESTADOS = ['active', 'inactive', 'pending_contracting', 'pending_documents'] as const;
export const COMUNICACIONES = ['parent_agency', 'agency'] as const;
export const REPORTES = ['agency', 'agents_and_agency', 'agent'] as const;

/** Lo que el contrato necesita saber de una agencia. Los ids van como texto (en la base son bigint). */
export interface AgenciaContrato {
  id: string;
  nombre: string;
  parentId: string | null;
  estado: string;
  npn: string | null;
  taxId: string | null;
  telefono: string | null;
  inicio: string | null;
  portal: boolean | null;
  comunicaciones: string | null;
  reportes: string | null;
  cobraAgenteId: string | null;
  companias: string[];
  calle: string | null;
  ciudad: string | null;
  estadoUS: string | null;
  zip: string | null;
  /* En línea y pagos (H-022) */
  web: string | null;
  linkedin: string | null;
  redes: string[];
  tipoComision: string | null;
  comisionPagadaA: string | null;
  bonoPagadoA: string | null;
  codigoPagoClaro: string | null;
  codigoPagoAtoz: string | null;
  legacy: boolean;
}

export interface AgenteContrato {
  id: string;
  npn: string;
  nombre: string;
  /** Las agencias con relación vigente. */
  agencias: string[];
}

/** Lo que una acción de alta agrega. Lo escribe la persistencia; el contrato solo lo valida y lo declara. */
export type Alta =
  | { tipo: 'agente-nuevo'; agenciaId: string; nombre: string; npn: string; email: string | null; telefono: string | null; lobs: string[]; ffm: boolean; companias: string[]; codigoPagoClaro: string | null; codigoPagoAtoz: string | null }
  | { tipo: 'agente-existente'; agenciaId: string; agenteId: string }
  | { tipo: 'representante'; agenciaId: string; nombre: string; agenteId: string | null; email: string | null; telefono: string | null }
  | { tipo: 'staff'; agenciaId: string; nombre: string; puesto: string | null; email: string | null; telefono: string | null }
  | { tipo: 'vendedor'; agenciaId: string; nombre: string; agenteId: string | null; email: string | null; telefono: string | null; companias: string[]; codigoPagoClaro: string | null; codigoPagoAtoz: string | null };

/** Una persona de las que viven en las agencias, con lo que se puede editar (H-020). */
export type TipoMiembro = 'agente' | 'representante' | 'staff' | 'vendedor';
export interface PersonaContrato {
  tipo: TipoMiembro;
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  /** Agente. */
  npn: string | null;
  lobs: string[];
  ffm: boolean;
  /** Agente y vendedor. */
  companias: string[];
  /** Staff. */
  puesto: string | null;
  /** Representante y vendedor que también son agentes. */
  agenteId: string | null;
  /** Agente y vendedor sin licencia (H-023). */
  codigoPagoClaro: string | null;
  codigoPagoAtoz: string | null;
  /** Las agencias con relación vigente. */
  agencias: string[];
}

/** Las relaciones vigentes de una agencia con su equipo de Claro, sus LOB y sus labels (H-017). */
export interface RelacionesAgencia {
  equipoClaro: { id: string; agenciaId: string; empleadoId: string; rol: string }[];
  lobs: { id: string; agenciaId: string; lob: string }[];
  etiquetas: { id: string; agenciaId: string; texto: string }[];
  empleados: { id: string; nombre: string }[];
  /** Negociaciones especiales tipo Legacy vigentes (H-022). */
  legacy: { id: string; agenciaId: string; compania: string; lob: string }[];
}

/** Lo que una acción sobre las relaciones cambia. Lo escribe la persistencia. */
export type Operacion =
  | { tipo: 'equipo-claro-alta'; agenciaId: string; empleadoId: string; rol: string }
  | { tipo: 'equipo-claro-baja'; id: string }
  | { tipo: 'lob-alta'; agenciaId: string; lob: string }
  | { tipo: 'lob-baja'; id: string }
  | { tipo: 'etiqueta-alta'; agenciaId: string; texto: string }
  | { tipo: 'etiqueta-baja'; id: string }
  | { tipo: 'persona-edicion'; persona: PersonaContrato }
  | { tipo: 'membresia-baja'; persona: TipoMiembro; personaId: string; agenciaId: string }
  | { tipo: 'legacy-alta'; agenciaId: string; compania: 'claro' | 'atoz'; lob: string; tasaAgente: number; cargoAdministrativo: number | null; detalle: string }
  | { tipo: 'legacy-baja'; id: string };

export interface EstadoAgencias extends RelacionesAgencia {
  agencias: AgenciaContrato[];
  agentes: AgenteContrato[];
  /** Vacío al cargar; cada acción de alta deja aquí lo que hay que guardar. */
  altas: Alta[];
  /** Vacío al cargar; cada acción sobre las relaciones deja aquí lo que hay que guardar. */
  operaciones: Operacion[];
  /** Agentes, representantes, staff y vendedores, para editarlos o quitarlos de una agencia (H-020). */
  personas: PersonaContrato[];
  /** Los códigos vigentes de Configuración › Baselines (H-018). */
  catalogo: { lobs: string[]; estados: string[]; tiposComision: string[] };
}

export const ROLES_EQUIPO = ['cos', 'growth-specialist', 'lob-specialist'] as const;

/** Los campos que se pueden editar, en el orden del rastro. */
export const CAMPOS_EDITABLES = [
  'nombre', 'estado', 'npn', 'taxId', 'telefono', 'calle', 'ciudad', 'estadoUS', 'zip', 'inicio', 'portal', 'comunicaciones', 'reportes',
  'cobraAgenteId', 'companias', 'web', 'linkedin', 'redes', 'tipoComision', 'comisionPagadaA', 'bonoPagadoA', 'codigoPagoClaro', 'codigoPagoAtoz', 'legacy',
] as const;
type Campo = (typeof CAMPOS_EDITABLES)[number];

const NUEVA = 'nueva';

/* ------------------------------------------------------------------ lectura */

const texto = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};
const soloDigitos = (v: string | null | undefined) => {
  const t = texto(v);
  return t === null ? null : t.replace(/\D/g, '');
};

/** De la entrada del contrato a una agencia, validada. Devuelve el error en español del contrato. */
function leer(entrada: EntradaAccion, estado: EstadoAgencias, id: string, parentId: string | null): AgenciaContrato | { error: string } {
  const nombre = texto(entrada.nombre);
  if (!nombre) return { error: 'El nombre de la agencia es obligatorio.' };

  const companias = (entrada.companias ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!companias.length) return { error: 'Elige al menos una compañía interna (Claro o AtoZ).' };
  const desconocida = companias.find((c) => !COMPANIAS.some((x) => x.id === c));
  if (desconocida) return { error: `La compañía «${desconocida}» no existe.` };

  const estadoAgencia = texto(entrada.estado) ?? 'pending_contracting';
  if (!(ESTADOS as readonly string[]).includes(estadoAgencia)) return { error: `El estado «${estadoAgencia}» no está en el catálogo.` };

  const taxId = soloDigitos(entrada.taxId);
  if (taxId !== null && !/^\d{9}$/.test(taxId)) return { error: 'El EIN tiene que tener 9 dígitos.' };
  const telefono = soloDigitos(entrada.telefono);
  if (telefono !== null && !/^\d{10}$/.test(telefono)) return { error: 'El teléfono tiene que tener 10 dígitos.' };

  const inicio = texto(entrada.inicio);
  if (inicio !== null && !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return { error: 'La fecha de inicio no es válida.' };

  const comunicaciones = texto(entrada.comunicaciones);
  if (comunicaciones !== null && !(COMUNICACIONES as readonly string[]).includes(comunicaciones)) return { error: 'El destino de las comunicaciones no está en el catálogo.' };
  const reportes = texto(entrada.reportes);
  if (reportes !== null && !(REPORTES as readonly string[]).includes(reportes)) return { error: 'El destino de los reportes no está en el catálogo.' };

  const cobraAgenteId = texto(entrada.cobraAgenteId);
  if (cobraAgenteId !== null && !estado.agentes.some((a) => a.id === cobraAgenteId)) return { error: 'El agente que cobra no existe.' };

  const npn = texto(entrada.npn);
  if (npn !== null && estado.agencias.some((a) => a.id !== id && a.npn === npn)) return { error: `Ya hay otra agencia con el NPN ${npn}.` };

  const repetida = estado.agencias.find((a) => a.id !== id && a.parentId === parentId && a.nombre.toLowerCase() === nombre.toLowerCase());
  if (repetida) return { error: `Ya existe una agencia llamada «${nombre}» en ese mismo nivel de la jerarquía.` };

  const calle = texto(entrada.calle);
  const ciudad = texto(entrada.ciudad);
  const estadoUS = texto(entrada.estadoUS)?.toUpperCase() ?? null;
  if (estadoUS !== null && !/^[A-Z]{2}$/.test(estadoUS)) return { error: 'El estado de la dirección va con sus 2 letras, por ejemplo FL.' };
  // Solo un estado vigente en Baselines; uno que ya tenía y se desactivó después, lo conserva.
  const estadoPrevio = estado.agencias.find((a) => a.id === id)?.estadoUS ?? null;
  if (estadoUS !== null && estadoUS !== estadoPrevio && !estado.catalogo.estados.includes(estadoUS)) return { error: `El estado ${estadoUS} no está en Datos base.` };
  const zip = soloDigitos(entrada.zip);
  if (zip !== null && !/^\d{5}$/.test(zip)) return { error: 'El ZIP tiene que tener 5 dígitos.' };

  const portal = entrada.portal === 'true' ? true : entrada.portal === 'false' ? false : null;

  // En línea (H-022): enlaces http(s).
  const enlace = /^https?:\/\/\S+\.\S+$/i;
  const web = texto(entrada.web);
  if (web !== null && !enlace.test(web)) return { error: 'La página web tiene que ser un enlace que empiece por http:// o https://.' };
  const linkedin = texto(entrada.linkedin);
  if (linkedin !== null && !enlace.test(linkedin)) return { error: 'LinkedIn tiene que ser un enlace que empiece por http:// o https://.' };
  const redes = [...new Set((entrada.redes ?? '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean))];
  const redMala = redes.find((r) => !enlace.test(r));
  if (redMala) return { error: `«${redMala}» no es un enlace: cada red social va como enlace http:// o https://.` };
  if (redes.length > 10) return { error: 'Una agencia tiene hasta 10 redes sociales.' };

  // Comisiones y pagos (H-022).
  const previa = estado.agencias.find((a) => a.id === id);
  const tipoComision = texto(entrada.tipoComision);
  if (tipoComision !== null && tipoComision !== previa?.tipoComision && !estado.catalogo.tiposComision.includes(tipoComision)) {
    return { error: 'Ese tipo de comisión no está en Datos base.' };
  }
  // A quién se paga: solo lo define la Master Agency; su jerarquía lo hereda (H-023).
  const esMaster = parentId === null;
  const comisionPagadaA = esMaster ? texto(entrada.comisionPagadaA) : null;
  if (comisionPagadaA !== null && !(NIVELES_PAGO as readonly string[]).includes(comisionPagadaA)) return { error: 'La comisión se paga a la agencia, a la subagencia o al agente.' };
  const bonoPagadoA = esMaster ? texto(entrada.bonoPagadoA) : null;
  if (bonoPagadoA !== null && !(NIVELES_PAGO as readonly string[]).includes(bonoPagadoA)) return { error: 'El bono se paga a la agencia, a la subagencia o al agente.' };
  // Un payment code por compañía, y solo de las compañías a las que pertenece (Payment Account · E-051).
  const codigo = /^[A-Za-z0-9-]{1,30}$/;
  const codigoPagoClaro = texto(entrada.codigoPagoClaro);
  const codigoPagoAtoz = texto(entrada.codigoPagoAtoz);
  if (codigoPagoClaro !== null && !companias.includes('claro')) return { error: 'La agencia no pertenece a Claro: no lleva payment code de Claro.' };
  if (codigoPagoAtoz !== null && !companias.includes('atoz')) return { error: 'La agencia no pertenece a AtoZ: no lleva payment code de AtoZ.' };
  if ((codigoPagoClaro !== null && !codigo.test(codigoPagoClaro)) || (codigoPagoAtoz !== null && !codigo.test(codigoPagoAtoz))) {
    return { error: 'El payment code va con letras, números o guiones, hasta 30.' };
  }
  // Qué datos de pago lleva esta agencia según a quién le paga su jerarquía (H-023).
  const niveles = esMaster ? nivelesDe({ comisionPagadaA, bonoPagadoA }) : nivelesDe(masterDe(estado.agencias, parentId!));
  const pago = pagoDeAgencia(esMaster, niveles);
  if (!pago.lleva && (cobraAgenteId !== null || codigoPagoClaro !== null || codigoPagoAtoz !== null)) {
    return { error: 'En esta jerarquía la subagencia no cobra: no lleva contact payee ni payment code.' };
  }
  if (pago.obligatorio) {
    if (cobraAgenteId === null) return { error: 'Falta el contact payee: en esta jerarquía la agencia cobra.' };
    const falta = companias.find((c) => !(c === 'atoz' ? codigoPagoAtoz : codigoPagoClaro));
    if (falta) return { error: `Falta el payment code de ${falta === 'atoz' ? 'AtoZ' : 'Claro'}: en esta jerarquía la agencia cobra.` };
  }

  const legacy = entrada.legacy === 'true';
  if (!legacy && estado.legacy.some((n) => n.agenciaId === id)) {
    return { error: 'La agencia tiene negociaciones legacy vigentes: quítalas antes de marcarla como no legacy.' };
  }

  return {
    id, nombre, parentId, estado: estadoAgencia, npn, taxId, telefono, inicio, portal, comunicaciones, reportes, cobraAgenteId, companias, calle, ciudad, estadoUS, zip,
    web, linkedin, redes, tipoComision, comisionPagadaA, bonoPagadoA, codigoPagoClaro, codigoPagoAtoz, legacy,
  };
}

const comoTexto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
const igual = (a: unknown, b: unknown) => comoTexto(a) === comoTexto(b);

/* ------------------------------------------------------------ ayudas de altas */

function agenciaDe(estado: EstadoAgencias, id: string | null | undefined): AgenciaContrato | { error: string } {
  return estado.agencias.find((a) => a.id === id) ?? { error: 'Esa agencia no existe.' };
}

function leerContacto(entrada: EntradaAccion): { email: string | null; telefono: string | null } | { error: string } {
  const email = texto(entrada.email);
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'El correo no es válido.' };
  const telefono = soloDigitos(entrada.telefono);
  if (telefono !== null && !/^\d{10}$/.test(telefono)) return { error: 'El teléfono tiene que tener 10 dígitos.' };
  return { email, telefono };
}

function leerCompanias(entrada: EntradaAccion): { lista: string[] } | { error: string } {
  const lista = (entrada.companias ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (!lista.length) return { error: 'Elige al menos una compañía interna (Claro o AtoZ).' };
  const desconocida = lista.find((c) => !COMPANIAS.some((x) => x.id === c));
  if (desconocida) return { error: `La compañía «${desconocida}» no existe.` };
  return { lista };
}

/**
 * Los payment codes de un agente o vendedor sin licencia (H-023): solo de las compañías en que produce, y
 * obligatorios si alguna de sus agencias le paga al agente, o si es un agente independiente (H-024).
 */
function leerCodigosPersona(
  entrada: EntradaAccion,
  estado: EstadoAgencias,
  companias: string[],
  agencias: string[],
  esAgente = false,
): { codigoPagoClaro: string | null; codigoPagoAtoz: string | null } | { error: string } {
  const codigoPagoClaro = texto(entrada.codigoPagoClaro);
  const codigoPagoAtoz = texto(entrada.codigoPagoAtoz);
  if (codigoPagoClaro !== null && !companias.includes('claro')) return { error: 'No produce en Claro: no lleva payment code de Claro.' };
  if (codigoPagoAtoz !== null && !companias.includes('atoz')) return { error: 'No produce en AtoZ: no lleva payment code de AtoZ.' };
  const formato = /^[A-Za-z0-9-]{1,30}$/;
  if ((codigoPagoClaro !== null && !formato.test(codigoPagoClaro)) || (codigoPagoAtoz !== null && !formato.test(codigoPagoAtoz))) {
    return { error: 'El payment code va con letras, números o guiones, hasta 30.' };
  }
  if (exigeCodigoPersona(agencias, estado.agencias, { esAgente })) {
    const falta = companias.find((c) => !(c === 'atoz' ? codigoPagoAtoz : codigoPagoClaro));
    const porque = esAgente && agencias.length === 0 ? 'es agente independiente y cobra él mismo' : 'su agencia le paga al agente';
    if (falta) return { error: `Falta su payment code de ${falta === 'atoz' ? 'AtoZ' : 'Claro'}: ${porque}.` };
  }
  return { codigoPagoClaro, codigoPagoAtoz };
}

/** Una operación sobre las relaciones: queda en el estado para la persistencia, y en el rastro. */
function operacion(estado: EstadoAgencias, o: Operacion, entidad: string, id: string, de: string, a: string) {
  return { estado: { ...estado, operaciones: [...estado.operaciones, o] }, cambios: [{ entidad, id, de, a }] };
}

/** Una alta válida: queda en el estado para que la persistencia la escriba, y en el rastro. */
function alta(estado: EstadoAgencias, a: Alta, quien: string, agencia: string) {
  return {
    estado: { ...estado, altas: [...estado.altas, a] },
    cambios: [{ entidad: a.tipo.startsWith('agente') ? 'Agent · E-002' : 'Agency · E-003 (equipo)', id: quien, de: '—', a: `en ${agencia}`, motivo: a.tipo }],
    salida: `${quien} quedó en ${agencia}.`,
  };
}

/* ----------------------------------------------------------------- contrato */

export const CAPACIDAD_AGENCIAS = crearCapacidad<EstadoAgencias>({
  id: 'gestion-de-agencias',
  nombre: 'Gestión de agencias',
  journey: 'Sin journey en el arnés: capability del producto sobre el modelo de agencias del negocio (H-013, H-015)',
  entidades: ['Agency · E-003', 'Agent · E-002 (quién cobra)', 'Internal Company · E-005'],
  estados: {
    active: { etiqueta: 'Activa', responsable: 'Agency · E-003' },
    inactive: { etiqueta: 'Inactiva', responsable: 'Agency · E-003' },
    pending_contracting: { etiqueta: 'Contratación pendiente', responsable: 'Agency · E-003' },
    pending_documents: { etiqueta: 'Documentos pendientes', responsable: 'Agency · E-003' },
  },

  acciones: [
    {
      id: 'crear-agencia',
      nombre: 'Crear agencia',
      descripcion: 'Da de alta una agencia nueva, de primer nivel o debajo de otra agencia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: {
        nombre: 'string', parentId: 'id de agencia o vacío', estado: 'active | inactive | pending_contracting | pending_documents',
        npn: 'string', taxId: '9 dígitos', telefono: '10 dígitos', inicio: 'AAAA-MM-DD', portal: "'true' | 'false' | vacío",
        comunicaciones: 'parent_agency | agency', reportes: 'agency | agents_and_agency | agent', cobraAgenteId: 'id de agente',
        companias: 'claro,atoz', web: 'enlace http(s)', linkedin: 'enlace http(s)', redes: 'enlaces separados por coma',
        tipoComision: 'código de Datos base', comisionPagadaA: 'agencia | subagencia | agente (solo Master Agency)', bonoPagadoA: 'agencia | subagencia | agente (solo Master Agency)',
        codigoPagoClaro: 'solo si pertenece a Claro', codigoPagoAtoz: 'solo si pertenece a AtoZ', legacy: "'true' | 'false'",
      },
      consecuencia: {
        cambia: 'Se crea la agencia y entra a la jerarquía debajo de la agencia madre elegida (o como agencia de primer nivel).',
        noCambia: 'Ninguna otra agencia ni ningún agente. Los agentes se vinculan después.',
        alcance: 'Solo esta agencia nueva.',
        requiere: 'Nombre y al menos una compañía interna. EIN de 9 dígitos y teléfono de 10, si se dan.',
        registro: 'Quién la creó, cuándo y con qué datos.',
      },
      regla: 'H-015 · decisión de producto 2026-10-13 · modelo de agencias H-013',
      emite: ['agency.created'],
      aplicar(estado, entrada) {
        const parentId = texto(entrada.parentId);
        if (parentId !== null && !estado.agencias.some((a) => a.id === parentId)) return { error: 'La agencia madre no existe.' };
        const nueva = leer(entrada, estado, NUEVA, parentId);
        if ('error' in nueva) return nueva;
        return {
          estado: { ...estado, agencias: [...estado.agencias, nueva] },
          cambios: [{ entidad: 'Agency · E-003', id: nueva.nombre, de: '—', a: 'creada', motivo: parentId ? 'Debajo de otra agencia' : 'Agencia de primer nivel' }],
          salida: `Se creó la agencia ${nueva.nombre}.`,
        };
      },
    },

    {
      id: 'editar-agencia',
      nombre: 'Editar información de la agencia',
      descripcion: 'Cambia los datos de una agencia. La agencia madre no se cambia aquí: es un cambio de jerarquía.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', '…': 'los mismos campos que crear-agencia, salvo parentId' },
      consecuencia: {
        cambia: 'Los datos de la agencia que modifiques.',
        noCambia: 'Su lugar en la jerarquía, sus agentes, su equipo y su historia.',
        alcance: 'Solo esta agencia.',
        requiere: 'Nombre y al menos una compañía interna. EIN de 9 dígitos y teléfono de 10, si se dan.',
        registro: 'Cada campo que cambió, con su valor de antes y de después, quién y cuándo.',
      },
      regla: 'H-015 · decisión de producto 2026-10-13 · la jerarquía no se edita aquí (MN11)',
      emite: ['agency.updated'],
      aplicar(estado, entrada) {
        const antes = estado.agencias.find((a) => a.id === entrada.agenciaId);
        if (!antes) return { error: 'Esa agencia no existe.' };
        const despues = leer({ ...entrada, companias: entrada.companias ?? antes.companias.join(',') }, estado, antes.id, antes.parentId);
        if ('error' in despues) return despues;
        const cambios: Cambio[] = CAMPOS_EDITABLES.filter((c: Campo) => !igual(antes[c], despues[c])).map((c) => ({
          entidad: 'Agency · E-003',
          id: `${antes.id}.${c}`,
          de: comoTexto(antes[c]),
          a: comoTexto(despues[c]),
          motivo: antes.nombre,
        }));
        if (!cambios.length) return { error: 'No cambiaste ningún dato.' };
        return {
          estado: { ...estado, agencias: estado.agencias.map((a) => (a.id === antes.id ? despues : a)) },
          cambios,
          salida: `Se actualizó ${despues.nombre}.`,
        };
      },
    },
    /* ------------------------------------------------ altas dentro de una agencia */

    {
      id: 'agregar-agente',
      nombre: 'Agregar agente a la agencia',
      descripcion: 'Crea un agente nuevo, o vincula uno que ya existe, y lo deja en la agencia desde hoy. Un agente puede estar en varias agencias.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: {
        agenciaId: 'id de agencia', modo: "'nuevo' | 'existente'", agenteId: 'id de agente (existente)',
        nombre: 'string', npn: 'string', email: 'string', telefono: '10 dígitos', lobs: 'ACA,Medicare,…', ffm: "'true' | 'false'", companias: 'claro,atoz',
      },
      consecuencia: {
        cambia: 'El agente queda en la agencia desde hoy (y en el downline de las agencias de arriba).',
        noCambia: 'Sus otras agencias, si ya existía.',
        alcance: 'Solo este agente y esta agencia.',
        requiere: 'Agente nuevo: nombre, un NPN que no exista y una compañía interna.',
        registro: 'Quién lo agregó, a qué agencia y desde cuándo.',
      },
      regla: 'H-016 · decisión de producto 2026-10-13 · relación agente–agencia N a N y fechada (H-013)',
      emite: ['agency.agent.added'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        if (entrada.modo === 'existente') {
          const agente = estado.agentes.find((a) => a.id === entrada.agenteId);
          if (!agente) return { error: 'Elige el agente que quieres vincular.' };
          if (agente.agencias.includes(agencia.id)) return { error: `${agente.nombre} ya está en ${agencia.nombre}.` };
          return alta(estado, { tipo: 'agente-existente', agenciaId: agencia.id, agenteId: agente.id }, `${agente.nombre} · NPN ${agente.npn}`, agencia.nombre);
        }
        const nombre = texto(entrada.nombre);
        if (!nombre) return { error: 'El nombre del agente es obligatorio.' };
        const npn = texto(entrada.npn);
        if (!npn) return { error: 'El NPN es obligatorio: todo agente está licenciado.' };
        const yaExiste = estado.agentes.find((a) => a.npn === npn);
        if (yaExiste) return { error: `Ya existe un agente con el NPN ${npn}: ${yaExiste.nombre}. Vincúlalo como agente que ya existe.` };
        const contacto = leerContacto(entrada);
        if ('error' in contacto) return contacto;
        const companias = leerCompanias(entrada);
        if ('error' in companias) return companias;
        const lobs = (entrada.lobs ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        const lobDesconocida = lobs.find((l) => !estado.catalogo.lobs.includes(l));
        if (lobDesconocida) return { error: `La línea de negocio «${lobDesconocida}» no está en Datos base.` };
        const codigos = leerCodigosPersona(entrada, estado, companias.lista, [agencia.id], true);
        if ('error' in codigos) return codigos;
        return alta(
          estado,
          { tipo: 'agente-nuevo', agenciaId: agencia.id, nombre, npn, ...contacto, lobs, ffm: entrada.ffm === 'true', companias: companias.lista, ...codigos },
          `${nombre} · NPN ${npn}`,
          agencia.nombre,
        );
      },
    },

    {
      id: 'agregar-equipo',
      nombre: 'Agregar al equipo de la agencia',
      descripcion: 'Agrega un representante o alguien del staff a la agencia, desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: {
        agenciaId: 'id de agencia', papel: "'representante' | 'staff'", nombre: 'string',
        agenteId: 'id de agente (representante que también es agente)', puesto: 'string (staff)', email: 'string', telefono: '10 dígitos',
      },
      consecuencia: {
        cambia: 'La persona queda en el equipo de la agencia desde hoy.',
        noCambia: 'El resto del equipo y los agentes.',
        alcance: 'Solo esta persona y esta agencia.',
        requiere: 'Nombre (o el agente, si el representante también es agente).',
        registro: 'Quién la agregó, con qué papel y desde cuándo.',
      },
      regla: 'H-016 · decisión de producto 2026-10-13 · representantes y staff viven dentro de la agencia',
      emite: ['agency.team.added'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const contacto = leerContacto(entrada);
        if ('error' in contacto) return contacto;
        if (entrada.papel === 'representante') {
          const agenteId = texto(entrada.agenteId);
          const agente = agenteId ? estado.agentes.find((a) => a.id === agenteId) : undefined;
          if (agenteId && !agente) return { error: 'Ese agente no existe.' };
          const nombre = texto(entrada.nombre) ?? agente?.nombre ?? null;
          if (!nombre) return { error: 'Escribe el nombre del representante o elige el agente que lo es.' };
          return alta(estado, { tipo: 'representante', agenciaId: agencia.id, nombre, agenteId: agente?.id ?? null, ...contacto }, `${nombre} · representante`, agencia.nombre);
        }
        if (entrada.papel === 'staff') {
          const nombre = texto(entrada.nombre);
          if (!nombre) return { error: 'El nombre es obligatorio.' };
          return alta(estado, { tipo: 'staff', agenciaId: agencia.id, nombre, puesto: texto(entrada.puesto), ...contacto }, `${nombre} · staff`, agencia.nombre);
        }
        return { error: 'Elige el papel: representante o staff.' };
      },
    },

    {
      id: 'agregar-vendedor',
      nombre: 'Agregar vendedor de productos de descuento',
      descripcion: 'Agrega un vendedor de productos de descuento a la agencia, desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', nombre: 'string', agenteId: 'id de agente (si también es agente)', email: 'string', telefono: '10 dígitos', companias: 'claro,atoz' },
      consecuencia: {
        cambia: 'El vendedor queda en la agencia desde hoy.',
        noCambia: 'Los agentes y el equipo de la agencia.',
        alcance: 'Solo este vendedor y esta agencia.',
        requiere: 'Nombre (o el agente, si también es agente) y una compañía interna.',
        registro: 'Quién lo agregó y desde cuándo.',
      },
      regla: 'H-016 · decisión de producto 2026-10-13',
      emite: ['agency.discount-seller.added'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const agenteId = texto(entrada.agenteId);
        const agente = agenteId ? estado.agentes.find((a) => a.id === agenteId) : undefined;
        if (agenteId && !agente) return { error: 'Ese agente no existe.' };
        const nombre = texto(entrada.nombre) ?? agente?.nombre ?? null;
        if (!nombre) return { error: 'Escribe el nombre del vendedor o elige el agente que lo es.' };
        const contacto = leerContacto(entrada);
        if ('error' in contacto) return contacto;
        const companias = leerCompanias(entrada);
        if ('error' in companias) return companias;
        // Solo el vendedor sin licencia lleva payment code propio; el que es agente usa el suyo (H-023).
        const codigos = agente ? { codigoPagoClaro: null, codigoPagoAtoz: null } : leerCodigosPersona(entrada, estado, companias.lista, [agencia.id]);
        if ('error' in codigos) return codigos;
        return alta(
          estado,
          { tipo: 'vendedor', agenciaId: agencia.id, nombre, agenteId: agente?.id ?? null, ...contacto, companias: companias.lista, ...codigos },
          `${nombre} · vendedor`,
          agencia.nombre,
        );
      },
    },
    /* ------------------------------------------- los miembros de la agencia (H-020): editar y quitar */

    {
      id: 'editar-persona',
      nombre: 'Editar miembro de la agencia',
      descripcion: 'Cambia los datos de un agente, representante, staff o vendedor.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: {
        tipo: 'agente | representante | staff | vendedor', personaId: 'id', nombre: 'string', email: 'string', telefono: '10 dígitos',
        npn: 'agente', lobs: 'agente: ACA,Medicare,…', ffm: "agente: 'true' | 'false'", companias: 'agente y vendedor: claro,atoz',
        puesto: 'staff', agenteId: 'representante y vendedor: id de agente o vacío',
      },
      consecuencia: {
        cambia: 'Los datos de la persona en todas las agencias donde está.',
        noCambia: 'Sus agencias ni desde cuándo está en cada una.',
        alcance: 'Solo esta persona.',
        requiere: 'Nombre. Un agente, su NPN (que no se repite) y una compañía interna.',
        registro: 'Quién la editó, cuándo y cada dato que cambió.',
      },
      regla: 'H-020 · decisión de producto 2026-10-13',
      emite: ['agency.member.edited'],
      aplicar(estado, entrada) {
        const p = estado.personas.find((x) => x.tipo === entrada.tipo && x.id === entrada.personaId);
        if (!p) return { error: 'Esa persona no existe.' };
        const contacto = leerContacto(entrada);
        if ('error' in contacto) return contacto;
        const nueva: PersonaContrato = { ...p, ...contacto };

        if (p.tipo === 'agente') {
          const nombre = texto(entrada.nombre);
          if (!nombre) return { error: 'El nombre es obligatorio.' };
          const npn = texto(entrada.npn);
          if (!npn) return { error: 'El NPN es obligatorio: todo agente está licenciado.' };
          const otro = estado.agentes.find((a) => a.id !== p.id && a.npn === npn);
          if (otro) return { error: `El NPN ${npn} ya es de ${otro.nombre}.` };
          const lobs = (entrada.lobs ?? '').split(',').map((x) => x.trim()).filter(Boolean);
          // Una LOB que ya tenía y luego se desactivó en Datos base la conserva.
          const lobDesconocida = lobs.find((l) => !estado.catalogo.lobs.includes(l) && !p.lobs.includes(l));
          if (lobDesconocida) return { error: `La línea de negocio «${lobDesconocida}» no está en Datos base.` };
          const companias = leerCompanias(entrada);
          if ('error' in companias) return companias;
          const codigos = leerCodigosPersona(entrada, estado, companias.lista, p.agencias, true);
          if ('error' in codigos) return codigos;
          Object.assign(nueva, { nombre, npn, lobs, ffm: entrada.ffm === 'true', companias: companias.lista, ...codigos });
        } else if (p.tipo === 'staff') {
          const nombre = texto(entrada.nombre);
          if (!nombre) return { error: 'El nombre es obligatorio.' };
          Object.assign(nueva, { nombre, puesto: texto(entrada.puesto) });
        } else {
          const agenteId = texto(entrada.agenteId);
          const agente = agenteId ? estado.agentes.find((a) => a.id === agenteId) : undefined;
          if (agenteId && !agente) return { error: 'Ese agente no existe.' };
          const nombre = texto(entrada.nombre) ?? agente?.nombre ?? null;
          if (!nombre) return { error: 'Escribe el nombre o elige el agente que lo es.' };
          Object.assign(nueva, { nombre, agenteId: agente?.id ?? null });
          if (p.tipo === 'vendedor') {
            const companias = leerCompanias(entrada);
            if ('error' in companias) return companias;
            nueva.companias = companias.lista;
            const codigos = agente ? { codigoPagoClaro: null, codigoPagoAtoz: null } : leerCodigosPersona(entrada, estado, companias.lista, p.agencias);
            if ('error' in codigos) return codigos;
            Object.assign(nueva, codigos);
          }
        }

        const campos = ['nombre', 'email', 'telefono', 'npn', 'lobs', 'ffm', 'companias', 'puesto', 'agenteId', 'codigoPagoClaro', 'codigoPagoAtoz'] as const;
        const cambios = campos
          .filter((c) => !igual(p[c], nueva[c]))
          .map((c) => ({ entidad: p.tipo === 'agente' ? 'Agent · E-002' : 'Agency · E-003 (miembro)', id: `${p.nombre} · ${c}`, de: comoTexto(p[c]), a: comoTexto(nueva[c]) }));
        if (!cambios.length) return { error: 'No cambiaste nada.' };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, { tipo: 'persona-edicion', persona: nueva }] },
          cambios,
          salida: `Se actualizó ${nueva.nombre}.`,
        };
      },
    },
    {
      id: 'quitar-de-agencia',
      nombre: 'Quitar de la agencia',
      descripcion: 'La persona deja de estar en esta agencia desde hoy. Sigue en el Directorio.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { tipo: 'agente | representante | staff | vendedor', personaId: 'id', agenciaId: 'id de agencia' },
      consecuencia: {
        cambia: 'Su relación con esta agencia termina hoy.',
        noCambia: 'La persona sigue en el Directorio y en sus otras agencias. Su historia: se cierra, no se borra.',
        alcance: 'Solo esta persona en esta agencia.',
        requiere: 'Que no sea el agente que cobra por la agencia.',
        registro: 'Quién la quitó y cuándo.',
      },
      regla: 'H-020 · decisión de producto 2026-10-13',
      emite: ['agency.member.removed'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const p = estado.personas.find((x) => x.tipo === entrada.tipo && x.id === entrada.personaId);
        if (!p || !p.agencias.includes(agencia.id)) return { error: 'Esa persona ya no está en esta agencia.' };
        if (p.tipo === 'agente' && agencia.cobraAgenteId === p.id) {
          return { error: `${p.nombre} es quien cobra por ${agencia.nombre}. Cambia quién cobra antes de quitarlo.` };
        }
        return {
          ...operacion(estado, { tipo: 'membresia-baja', persona: p.tipo, personaId: p.id, agenciaId: agencia.id }, p.tipo === 'agente' ? 'Agent · E-002' : 'Agency · E-003 (miembro)', p.nombre, `en ${agencia.nombre}`, 'terminada'),
          salida: `${p.nombre} ya no está en ${agencia.nombre}.`,
        };
      },
    },

    /* --------------------------------- relaciones de la agencia (H-017): equipo, LOB, compañías, labels */

    {
      id: 'asignar-equipo-claro',
      nombre: 'Asignar al equipo de trabajo',
      descripcion: 'Asigna a una persona de Claro a la agencia con su rol (COS, Growth Specialist…), desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', empleadoId: 'id de empleado', rol: ROLES_EQUIPO.join(' | ') },
      consecuencia: { cambia: 'La persona queda asignada a la agencia con ese rol desde hoy.', noCambia: 'Sus otras agencias y el resto del equipo.', alcance: 'Solo esta asignación.', requiere: 'Una persona de Claro y un rol del catálogo.', registro: 'Quién la asignó, con qué rol y desde cuándo.' },
      regla: 'H-017 · decisión de producto 2026-10-13 · Work Team',
      emite: ['agency.work-team.assigned'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const empleado = estado.empleados.find((e) => e.id === entrada.empleadoId);
        if (!empleado) return { error: 'Elige a la persona de Claro.' };
        const rol = texto(entrada.rol);
        if (!rol || !(ROLES_EQUIPO as readonly string[]).includes(rol)) return { error: 'Elige un rol del catálogo.' };
        if (estado.equipoClaro.some((x) => x.agenciaId === agencia.id && x.empleadoId === empleado.id && x.rol === rol)) return { error: `${empleado.nombre} ya tiene ese rol en ${agencia.nombre}.` };
        return operacion(estado, { tipo: 'equipo-claro-alta', agenciaId: agencia.id, empleadoId: empleado.id, rol }, 'Equipo de trabajo', `${empleado.nombre} · ${rol}`, '—', `en ${agencia.nombre}`);
      },
    },
    {
      id: 'quitar-equipo-claro',
      nombre: 'Quitar del equipo de trabajo',
      descripcion: 'Termina la asignación de una persona de Claro a la agencia. Queda en la historia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { asignacionId: 'id de la asignación' },
      consecuencia: { cambia: 'La asignación termina hoy.', noCambia: 'Su historia: se cierra, no se borra.', alcance: 'Solo esta asignación.', registro: 'Quién la quitó y cuándo.' },
      regla: 'H-017 · decisión de producto 2026-10-13 · Work Team',
      emite: ['agency.work-team.unassigned'],
      aplicar(estado, entrada) {
        const x = estado.equipoClaro.find((e) => e.id === entrada.asignacionId);
        if (!x) return { error: 'Esa asignación ya no está vigente.' };
        const nombre = estado.empleados.find((e) => e.id === x.empleadoId)?.nombre ?? x.empleadoId;
        return operacion(estado, { tipo: 'equipo-claro-baja', id: x.id }, 'Equipo de trabajo', `${nombre} · ${x.rol}`, 'vigente', 'terminada');
      },
    },
    {
      id: 'relacionar-lob',
      nombre: 'Relacionar líneas de negocio',
      descripcion: 'Agrega una o varias líneas de negocio a la agencia, desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', lobs: 'códigos de LOB vigentes en Datos base, separados por coma' },
      consecuencia: { cambia: 'La agencia trabaja esas líneas de negocio desde hoy.', noCambia: 'Sus otras líneas de negocio.', alcance: 'Solo esta agencia.', registro: 'Quién la relacionó y cuándo.' },
      regla: 'H-017 · H-018 · decisión de producto 2026-10-13 · Line of Business (E-011)',
      emite: ['agency.lob.related'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const lobs = [...new Set((entrada.lobs ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
        if (!lobs.length) return { error: 'Elige al menos una línea de negocio.' };
        const desconocida = lobs.find((l) => !estado.catalogo.lobs.includes(l));
        if (desconocida) return { error: `La línea de negocio «${desconocida}» no está vigente en Datos base.` };
        const repetida = lobs.find((l) => estado.lobs.some((x) => x.agenciaId === agencia.id && x.lob === l));
        if (repetida) return { error: `${agencia.nombre} ya tiene ${repetida}.` };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, ...lobs.map((lob): Operacion => ({ tipo: 'lob-alta', agenciaId: agencia.id, lob }))] },
          cambios: lobs.map((lob) => ({ entidad: 'Line of Business · E-011', id: lob, de: '—', a: `en ${agencia.nombre}` })),
        };
      },
    },
    {
      id: 'quitar-lob',
      nombre: 'Quitar línea de negocio',
      descripcion: 'Termina una línea de negocio de la agencia. Queda en la historia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { relacionId: 'id de la relación' },
      consecuencia: { cambia: 'La agencia deja de tener esa línea de negocio desde hoy.', noCambia: 'Su historia: se cierra, no se borra.', alcance: 'Solo esta línea de negocio.', registro: 'Quién la quitó y cuándo.' },
      regla: 'H-017 · decisión de producto 2026-10-13',
      emite: ['agency.lob.removed'],
      aplicar(estado, entrada) {
        const x = estado.lobs.find((l) => l.id === entrada.relacionId);
        if (!x) return { error: 'Esa línea de negocio ya no está vigente.' };
        return operacion(estado, { tipo: 'lob-baja', id: x.id }, 'Line of Business · E-011', x.lob, 'vigente', 'terminada');
      },
    },
    {
      id: 'relacionar-compania',
      nombre: 'Relacionar compañía interna',
      descripcion: 'Agrega una compañía interna (entidad legal: Claro o AtoZ) a la agencia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', compania: 'claro | atoz' },
      consecuencia: { cambia: 'La agencia queda afiliada también a esa compañía.', noCambia: 'Su afiliación a la otra compañía.', alcance: 'Solo esta agencia.', registro: 'Quién la relacionó y cuándo.' },
      regla: 'H-017 · Internal Company (E-005) · RUL-038',
      emite: ['agency.company.related'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const compania = texto(entrada.compania);
        if (!compania || !COMPANIAS.some((c) => c.id === compania)) return { error: 'Elige una compañía interna.' };
        if (agencia.companias.includes(compania)) return { error: `${agencia.nombre} ya está afiliada a esa compañía.` };
        const nueva = { ...agencia, companias: [...agencia.companias, compania] };
        return {
          estado: { ...estado, agencias: estado.agencias.map((a) => (a.id === agencia.id ? nueva : a)) },
          cambios: [{ entidad: 'Internal Company · E-005', id: `${agencia.id}.companias`, de: agencia.companias.join(', '), a: nueva.companias.join(', '), motivo: agencia.nombre }],
        };
      },
    },
    {
      id: 'quitar-compania',
      nombre: 'Quitar compañía interna',
      descripcion: 'Quita una compañía interna de la agencia. Siempre queda al menos una.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', compania: 'claro | atoz' },
      consecuencia: { cambia: 'La agencia deja de estar afiliada a esa compañía.', noCambia: 'Su afiliación a la otra compañía.', alcance: 'Solo esta agencia.', requiere: 'Que le quede al menos una compañía.', registro: 'Quién la quitó y cuándo.' },
      regla: 'H-017 · Internal Company (E-005) · RUL-038',
      emite: ['agency.company.removed'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const compania = texto(entrada.compania);
        if (!compania || !agencia.companias.includes(compania)) return { error: 'La agencia no está afiliada a esa compañía.' };
        if (agencia.companias.length === 1) return { error: 'Una agencia tiene que tener al menos una compañía interna.' };
        if (estado.legacy.some((n) => n.agenciaId === agencia.id && n.compania === compania)) {
          return { error: 'La agencia tiene negociaciones legacy de esa compañía: quítalas antes.' };
        }
        // Su payment code de esa compañía se va con ella (H-022): queda en el rastro.
        const nueva = {
          ...agencia,
          companias: agencia.companias.filter((c) => c !== compania),
          ...(compania === 'claro' ? { codigoPagoClaro: null } : { codigoPagoAtoz: null }),
        };
        return {
          estado: { ...estado, agencias: estado.agencias.map((a) => (a.id === agencia.id ? nueva : a)) },
          cambios: [{ entidad: 'Internal Company · E-005', id: `${agencia.id}.companias`, de: agencia.companias.join(', '), a: nueva.companias.join(', '), motivo: agencia.nombre }],
        };
      },
    },
    /* -------------------------------------------- negociaciones especiales Legacy (H-022) */
    {
      id: 'agregar-negociacion-legacy',
      nombre: 'Agregar negociación especial Legacy',
      descripcion: 'Registra una negociación especial de comisión tipo Legacy en una agencia legacy, vigente desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', compania: 'claro | atoz', lob: 'código de LOB vigente', tasaAgente: '0–100 (%)', cargoAdministrativo: 'USD, opcional', detalle: 'string' },
      consecuencia: {
        cambia: 'La agencia queda con esa negociación especial vigente desde hoy.',
        noCambia: 'Sus otras negociaciones y la tabla de comisiones general.',
        alcance: 'Solo esta agencia.',
        requiere: 'Que la agencia sea legacy y pertenezca a esa compañía; LOB vigente; tasa entre 0 y 100; detalle.',
        registro: 'Quién la registró y cuándo, con sus valores.',
      },
      regla: 'H-022 · decisión de producto 2026-10-15 · forma de las negociaciones especiales del prototipo PB-002 v2.6 (TIPOS_NEGOCIACION)',
      emite: ['agency.legacy-negotiation.added'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        if (!agencia.legacy) return { error: 'La agencia no es legacy: márcala como legacy antes.' };
        const compania = texto(entrada.compania);
        if (compania !== 'claro' && compania !== 'atoz') return { error: 'Elige la compañía.' };
        if (!agencia.companias.includes(compania)) return { error: 'La agencia no pertenece a esa compañía.' };
        const lob = texto(entrada.lob);
        if (!lob || !estado.catalogo.lobs.includes(lob)) return { error: 'Elige una línea de negocio vigente en Datos base.' };
        const tasa = Number(entrada.tasaAgente);
        if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) return { error: 'La tasa del agente va entre 0 y 100.' };
        const cargoTexto = texto(entrada.cargoAdministrativo);
        const cargo = cargoTexto === null ? null : Number(cargoTexto);
        if (cargo !== null && (!Number.isFinite(cargo) || cargo < 0)) return { error: 'El cargo administrativo no puede ser negativo.' };
        const detalle = texto(entrada.detalle);
        if (!detalle) return { error: 'Describe la negociación.' };
        return {
          ...operacion(
            estado,
            { tipo: 'legacy-alta', agenciaId: agencia.id, compania, lob, tasaAgente: tasa, cargoAdministrativo: cargo, detalle },
            'Negociación especial · Legacy',
            `${compania === 'atoz' ? 'AtoZ' : 'Claro'} · ${lob}`,
            '—',
            `${tasa}% agente${cargo !== null ? ` · $${cargo} cargo` : ''}`,
          ),
          salida: `Se registró la negociación legacy de ${lob} en ${agencia.nombre}.`,
        };
      },
    },
    {
      id: 'quitar-negociacion-legacy',
      nombre: 'Quitar negociación especial Legacy',
      descripcion: 'Termina hoy una negociación especial Legacy. Queda en la historia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { negociacionId: 'id' },
      consecuencia: { cambia: 'La negociación deja de estar vigente desde hoy.', noCambia: 'Su historia: se cierra, no se borra.', alcance: 'Solo esta negociación.', registro: 'Quién la quitó y cuándo.' },
      regla: 'H-022 · decisión de producto 2026-10-15',
      emite: ['agency.legacy-negotiation.removed'],
      aplicar(estado, entrada) {
        const n = estado.legacy.find((x) => x.id === entrada.negociacionId);
        if (!n) return { error: 'Esa negociación ya no está vigente.' };
        return operacion(estado, { tipo: 'legacy-baja', id: n.id }, 'Negociación especial · Legacy', n.lob, 'vigente', 'terminada');
      },
    },
    {
      id: 'agregar-etiqueta',
      nombre: 'Agregar etiqueta',
      descripcion: 'Agrega una etiqueta libre a la agencia. Avisa, no bloquea.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { agenciaId: 'id de agencia', texto: 'string, hasta 40 caracteres' },
      consecuencia: { cambia: 'La agencia muestra la etiqueta desde hoy.', noCambia: 'Nada de lo que la agencia puede hacer: una etiqueta no bloquea.', alcance: 'Solo esta agencia.', registro: 'Quién lo agregó y cuándo.' },
      regla: 'H-017 · decisión de producto 2026-10-13',
      emite: ['agency.label.added'],
      aplicar(estado, entrada) {
        const agencia = agenciaDe(estado, entrada.agenciaId);
        if ('error' in agencia) return agencia;
        const t = texto(entrada.texto);
        if (!t) return { error: 'Escribe la etiqueta.' };
        if (t.length > 40) return { error: 'La etiqueta tiene que tener 40 caracteres o menos.' };
        if (estado.etiquetas.some((x) => x.agenciaId === agencia.id && x.texto.toLowerCase() === t.toLowerCase())) return { error: `${agencia.nombre} ya tiene esa etiqueta.` };
        return operacion(estado, { tipo: 'etiqueta-alta', agenciaId: agencia.id, texto: t }, 'Etiqueta', t, '—', `en ${agencia.nombre}`);
      },
    },
    {
      id: 'quitar-etiqueta',
      nombre: 'Quitar etiqueta',
      descripcion: 'Quita una etiqueta de la agencia. Queda en la historia.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { etiquetaId: 'id de la etiqueta' },
      consecuencia: { cambia: 'La agencia deja de mostrar la etiqueta.', noCambia: 'Su historia: se cierra, no se borra.', alcance: 'Solo esta etiqueta.', registro: 'Quién lo quitó y cuándo.' },
      regla: 'H-017 · decisión de producto 2026-10-13',
      emite: ['agency.label.removed'],
      aplicar(estado, entrada) {
        const x = estado.etiquetas.find((e) => e.id === entrada.etiquetaId);
        if (!x) return { error: 'Esa etiqueta ya no está vigente.' };
        return operacion(estado, { tipo: 'etiqueta-baja', id: x.id }, 'Etiqueta', x.texto, 'vigente', 'quitada');
      },
    },
  ],
});

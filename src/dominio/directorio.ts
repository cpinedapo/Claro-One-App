/**
 * El Directorio en la forma que consumen las pantallas. Refleja el modelo de agencias del negocio
 * (H-013): `agencies` + `agency_tree` + una relación fechada N a N por tipo de persona.
 *
 * - La jerarquía (nivel, sub-agencias, downline) se lee de `agency_tree`, la tabla de clausura, no se
 *   recorre a mano.
 * - Una relación vigente es la que no tiene `hasta`. Sin relaciones vigentes, la persona es
 *   independiente. Si es independiente en un contrato puntual lo dirá Contracting (H-013).
 *
 * Puro: sin React, sin antd, sin base de datos. Los ids van como texto: en la base son bigint.
 */
import type { BaselinesVigentes } from './baselines';
import type { DocumentoPagoRegistro } from './pagos';
import type { Agencia } from '@arc2-0/claro-one-kit/dominio';

export type EstadoAgencia = 'active' | 'inactive' | 'pending_contracting' | 'pending_documents';
export type AlcanceComunicaciones = 'parent_agency' | 'agency';
export type AlcanceReportes = 'agency' | 'agents_and_agency' | 'agent';

/** Cómo se pinta cada estado: los siete estados del kit (`ESTADOS`), mismo color en toda la app. */
export const ESTADO_NEGOCIO_DE_AGENCIA: Record<EstadoAgencia, 'ok' | 'neutral' | 'pending' | 'waiting'> = {
  active: 'ok',
  inactive: 'neutral',
  pending_contracting: 'pending',
  pending_documents: 'waiting',
};

/** La agencia del kit (`id`, `nombre`, `parentId`, `companias`) más los campos de `agencies`. */
export interface AgenciaDirectorio extends Agencia {
  npn: string | null;
  taxId: string | null;
  estado: EstadoAgencia;
  telefono: string | null;
  inicio: string | null;
  agentesUsanPortal: boolean | null;
  alcanceComunicaciones: AlcanceComunicaciones | null;
  alcanceReportes: AlcanceReportes | null;
  /** El agente que cobra por la agencia (`payee_agent_id`). */
  cobraAgenteId: string | null;
  calle: string | null;
  ciudad: string | null;
  /** Estado de EE.UU., 2 letras. */
  estadoUS: string | null;
  zip: string | null;
  /** Líneas de negocio vigentes (`agency_lobs`). */
  lobs: { id: string; lob: string }[];
  /** Labels vigentes (`agency_labels`). */
  etiquetas: { id: string; texto: string }[];
  /* En línea (H-022) */
  web: string | null;
  linkedin: string | null;
  redes: string[];
  /* Comisiones y pagos (H-022) */
  /** Código de un tipo de comisión de Datos base. */
  tipoComision: string | null;
  comisionPagadaA: PagadoA | null;
  bonoPagadoA: PagadoA | null;
  /** Payment code por compañía (Payment Account · E-051). */
  codigoPago: { claro: string | null; atoz: string | null };
  legacy: boolean;
  /** Negociaciones especiales tipo Legacy vigentes. */
  negociacionesLegacy: NegociacionLegacy[];
  demo: boolean;
}

/** A quién se paga la comisión o el bono (H-023). */
export type PagadoA = 'agencia' | 'subagencia' | 'agente';

/** Una negociación especial de comisión tipo Legacy (H-022). */
export interface NegociacionLegacy {
  id: string;
  compania: 'claro' | 'atoz';
  lob: string;
  /** % de la comisión para el agente. */
  tasaAgente: number;
  /** USD. */
  cargoAdministrativo: number | null;
  detalle: string;
  desde: string;
}

export type RolEquipoClaro = 'cos' | 'growth-specialist' | 'lob-specialist';

/** Una persona de Claro asignada a una agencia (`agency_work_team`, vigente). */
export interface MiembroEquipoClaro {
  id: string;
  agenciaId: string;
  empleadoId: string;
  nombre: string;
  puesto: string;
  rol: RolEquipoClaro;
  desde: string;
}

/** Una fila de `agency_tree`. */
export interface RelacionArbol {
  ancestroId: string;
  descendienteId: string;
  profundidad: number;
}

/** Una fila de cualquiera de las tablas de relación persona ↔ agencia. */
export interface Membresia {
  id: string;
  agenciaId: string;
  desde: string;
  hasta: string | null;
}

interface PersonaBase {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  demo: boolean;
}

export interface AgenteDirectorio extends PersonaBase {
  npn: string;
  /** Payment code por compañía en que produce (H-023). */
  codigoPago: { claro: string | null; atoz: string | null };
  companias: string[];
  lobs: string[];
  certificacionFFM: boolean;
  nota: string | null;
  agencias: Membresia[];
}

export interface RepresentanteDirectorio extends PersonaBase {
  /** Si además es agente: de ahí sale su NPN. */
  agenteId: string | null;
  agencias: Membresia[];
}

export interface StaffDirectorio extends PersonaBase {
  puesto: string | null;
  agencias: Membresia[];
}

export interface VendedorDescuentosDirectorio extends PersonaBase {
  agenteId: string | null;
  /** Payment code propio: solo el vendedor sin licencia (H-023). */
  codigoPago: { claro: string | null; atoz: string | null };
  companias: string[];
  agencias: Membresia[];
}

export interface BenefitCoordinatorDirectorio extends PersonaBase {
  centroMedico: string | null;
  companias: string[];
}

export interface DirectorioCompleto {
  agencias: AgenciaDirectorio[];
  /** El equipo de trabajo de Claro de cada agencia. */
  equipoClaro: MiembroEquipoClaro[];
  /** Las personas de Claro que se pueden asignar. */
  empleados: { id: string; nombre: string; puesto: string }[];
  arbol: RelacionArbol[];
  agentes: AgenteDirectorio[];
  representantes: RepresentanteDirectorio[];
  staff: StaffDirectorio[];
  vendedores: VendedorDescuentosDirectorio[];
  benefitCoordinators: BenefitCoordinatorDirectorio[];
  /** Lo vigente en Configuración › Baselines: de aquí salen las opciones de los formularios (H-018). */
  baselines: BaselinesVigentes;
  /** W9, Direct Deposit y Voided Check de quien cobra: se aprueban en el Onboarding (H-024). */
  documentosPago: DocumentoPagoRegistro[];
}

/* --------------------------------------------------------------- relaciones */

export const vigentes = (ms: Membresia[]) => ms.filter((m) => m.hasta === null);

export const esIndependiente = (x: { agencias: Membresia[] }) => vigentes(x.agencias).length === 0;

export const estaEnAgencia = (x: { agencias: Membresia[] }, agenciaId: string) => vigentes(x.agencias).some((m) => m.agenciaId === agenciaId);

export const membresiaEn = (x: { agencias: Membresia[] }, agenciaId: string) => vigentes(x.agencias).find((m) => m.agenciaId === agenciaId);

/* ----------------------------------------------------------------- jerarquía */

/** 0 = Master Agency, 1 = Agency, 2 = Sub Agency… La profundidad desde su raíz en `agency_tree`. */
export const nivelEnArbol = (arbol: RelacionArbol[], agenciaId: string) =>
  Math.max(0, ...arbol.filter((r) => r.descendienteId === agenciaId).map((r) => r.profundidad));

/** La agencia y todas las de debajo, a cualquier profundidad. */
export const agenciaYDescendientes = (arbol: RelacionArbol[], agenciaId: string) =>
  new Set(arbol.filter((r) => r.ancestroId === agenciaId).map((r) => r.descendienteId));

/** Los agentes con relación vigente en la agencia o en cualquiera de sus sub-agencias. */
export function downline(dir: DirectorioCompleto, agenciaId: string, companiaId?: string | null): AgenteDirectorio[] {
  const ids = agenciaYDescendientes(dir.arbol, agenciaId);
  return dir.agentes.filter(
    (a) => vigentes(a.agencias).some((m) => ids.has(m.agenciaId)) && (!companiaId || a.companias.includes(companiaId)),
  );
}

/* -------------------------------------------------------------- otros papeles */

export type OtroPapel = 'representante' | 'vendedor-descuentos';

/** Lo que un agente también es: representante o vendedor de descuentos enlazado a él. */
export function otrosPapelesDeAgente(dir: DirectorioCompleto, agenteId: string): OtroPapel[] {
  return [
    ...(dir.representantes.some((r) => r.agenteId === agenteId) ? ['representante' as const] : []),
    ...(dir.vendedores.some((v) => v.agenteId === agenteId) ? ['vendedor-descuentos' as const] : []),
  ];
}

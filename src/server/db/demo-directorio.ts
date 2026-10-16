/**
 * Directorio de DEMOSTRACIÓN en el modelo de agencias (H-013). Todo inventado sobre las reglas reales:
 * nombres, NPN, EIN, teléfonos y fechas no pertenecen a nadie.
 *
 * Las agencias y los agentes salen de `@arc2-0/claro-one-kit/fixtures`; los campos que el kit no trae
 * (estado, NPN, EIN, alcances, quién cobra) y el resto de las personas se inventan acá. Las claves
 * (`'agc-sol'`, `'18447106'`) solo sirven para enlazar filas dentro de este archivo: en la base los
 * ids son bigint y los asigna Postgres.
 */
import { AGENCIAS, AGENTES } from '@arc2-0/claro-one-kit/fixtures';

type Estado = 'active' | 'inactive' | 'pending_contracting' | 'pending_documents';

export interface AgenciaDemo {
  clave: string;
  nombre: string;
  padre: string | null;
  companias: string[];
  npn: string | null;
  taxId: string;
  estado: Estado;
  telefono: string;
  inicio: string;
  portal: boolean | null;
  comunicaciones: 'parent_agency' | 'agency' | null;
  reportes: 'agency' | 'agents_and_agency' | 'agent' | null;
  /** NPN del agente que cobra por la agencia. */
  cobra: string | null;
}

const EXTRA: Record<string, Omit<AgenciaDemo, 'clave' | 'nombre' | 'padre' | 'companias'>> = {
  'agc-claro-master': { npn: '19000001', taxId: '591234001', estado: 'active', telefono: '3055550100', inicio: '2019-03-01', portal: true, comunicaciones: 'agency', reportes: 'agents_and_agency', cobra: '18447107' },
  'agc-sol': { npn: '19000002', taxId: '591234002', estado: 'active', telefono: '3055550111', inicio: '2020-06-15', portal: true, comunicaciones: 'parent_agency', reportes: 'agency', cobra: '18447106' },
  'agc-sol-fl': { npn: null, taxId: '591234003', estado: 'pending_documents', telefono: '3055550122', inicio: '2024-02-01', portal: false, comunicaciones: 'parent_agency', reportes: 'agent', cobra: '18447102' },
  'agc-vistasur': { npn: '19000004', taxId: '591234004', estado: 'active', telefono: '7865550133', inicio: '2021-01-10', portal: true, comunicaciones: 'agency', reportes: 'agents_and_agency', cobra: '18447103' },
  'agc-costabrava': { npn: null, taxId: '591234005', estado: 'pending_contracting', telefono: '9545550144', inicio: '2025-09-01', portal: null, comunicaciones: null, reportes: null, cobra: null },
  'agc-redinsurance': { npn: '19000006', taxId: '591234006', estado: 'active', telefono: '4075550155', inicio: '2022-04-20', portal: true, comunicaciones: 'agency', reportes: 'agency', cobra: '18447105' },
  'agc-andes': { npn: null, taxId: '591234007', estado: 'inactive', telefono: '3215550166', inicio: '2023-08-08', portal: false, comunicaciones: 'parent_agency', reportes: 'agent', cobra: null },
};

export const AGENCIAS_DEMO: AgenciaDemo[] = AGENCIAS.map((a) => ({
  clave: a.id,
  nombre: a.nombre,
  padre: a.parentId,
  companias: a.companias,
  ...EXTRA[a.id]!,
}));

export interface AgenteDemo {
  npn: string;
  nombre: string;
  companias: string[];
  lobs: string[];
  ffm: boolean;
  nota?: string;
  agencias: { clave: string; desde: string }[];
}

const DESDE = '2025-01-15';

export const AGENTES_DEMO: AgenteDemo[] = [
  ...AGENTES.map((a) => ({
    npn: a.npn,
    nombre: a.nombre,
    companias: a.companias,
    lobs: a.lobs,
    ffm: a.certificacionFFM,
    agencias: a.agenciaIds.map((clave) => ({ clave, desde: DESDE })),
  })),
  { npn: '18447190', nombre: 'Andrés Molina', companias: ['claro'], lobs: ['ACA', 'Life'], ffm: true, nota: 'Agente independiente.', agencias: [] },
  {
    npn: '18447191', nombre: 'Rosa Pineda', companias: ['atoz'], lobs: ['ACA', 'Medicare'], ffm: true,
    nota: 'Bajo Red Insurance; independiente en su contrato de ACA (se verá en Contracting).',
    agencias: [{ clave: 'agc-redinsurance', desde: '2025-05-12' }],
  },
];

export interface PersonaDemo {
  nombre: string;
  /** Si además es agente, su NPN. */
  agente?: string;
  puesto?: string;
  centroMedico?: string;
  companias?: string[];
  agencias: { clave: string; desde: string }[];
}

export const REPRESENTANTES_DEMO: PersonaDemo[] = [
  { nombre: 'Luis Marín', agente: '18447106', agencias: [{ clave: 'agc-sol', desde: '2025-03-01' }] },
  { nombre: 'Patricia Gómez', agencias: [{ clave: 'agc-vistasur', desde: '2024-11-04' }] },
];

export const STAFF_DEMO: PersonaDemo[] = [
  { nombre: 'Jorge Salas', puesto: 'Asistente administrativo', agencias: [{ clave: 'agc-sol', desde: '2025-02-10' }] },
  { nombre: 'Elena Ruiz', puesto: 'Coordinadora de documentos', agencias: [{ clave: 'agc-costabrava', desde: '2025-04-22' }] },
];

export const VENDEDORES_DEMO: PersonaDemo[] = [
  { nombre: 'Carmen Vidal', companias: ['claro'], agencias: [{ clave: 'agc-vistasur', desde: '2025-03-18' }] },
  { nombre: 'Tomás Herrera', companias: ['claro'], agencias: [] },
  { nombre: 'Lucía Prado', companias: ['claro'], agencias: [{ clave: 'agc-sol', desde: '2025-07-14' }] },
];

export const BENEFIT_COORDINATORS_DEMO: PersonaDemo[] = [
  { nombre: 'Marisol Peña', centroMedico: 'Clínica Bienestar Total', companias: ['claro'], agencias: [] },
  { nombre: 'Hugo Estrada', centroMedico: 'Centro Médico La Esperanza', companias: ['atoz'], agencias: [] },
];

/* ------------------------------------------------------------- interacciones */
/* Inventadas. Los SMS y chats vienen del prototipo PB-002 v2.6 (`datos-directorio.mock.js`): llegarían
   del adaptador de Five9 (nota TARGET). El resto (correos, portal, llamadas, casos, avisos, sesiones)
   representa lo que escribirán esos módulos cuando existan. El sujeto es un agente (por NPN) o una
   agencia (por clave), nunca los dos. */

export interface InteraccionDemo {
  tipo: 'correo' | 'portal' | 'llamada' | 'sms' | 'chat' | 'caso' | 'aviso' | 'sesion';
  direccion?: 'entrada' | 'salida';
  cuando: string;
  titulo: string;
  detalle?: string;
  agente?: string;
  agencia?: string;
  fuente?: string;
}

const FIVE9 = 'Five9 (adaptador, nota TARGET)';

export const INTERACCIONES_DEMO: InteraccionDemo[] = [
  // María Torres (Sol Insurance — Florida, Vista Sur)
  { tipo: 'sms', direccion: 'entrada', cuando: '2026-09-20T17:05:00-04:00', titulo: 'Mensaje recibido', detalle: '¿Ya salió el pago de Humana? Me dijeron que lo veían hoy.', agente: '18447101', fuente: FIVE9 },
  { tipo: 'sms', direccion: 'salida', cuando: '2026-09-20T17:32:00-04:00', titulo: 'Mensaje enviado', detalle: 'El cierre de septiembre está en carga de statements. Te avisamos apenas se publique.', agente: '18447101', fuente: FIVE9 },
  { tipo: 'correo', direccion: 'salida', cuando: '2026-09-22T09:10:00-04:00', titulo: 'Statement de septiembre publicado', detalle: 'Ya puedes ver tu statement de Humana en el portal.', agente: '18447101' },
  // Roberto Díaz (Sol Insurance — Florida)
  { tipo: 'chat', direccion: 'entrada', cuando: '2026-09-19T10:14:00-04:00', titulo: 'Mensaje recibido', detalle: 'No puedo entrar al portal de la aseguradora, me pide un código.', agente: '18447102', fuente: FIVE9 },
  { tipo: 'chat', direccion: 'salida', cuando: '2026-09-19T10:21:00-04:00', titulo: 'Mensaje enviado', detalle: 'Te enviamos de nuevo el enlace de registro. Vence en 10 días.', agente: '18447102', fuente: FIVE9 },
  { tipo: 'llamada', cuando: '2026-09-23T11:40:00-04:00', titulo: 'Llamada devuelta', detalle: 'Confirmó que ya pudo entrar al portal.', agente: '18447102', fuente: 'Five9' },
  // Sol Insurance — Florida (la agencia)
  { tipo: 'chat', direccion: 'entrada', cuando: '2026-09-18T15:40:00-04:00', titulo: 'Mensaje recibido', detalle: 'Queremos saber si la retención de comisiones aplica también a nuestros agentes de Florida.', agencia: 'agc-sol-fl', fuente: FIVE9 },
  { tipo: 'caso', cuando: '2026-09-24T08:30:00-04:00', titulo: 'Caso abierto: documentos de la sub-agencia', detalle: 'Falta el W9 actualizado para pasar a activa.', agencia: 'agc-sol-fl' },
  // Sol Insurance (la agencia) y Luis Marín
  { tipo: 'correo', direccion: 'entrada', cuando: '2026-09-15T14:02:00-04:00', titulo: 'Cambio de representante', detalle: 'Les pedimos actualizar el contacto de la agencia en el portal.', agencia: 'agc-sol' },
  { tipo: 'portal', direccion: 'salida', cuando: '2026-09-16T10:00:00-04:00', titulo: 'Contacto actualizado', detalle: 'Luis Marín queda como representante de la agencia.', agencia: 'agc-sol' },
  { tipo: 'sesion', cuando: '2026-09-25T10:45:00-04:00', titulo: 'Capacitación: nuevo portal de comisiones', agente: '18447106' },
  // Agencia Vista Sur y Carla Peña
  { tipo: 'aviso', direccion: 'salida', cuando: '2026-09-12T16:20:00-04:00', titulo: 'Aviso del carrier: Aetna', detalle: 'Renovar la certificación anual antes del 30 de septiembre.', agente: '18447103' },
  { tipo: 'llamada', cuando: '2026-09-26T15:05:00-04:00', titulo: 'Llamada no contestada', detalle: 'Seguimiento del onboarding de dos agentes nuevos.', agencia: 'agc-vistasur', fuente: 'Five9' },
  // Red Insurance (AtoZ)
  { tipo: 'sms', direccion: 'entrada', cuando: '2026-09-21T08:20:00-04:00', titulo: 'Mensaje recibido', detalle: 'Recibí un aviso del carrier, ¿qué tengo que enviarles?', agente: '18447105', fuente: FIVE9 },
  { tipo: 'caso', cuando: '2026-09-21T09:00:00-04:00', titulo: 'Caso abierto: aviso del carrier', detalle: 'Se le explicó qué documento enviar.', agente: '18447105' },
  // Andrés Molina (independiente): no aparece en la red de ninguna agencia
  { tipo: 'llamada', cuando: '2026-09-27T12:00:00-04:00', titulo: 'Llamada devuelta', detalle: 'Consultó por contratos de ACA.', agente: '18447190', fuente: 'Five9' },
];

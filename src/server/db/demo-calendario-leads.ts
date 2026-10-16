/**
 * Datos de DEMOSTRACIÓN del Calendario y de Lead Management (H-021), traídos del prototipo PB-002 v2.6
 * (`datos-actividades.mock.js` y `PIPELINE_COMERCIAL` / `INTERACCIONES_COMERCIALES` de `datos.mock.js`).
 *
 * Nombres, fechas, motivos y tiempos: 100% INVENTADOS. El «hoy» del prototipo es 2026-09-21: las
 * fechas se corren al día en que se carga la demo, para que el calendario no abra vacío.
 * Los equipos del prototipo eran áreas del kit; aquí son las áreas de Datos base (misma regla que 0014).
 */
import type { Tx } from './conexion';
import { leadInteractions, leads, taskStatusHistory, taskTimeEntries, tasks } from './schema';

const HOY_PROTOTIPO = '2026-09-21';

type Prio = 'urgente' | 'alta' | 'normal' | 'baja';
type TipoT = 'tarea' | 'reunion' | 'llamada' | 'visita' | 'evento';
type EstT = 'pendiente' | 'en-curso' | 'cerrada';
interface TareaDemo {
  clave: string;
  creadaPor: string;
  equipo: string | null;
  responsable: string | null;
  tipo: TipoT;
  titulo: string;
  prioridad: Prio;
  inicio: string;
  fin: string;
  estado: EstT;
  motivo: string;
  cliente?: { tipo: 'agente'; id: string; nombre: string };
  tiempo?: [string, number, string, ('manual' | 'cronometro')?][];
  historial?: [EstT, string, string, string][];
}

const propia = (e: string) => ({ creadaPor: e, equipo: null, responsable: e });

const TAREAS: TareaDemo[] = [
  { clave: 'ag-001', ...propia('emp-ricardo-leon'), tipo: 'reunion', titulo: 'Revisión mensual de resultados con el board', prioridad: 'alta', inicio: '2026-09-24', fin: '2026-09-24', estado: 'pendiente', motivo: 'Convocada - pendiente de confirmación de dos asistentes' },
  { clave: 'ag-002', ...propia('emp-ricardo-leon'), tipo: 'llamada', titulo: 'Llamada con carrier estratégico - renovación de acuerdo marco', prioridad: 'normal', inicio: '2026-09-18', fin: '2026-09-18', estado: 'cerrada', motivo: 'Realizada - acuerdo renovado', tiempo: [['emp-ricardo-leon', 45, '2026-09-18']] },
  { clave: 'ag-003', ...propia('emp-sara-delgado'), tipo: 'evento', titulo: 'Comité operativo semanal (COO)', prioridad: 'normal', inicio: '2026-09-21', fin: '2026-09-21', estado: 'pendiente', motivo: 'Programado para hoy, sin agenda circulada aún' },
  { clave: 'ag-004', ...propia('emp-sara-delgado'), tipo: 'tarea', titulo: 'Revisar propuesta de reestructuración de Broker Support', prioridad: 'baja', inicio: '2026-09-25', fin: '2026-09-30', estado: 'pendiente', motivo: 'Sin urgencia - para la próxima ventana de planeación' },
  { clave: 'ag-005', ...propia('emp-ana-fuentes'), tipo: 'tarea', titulo: 'Resolver reconciliaciones de alto monto escaladas', prioridad: 'urgente', inicio: '2026-09-19', fin: '2026-09-22', estado: 'en-curso', motivo: '3 reconciliaciones vencen su SLA interno mañana', tiempo: [['emp-ana-fuentes', 90, '2026-09-19'], ['emp-ana-fuentes', 60, '2026-09-21', 'cronometro']] },
  { clave: 'ag-006', ...propia('emp-ana-fuentes'), tipo: 'llamada', titulo: 'Llamada con Aetna - statement de septiembre', prioridad: 'normal', inicio: '2026-09-23', fin: '2026-09-23', estado: 'pendiente', motivo: 'Agendada, esperando confirmación del carrier' },
  { clave: 'ag-007', ...propia('emp-valentina-rios'), tipo: 'tarea', titulo: 'Registrar inconsistencia - póliza pol-88213 (Cigna)', prioridad: 'alta', inicio: '2026-09-16', fin: '2026-09-20', estado: 'pendiente', motivo: 'Venció sin gestión - sin motivo registrado' },
  { clave: 'ag-008', ...propia('emp-valentina-rios'), tipo: 'llamada', titulo: 'Seguimiento con UnitedHealthcare - bloque Red Insurance', prioridad: 'normal', inicio: '2026-09-22', fin: '2026-09-22', estado: 'pendiente', motivo: 'Programada' },
  { clave: 'ag-009', ...propia('emp-andres-cano'), tipo: 'reunion', titulo: 'Revisión de cola de Contract Requests con el equipo', prioridad: 'normal', inicio: '2026-09-21', fin: '2026-09-21', estado: 'cerrada', motivo: 'Realizada esta mañana', tiempo: [['emp-andres-cano', 60, '2026-09-21']] },
  { clave: 'ag-010', ...propia('emp-andres-cano'), tipo: 'visita', titulo: 'Visita a Costa Brava Insurance (contracting)', prioridad: 'normal', inicio: '2026-09-29', fin: '2026-09-29', estado: 'pendiente', motivo: 'Programada' },
  { clave: 'ag-011', ...propia('emp-camila-ortiz'), tipo: 'tarea', titulo: 'Auditoría trimestral de accesos y roles', prioridad: 'normal', inicio: '2026-09-28', fin: '2026-09-30', estado: 'pendiente', motivo: 'Programada - sin bloqueantes' },
  { clave: 'ag-012', ...propia('emp-felipe-rojas'), tipo: 'tarea', titulo: 'Aprobar desembolsos de Commission in Advance pendientes', prioridad: 'alta', inicio: '2026-09-21', fin: '2026-09-21', estado: 'en-curso', motivo: '2 solicitudes esperando su aprobación', tiempo: [['emp-felipe-rojas', 25, '2026-09-21']] },
  { clave: 'ag-013', ...propia('emp-carlos-mora'), tipo: 'tarea', titulo: 'Triage de leads escalados por compliance', prioridad: 'urgente', inicio: '2026-09-18', fin: '2026-09-23', estado: 'en-curso', motivo: 'Esperando respuesta de OIG/SAM', tiempo: [['emp-carlos-mora', 40, '2026-09-18']] },
  { clave: 'ag-014', ...propia('emp-jorge-nieto'), tipo: 'evento', titulo: 'Kickoff de campaña de leads Q4', prioridad: 'normal', inicio: '2026-09-28', fin: '2026-09-28', estado: 'pendiente', motivo: 'Programado' },
  { clave: 'ag-015', ...propia('emp-lucia-ramos'), tipo: 'llamada', titulo: 'Llamada de calificación - Óscar Villalba', prioridad: 'normal', inicio: '2026-09-21', fin: '2026-09-21', estado: 'en-curso', motivo: 'Esperando respuesta del cliente', tiempo: [['emp-lucia-ramos', 15, '2026-09-21', 'cronometro']] },
  { clave: 'ag-016', ...propia('emp-diego-paredes'), tipo: 'reunion', titulo: 'Revisión de estrategia de Growth con agente María Torres', prioridad: 'alta', inicio: '2026-09-22', fin: '2026-09-22', estado: 'pendiente', motivo: 'Pendiente de aprobar la estrategia antes de compartirla con el agente' },
  { clave: 'ag-017', ...propia('emp-paula-vega'), tipo: 'tarea', titulo: 'Actualizar certificaciones AEP vencidas', prioridad: 'alta', inicio: '2026-09-15', fin: '2026-09-19', estado: 'pendiente', motivo: 'Vencida - no se gestionó a tiempo' },
  { clave: 'ag-018', ...propia('emp-diego-paredes'), tipo: 'tarea', titulo: 'Preparar propuesta de cross-sell antes de la llamada de seguimiento', prioridad: 'normal', inicio: '2026-09-21', fin: '2026-09-23', estado: 'en-curso', motivo: 'Falta cargar el simulador con el escenario de crecimiento antes de la reunión', cliente: { tipo: 'agente', id: '18447107', nombre: 'Renata Solano' }, tiempo: [['emp-diego-paredes', 30, '2026-09-21']] },

  { clave: 'tk-101', creadaPor: 'emp-valentina-rios', equipo: 'Contracting', responsable: 'emp-andres-cano', tipo: 'tarea', titulo: 'Confirmar número de agente con Cigna para pol-88213', prioridad: 'alta', inicio: '2026-09-20', fin: '2026-09-24', estado: 'en-curso', motivo: 'Consultado en el portal de Cigna; esperando su respuesta', tiempo: [['emp-andres-cano', 30, '2026-09-21']],
    historial: [['pendiente', '2026-09-20', 'emp-valentina-rios', 'Asignada al equipo Contracting'], ['pendiente', '2026-09-20', 'emp-andres-cano', 'La tomó Andrés Cano'], ['en-curso', '2026-09-21', 'emp-andres-cano', 'Consultado en el portal de Cigna; esperando su respuesta']] },
  { clave: 'tk-102', creadaPor: 'emp-valentina-rios', equipo: 'Finance', responsable: null, tipo: 'tarea', titulo: 'Validar el ajuste de comisión de agosto antes del pago', prioridad: 'urgente', inicio: '2026-09-21', fin: '2026-09-22', estado: 'pendiente', motivo: 'Asignada al equipo Finance; nadie la tomó todavía' },
  { clave: 'tk-103', creadaPor: 'emp-andres-cano', equipo: 'BOB & Commissions', responsable: 'emp-ana-fuentes', tipo: 'tarea', titulo: 'Revisar la regla de chargeback de ACA aplicada en agosto', prioridad: 'normal', inicio: '2026-09-14', fin: '2026-09-18', estado: 'cerrada', motivo: 'Se corrigió la regla y quedó documentada', tiempo: [['emp-ana-fuentes', 75, '2026-09-17']],
    historial: [['pendiente', '2026-09-14', 'emp-andres-cano', 'Asignada al equipo BOB & Commissions'], ['pendiente', '2026-09-15', 'emp-ana-fuentes', 'La tomó Ana Fuentes'], ['en-curso', '2026-09-16', 'emp-ana-fuentes', 'Revisando los casos de agosto'], ['cerrada', '2026-09-18', 'emp-ana-fuentes', 'Se corrigió la regla y quedó documentada']] },
  { clave: 'tk-104', creadaPor: 'emp-lucia-ramos', equipo: 'Contracting', responsable: null, tipo: 'tarea', titulo: 'Revisar qué certificación le falta a Óscar Villalba para contratar Life', prioridad: 'normal', inicio: '2026-09-21', fin: '2026-09-25', estado: 'pendiente', motivo: 'Asignada al equipo Contracting; nadie la tomó todavía' },
  { clave: 'tk-105', creadaPor: 'emp-andres-cano', equipo: 'BOB & Commissions', responsable: null, tipo: 'tarea', titulo: 'Revisar la diferencia de pago que reporta Costa Brava Insurance', prioridad: 'alta', inicio: '2026-09-21', fin: '2026-09-24', estado: 'pendiente', motivo: 'Asignada al equipo BOB & Commissions; nadie la tomó todavía' },
  { clave: 'tk-106', creadaPor: 'emp-paula-vega', equipo: 'Commercial', responsable: 'emp-lucia-ramos', tipo: 'tarea', titulo: 'Compartir con el equipo Life el material de certificación AEP', prioridad: 'baja', inicio: '2026-09-21', fin: '2026-09-26', estado: 'en-curso', motivo: 'Material recibido; falta enviarlo a dos personas', tiempo: [['emp-lucia-ramos', 20, '2026-09-21']],
    historial: [['pendiente', '2026-09-20', 'emp-paula-vega', 'Asignada al equipo Commercial'], ['pendiente', '2026-09-21', 'emp-lucia-ramos', 'La tomó Lucía Ramos'], ['en-curso', '2026-09-21', 'emp-lucia-ramos', 'Material recibido; falta enviarlo a dos personas']] },
  { clave: 'tk-107', creadaPor: 'emp-diego-paredes', equipo: 'Service', responsable: 'emp-paula-vega', tipo: 'tarea', titulo: 'Publicar el calendario de certificaciones Medicare 2027', prioridad: 'normal', inicio: '2026-09-10', fin: '2026-09-17', estado: 'cerrada', motivo: 'Publicado en el portal del agente', tiempo: [['emp-paula-vega', 50, '2026-09-16'], ['emp-paula-vega', 35, '2026-09-17', 'cronometro']],
    historial: [['pendiente', '2026-09-10', 'emp-diego-paredes', 'Asignada al equipo Service'], ['pendiente', '2026-09-11', 'emp-paula-vega', 'La tomó Paula Vega'], ['cerrada', '2026-09-17', 'emp-paula-vega', 'Publicado en el portal del agente']] },
];

type TipoL = 'agente' | 'agencia' | 'vendedor-sin-npn' | 'benefit-coordinator';
type Est = 'pending' | 'waiting' | 'ok' | 'at-risk' | 'blocked' | 'neutral';
interface LeadDemo {
  clave: string;
  nombre: string;
  tipo: TipoL;
  lobs: string[];
  fase: 'lead' | 'onboarding' | 'cliente';
  disposicion?: string;
  estado: Est;
  motivo: string;
  responsable: string | null;
  fecha: string;
  contacto: [string, string, string];
  fuentes: { origen: string; canal: string; campana?: string }[];
  referidoPor?: string;
  prioridad: string;
  territorio: string;
  idioma?: string;
  direccion: [string, string, string, string, boolean];
  centroMedico?: string;
  cierre?: { familia: 'no-contactable' | 'no-interesado'; motivo: string; fecha: string };
  info?: Record<string, number | string | string[]>;
  cadencia?: [string, boolean, string | null][];
}

const LEADS: LeadDemo[] = [
  { clave: 'pl-1', nombre: 'Óscar Villalba', tipo: 'agente', lobs: ['Medicare'], fase: 'lead', disposicion: 'Interesado', estado: 'pending', motivo: 'Llamada de seguimiento agendada para calificar mejor el interés', responsable: 'emp-lucia-ramos', fecha: '2026-09-18',
    contacto: ['Óscar Villalba', '3055550142', 'oscar.villalba@mail.com'], fuentes: [{ origen: 'referido', canal: 'Benefit coordinator' }], referidoPor: 'Marisol Peña (Clínica Bienestar Total)', prioridad: 'Media', territorio: 'Miami-Dade, FL',
    direccion: ['2200 Coral Way', 'Miami', 'FL', '33145', false] },
  { clave: 'pl-2', nombre: 'Aseguradora del Valle', tipo: 'agencia', lobs: ['Life'], fase: 'lead', disposicion: 'Cita agendada', estado: 'waiting', motivo: 'Esperando la reunión de cierre con su comité', responsable: 'emp-carlos-mora', fecha: '2026-09-17',
    contacto: ['Isabel Fonseca', '8135550187', 'isabel.fonseca@aseguradoradelvalle.com'], fuentes: [{ origen: 'evento', canal: 'Feria comercial' }, { origen: 'marketing', canal: 'Webinar', campana: 'Webinar de producto 2026-08' }], prioridad: 'Alta', territorio: 'Tampa Bay, FL',
    direccion: ['900 N Franklin St', 'Tampa', 'FL', '33602', true],
    info: { modeloNegocio: 'Independent Agent', miembrosACAFuera: 180, miembrosMedicareFuera: 0, lifeAPFuera: 65000, miembrosPCFuera: 40, acaComprometido: '150 miembros', lifeComprometido: '$40,000 AP', lobFueraDeClaro: ['ACA', 'Life', 'P&C'], interesadoEn: ['Life', 'ACA'], carriersACA: ['Cigna', 'Oscar'], carriersVida: ['Foresters', 'Allianz'], aniosLicencia: 6, estadosLicenciados: 2, numeroAgentes: 5, numeroContratos: 0, uplineVida: ['Family First Life (FFL)'], objecionesClave: 'Preocupados por el tiempo de transición de sus pólizas Life actuales.', proximosPasos: 'Confirmar fecha de la reunión de cierre con el comité y enviar propuesta de comisión.' } },
  { clave: 'pl-3', nombre: 'Marta Elena Ruiz', tipo: 'vendedor-sin-npn', lobs: ['P&C'], fase: 'lead', disposicion: 'No disponible', estado: 'at-risk', motivo: '3 llamadas sin respuesta - en riesgo de quedar sin gestión', responsable: 'emp-jorge-nieto', fecha: '2026-09-10',
    contacto: ['Marta Elena Ruiz', '4075550198', 'marta.ruiz@mail.com'], fuentes: [{ origen: 'prospeccion', canal: 'Llamada en frío' }], prioridad: 'Baja', territorio: 'Orlando, FL', direccion: ['450 S Orange Ave', 'Orlando', 'FL', '32801', false] },
  { clave: 'pl-4', nombre: 'Pedro Salgado', tipo: 'agente', lobs: ['Medicare'], fase: 'onboarding', estado: 'pending', motivo: 'Falta la verificación automática del voided check (API) para completar el onboarding', responsable: 'emp-lucia-ramos', fecha: '2026-09-15',
    contacto: ['Pedro Salgado', '3055550120', 'pedro.salgado@mail.com'], fuentes: [{ origen: 'referido', canal: 'Agente' }], referidoPor: 'María Torres', prioridad: 'Alta', territorio: 'Miami-Dade, FL', direccion: ['1500 SW 8th St', 'Miami', 'FL', '33135', false] },
  { clave: 'pl-5', nombre: 'Grupo Insurance Meridian', tipo: 'agencia', lobs: ['Life', 'P&C'], fase: 'onboarding', estado: 'ok', motivo: 'Documentación completa - lista para completar el onboarding', responsable: 'emp-carlos-mora', fecha: '2026-09-12',
    contacto: ['Ramón Castillo', '7865550155', 'ramon.castillo@grupomeridian.com'], fuentes: [{ origen: 'marketing', canal: 'Formulario de red social', campana: 'Campaña de reclutamiento Q3' }], prioridad: 'Alta', territorio: 'Broward, FL', direccion: ['3300 University Dr', 'Fort Lauderdale', 'FL', '33328', true] },
  { clave: 'pl-6', nombre: 'Renata Solano', tipo: 'agente', lobs: ['Medicare'], fase: 'cliente', estado: 'ok', motivo: 'Onboarding completado - documentos verificados y con contrato activo', responsable: 'emp-diego-paredes', fecha: '2026-08-20',
    contacto: ['Renata Solano', '3055550176', 'renata.solano@mail.com'], fuentes: [{ origen: 'referido', canal: 'Agencia' }], referidoPor: 'Claro Insurance (agencia matriz)', prioridad: 'Alta', territorio: 'Miami-Dade, FL', direccion: ['8100 SW 40th St', 'Miami', 'FL', '33155', false] },
  { clave: 'pl-7', nombre: 'Andes Coverage Group', tipo: 'agencia', lobs: ['Life'], fase: 'cliente', estado: 'waiting', motivo: 'Contratos aún en trámite con el carrier - documentos de pago siguen en verificación', responsable: 'emp-diego-paredes', fecha: '2026-09-05',
    contacto: ['Lucía Andrade', '4075550163', 'lucia.andrade@andescoverage.com'], fuentes: [{ origen: 'evento', canal: 'Feria comercial' }], prioridad: 'Media', territorio: 'Orlando, FL', direccion: ['200 E Robinson St', 'Orlando', 'FL', '32801', true] },
  { clave: 'pl-8', nombre: 'Marisol Peña', tipo: 'benefit-coordinator', lobs: ['Medicare'], fase: 'lead', disposicion: 'Interesado', estado: 'pending', motivo: 'Primera llamada agendada para conocer el volumen de referidos del centro médico', responsable: null, fecha: '2026-09-19',
    contacto: ['Marisol Peña', '3055550199', 'marisol.pena@clinicabienestartotal.com'], fuentes: [{ origen: 'prospeccion', canal: 'Visita en campo' }], prioridad: 'Media', territorio: 'Miami-Dade, FL', direccion: ['5600 SW 8th St', 'Miami', 'FL', '33144', true], centroMedico: 'Clínica Bienestar Total',
    cadencia: [['Primer contacto', true, '2026-09-02'], ['Llamada 1', true, '2026-09-05'], ['Llamada 2', true, '2026-09-12'], ['Llamada 3', false, '2026-09-23'], ['Visita', false, null]] },
  { clave: 'pl-12', nombre: 'Andrés Villamil', tipo: 'agente', lobs: ['Life'], fase: 'lead', disposicion: 'Cerrado', estado: 'neutral', motivo: 'Cerrado: no contactable · Contacto inválido', responsable: 'emp-lucia-ramos', fecha: '2026-09-08',
    cierre: { familia: 'no-contactable', motivo: 'Contacto inválido', fecha: '2026-09-08' }, contacto: ['Andrés Villamil', '9545550110', 'avillamil@mail.com'], fuentes: [{ origen: 'prospeccion', canal: 'Base cargada' }], prioridad: 'Baja', territorio: 'Broward, FL', direccion: ['410 SE 3rd Ave', 'Fort Lauderdale', 'FL', '33301', false] },
  { clave: 'pl-13', nombre: 'Horizonte Seguros LLC', tipo: 'agencia', lobs: ['Medicare'], fase: 'lead', disposicion: 'Cerrado', estado: 'neutral', motivo: 'Cerrado: no interesado · Mejor compensación en otro lado', responsable: 'emp-diego-paredes', fecha: '2026-09-15',
    cierre: { familia: 'no-interesado', motivo: 'Mejor compensación en otro lado', fecha: '2026-09-15' }, contacto: ['Lorena Paz', '4075550133', 'lpaz@horizonteseguros.com'], fuentes: [{ origen: 'marketing', canal: 'Formulario web' }], prioridad: 'Media', territorio: 'Orange, FL', direccion: ['200 E Robinson St', 'Orlando', 'FL', '32801', true] },
  { clave: 'pl-14', nombre: 'Gabriela Soto', tipo: 'agente', lobs: ['Medicare'], fase: 'lead', disposicion: 'Interesado', estado: 'pending', motivo: 'Llegó desde un webinar y todavía no tiene responsable', responsable: null, fecha: '2026-09-20', idioma: 'Español',
    contacto: ['Gabriela Soto', '8135550171', 'gsoto@mail.com'], fuentes: [{ origen: 'marketing', canal: 'Webinar', campana: 'Webinar Medicare 2026-09' }], prioridad: 'Alta', territorio: 'Hillsborough, FL', direccion: ['1 Tampa City Center', 'Tampa', 'FL', '33602', true] },
];

type TipoI = 'llamada' | 'visita' | 'reunion' | 'evento';
interface InteraccionDemo {
  lead: string;
  tipo: TipoI;
  fecha: string;
  estado: Est;
  motivo: string;
  empleado: string;
  nombre: string;
  notas: string;
  origen: string;
  contacto: string;
  primera?: boolean;
  seguimiento?: boolean;
  persona: string;
  disposicion?: string;
  ruta?: number;
  resultado?: 'exitosa';
}

const INTERACCIONES: InteraccionDemo[] = [
  { lead: 'pl-1', tipo: 'llamada', fecha: '2026-09-22', estado: 'pending', motivo: 'Llamada de seguimiento para calificar interés', empleado: 'emp-lucia-ramos', nombre: 'Llamada de calificación', notas: 'Confirmar si sigue interesado en Medicare Advantage', origen: 'Manual', contacto: 'Óscar Villalba', primera: true, persona: 'El agente' },
  { lead: 'pl-2', tipo: 'visita', fecha: '2026-09-22', estado: 'pending', motivo: 'Primera visita - presentación de Claro', empleado: 'emp-carlos-mora', ruta: 1, nombre: 'Visita de presentación', notas: 'Llevar catálogo de carriers Life', origen: 'Weekly Planner', contacto: 'Isabel Fonseca', primera: true, persona: 'Quien decide' },
  { lead: 'pl-2', tipo: 'reunion', fecha: '2026-09-24', estado: 'waiting', motivo: 'Reunión de cierre con el comité de la agencia', empleado: 'emp-carlos-mora', nombre: 'Reunión de cierre con comité', notas: 'Isabel confirmó la agenda con su comité directivo', origen: 'Manual', contacto: 'Isabel Fonseca', seguimiento: true, persona: 'Quien decide' },
  { lead: 'pl-3', tipo: 'llamada', fecha: '2026-09-21', estado: 'blocked', motivo: '3 intentos sin respuesta', empleado: 'emp-jorge-nieto', nombre: 'Tercer intento de contacto', notas: 'No contesta, buzón lleno', disposicion: 'No answer', origen: 'Manual', contacto: 'Marta Elena Ruiz', seguimiento: true, persona: 'No identificado' },
  { lead: 'pl-4', tipo: 'evento', fecha: '2026-09-23', estado: 'pending', motivo: 'Invitado al webinar de certificación Medicare', empleado: 'emp-lucia-ramos', nombre: 'Webinar certificación Medicare', notas: 'Invitación enviada por correo', origen: 'Manual', contacto: 'Pedro Salgado', persona: 'El agente' },
  { lead: 'pl-5', tipo: 'visita', fecha: '2026-09-21', estado: 'ok', motivo: 'Visita de cierre de documentos - realizada', empleado: 'emp-carlos-mora', ruta: 2, nombre: 'Visita de cierre documental', notas: 'Se recogió el agreement firmado en persona', origen: 'Daily Route', contacto: 'Ramón Castillo', persona: 'Quien decide', resultado: 'exitosa' },
  { lead: 'pl-6', tipo: 'llamada', fecha: '2026-09-25', estado: 'pending', motivo: 'Seguimiento post-onboarding - primeras ventas', empleado: 'emp-diego-paredes', nombre: 'Seguimiento post-onboarding', notas: 'Revisar primeras ventas de Medicare', origen: 'Manual', contacto: 'Renata Solano', persona: 'El agente' },
  { lead: 'pl-7', tipo: 'visita', fecha: '2026-09-22', estado: 'waiting', motivo: 'Visita de seguimiento - verificación de pago pendiente', empleado: 'emp-diego-paredes', ruta: 1, nombre: 'Visita de seguimiento de pago', notas: 'Confirmar estado del direct deposit con el banco', origen: 'Weekly Planner', contacto: 'Lucía Andrade', persona: 'Quien decide' },
  { lead: 'pl-1', tipo: 'llamada', fecha: '2026-09-19', estado: 'ok', motivo: 'Llamada hecha; falta registrar el resultado', empleado: 'emp-lucia-ramos', nombre: 'Llamada de seguimiento', notas: 'Le interesa, pero quiere comparar la compensación con su upline actual. Volver a llamar el martes.', origen: 'Manual', contacto: 'Óscar Villalba', persona: 'El agente', seguimiento: true },
];

/** Corre una fecha del prototipo para que su «hoy» caiga en `hoy`. */
function corredor(hoy: string) {
  const dias = Math.round((Date.parse(hoy) - Date.parse(HOY_PROTOTIPO)) / 86400000);
  return (f: string) => new Date(Date.parse(f) + dias * 86400000).toISOString().slice(0, 10);
}

/** Carga las tareas del Calendario si todavía no hay ninguna. Devuelve cuántas cargó. */
export async function sembrarTareas(tx: Tx, empleados: Set<string>): Promise<number> {
  if ((await tx.select({ id: tasks.id }).from(tasks).limit(1)).length) return 0;
  const f = corredor(new Date().toISOString().slice(0, 10));
  let n = 0;
  for (const t of TAREAS) {
    if (![t.creadaPor, t.responsable].every((e) => e === null || empleados.has(e))) continue;
    const [fila] = await tx
      .insert(tasks)
      .values({
        title: t.titulo, type: t.tipo, priority: t.prioridad, startDate: f(t.inicio), endDate: f(t.fin), status: t.estado, reason: t.motivo,
        createdBy: t.creadaPor, team: t.equipo, assigneeId: t.responsable,
        ...(t.cliente ? { relatedKind: t.cliente.tipo, relatedId: t.cliente.id, relatedName: t.cliente.nombre } : {}),
        isDemo: true,
      })
      .returning({ id: tasks.id });
    const historial = t.historial ?? [[t.estado, t.inicio, t.creadaPor, t.motivo]];
    await tx.insert(taskStatusHistory).values(historial.map(([estado, fecha, quien, motivo]) => ({ taskId: fila!.id, status: estado, at: new Date(`${f(fecha)}T12:00:00Z`), employeeId: quien, reason: motivo })));
    if (t.tiempo?.length) {
      await tx.insert(taskTimeEntries).values(t.tiempo.map(([e, min, fecha, origen]) => ({ taskId: fila!.id, employeeId: e, minutes: min, date: f(fecha), origin: origen ?? 'manual' })));
    }
    n++;
  }
  return n;
}

/** Carga el pool comercial y sus interacciones si todavía no hay leads. Devuelve cuántos leads cargó. */
export async function sembrarLeads(tx: Tx, empleados: Set<string>): Promise<number> {
  if ((await tx.select({ id: leads.id }).from(leads).limit(1)).length) return 0;
  const f = corredor(new Date().toISOString().slice(0, 10));
  const porClave = new Map<string, number>();
  for (const l of LEADS) {
    const [fila] = await tx
      .insert(leads)
      .values({
        name: l.nombre, type: l.tipo, lobs: l.lobs, stage: l.fase, disposition: l.disposicion ?? null, status: l.estado, reason: l.motivo,
        assigneeId: l.responsable && empleados.has(l.responsable) ? l.responsable : null, leadDate: f(l.fecha),
        contactName: l.contacto[0], contactPhone: l.contacto[1], contactEmail: l.contacto[2], sources: l.fuentes, referredBy: l.referidoPor ?? null,
        priority: l.prioridad, territory: l.territorio, language: l.idioma ?? null,
        address: { calle: l.direccion[0], ciudad: l.direccion[1], estado: l.direccion[2], zip: l.direccion[3], comercial: l.direccion[4] },
        medicalCenter: l.centroMedico ?? null, closure: l.cierre ? { ...l.cierre, fecha: f(l.cierre.fecha) } : null, businessInfo: l.info ?? null,
        cadence: l.cadencia ? l.cadencia.map(([paso, hecho, fecha]) => ({ paso, hecho, fecha: fecha ? f(fecha) : null })) : null,
        isDemo: true,
      })
      .returning({ id: leads.id });
    porClave.set(l.clave, fila!.id);
  }
  await tx.insert(leadInteractions).values(
    INTERACCIONES.filter((i) => porClave.has(i.lead)).map((i) => ({
      leadId: porClave.get(i.lead)!, type: i.tipo, date: f(i.fecha), status: i.estado, reason: i.motivo, employeeId: empleados.has(i.empleado) ? i.empleado : null,
      name: i.nombre, notes: i.notas, origin: i.origen, contactName: i.contacto, isFirst: !!i.primera, isFollowUp: !!i.seguimiento, personContacted: i.persona,
      disposition: i.disposicion ?? null, routeOrder: i.ruta ?? null, result: i.resultado ?? null, isDemo: true,
    })),
  );
  return LEADS.length;
}


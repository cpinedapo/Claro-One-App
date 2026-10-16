/**
 * La capa de lectura: de las tablas a las formas del kit.
 *
 * Es la costura de **datos** de ESTRUCTURA-DEL-FRONT §7. Las pantallas reciben exactamente los tipos
 * de `@arc2-0/claro-one-kit/dominio` que recibían en el prototipo; de dónde salen deja de importarles.
 */
import 'server-only';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Evento } from '@arc2-0/claro-one-kit/capacidad';
import type { Asignacion } from '@arc2-0/claro-one-kit/dominio';
import type { Cronometro, Tarea } from '@/dominio/actividades';
import type { InteraccionComercial, Lead } from '@/dominio/leads';
import type { ErrorFila, ImportacionHecha } from '@/dominio/importacion';
import type { BaselinesVigentes, OpcionBaseline, ValorBaseline } from '@/dominio/baselines';
import type { AgenciaDirectorio, DirectorioCompleto, Membresia } from '@/dominio/directorio';
import type { Interaccion } from '@/dominio/interacciones';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import type { CampoArea, ValorCampoArea } from '@/dominio/camposArea';
import { db } from './db';
import type { Tx } from './db';
import * as t from './db/schema';

type Lector = typeof db | Tx;

/* ------------------------------------------------------------- empleados */

const aAsignacion = (r: typeof t.asignacion.$inferSelect): Asignacion => ({
  id: r.id,
  rolId: r.rolId,
  alcanceTipo: r.alcanceTipo,
  alcanceValor: r.alcanceValor,
  lob: r.lob,
  est: r.validTo ? 'neutral' : 'ok',
  desde: r.validFrom.toISOString().slice(0, 10),
});

export async function cargarEmpleados(lector: Lector = db): Promise<EmpleadoConCorreo[]> {
  const [filas, asignaciones, permisos] = await Promise.all([
    // Los dados de baja (H-019) no aparecen: ni en la lista, ni en «Ver como», ni para asignar.
    lector.select().from(t.empleado).where(isNull(t.empleado.validTo)).orderBy(asc(t.empleado.nombre)),
    lector.select().from(t.asignacion).orderBy(asc(t.asignacion.validFrom), asc(t.asignacion.id)),
    lector.select().from(t.employeePermissions).where(isNull(t.employeePermissions.validTo)),
  ]);
  const porEmpleado = new Map<string, Asignacion[]>();
  for (const a of asignaciones) {
    const lista = porEmpleado.get(a.empleadoId) ?? [];
    lista.push(aAsignacion(a));
    porEmpleado.set(a.empleadoId, lista);
  }
  return filas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    puesto: e.puesto,
    areaId: e.areaId,
    email: e.email,
    cargos: e.cargos,
    asignaciones: porEmpleado.get(e.id) ?? [],
    permisosDirectos: permisos.filter((p) => p.employeeId === e.id).map((p) => p.permission),
    ...(e.nota ? { nota: e.nota } : {}),
    ...(e.ficticio ? { ficticio: true } : {}),
  }));
}

/** Un usuario dado de baja no inicia sesión: por defecto no se encuentra. `incluirBajas` sirve para saber
 *  si el correo ya está ocupado. */
export async function empleadoPorEmail(email: string, { incluirBajas = false } = {}): Promise<EmpleadoConCorreo | null> {
  const porCorreo = eq(sql`lower(${t.empleado.email})`, email.toLowerCase());
  const [fila] = await db
    .select({ id: t.empleado.id })
    .from(t.empleado)
    .where(incluirBajas ? porCorreo : and(porCorreo, isNull(t.empleado.validTo)));
  return fila ? empleadoPorId(fila.id) : null;
}

export async function empleadoPorId(id: string): Promise<EmpleadoConCorreo | null> {
  const [e] = await db.select().from(t.empleado).where(eq(t.empleado.id, id));
  if (!e) return null;
  const [asignaciones, permisos] = await Promise.all([
    db.select().from(t.asignacion).where(eq(t.asignacion.empleadoId, id)).orderBy(asc(t.asignacion.validFrom), asc(t.asignacion.id)),
    db.select().from(t.employeePermissions).where(and(eq(t.employeePermissions.employeeId, id), isNull(t.employeePermissions.validTo))),
  ]);
  return {
    id: e.id,
    nombre: e.nombre,
    puesto: e.puesto,
    areaId: e.areaId,
    email: e.email,
    cargos: e.cargos,
    asignaciones: asignaciones.map(aAsignacion),
    permisosDirectos: permisos.map((p) => p.permission),
    ...(e.nota ? { nota: e.nota } : {}),
    ...(e.ficticio ? { ficticio: true } : {}),
  };
}

/* ----------------------------------------------------------------- rastro */

export async function cargarEventos(capacidadId: string, lector: Lector = db, limite = 500): Promise<Evento[]> {
  const filas = await lector
    .select()
    .from(t.evento)
    .where(eq(t.evento.capacidadId, capacidadId))
    .orderBy(desc(t.evento.cuando))
    .limit(limite);
  return filas.reverse().map((f) => ({
    accion: f.accion,
    nombreAccion: f.nombreAccion,
    tipo: f.tipo,
    actor: f.actor as Evento['actor'],
    canal: f.canal,
    cuando: f.cuando,
    regla: f.regla,
    entrada: f.entrada as Evento['entrada'],
    cambios: f.cambios as Evento['cambios'],
    ...(f.salida ? { salida: f.salida } : {}),
    ...(f.datos != null ? { datos: f.datos } : {}),
    emite: f.emite,
    ...(f.procedencia ? { procedencia: revivirProcedencia(f.procedencia) } : {}),
    ...(f.motivo ? { motivo: f.motivo } : {}),
  }));
}

/* jsonb devuelve las fechas como texto; el tipo del kit las quiere como Date. */
function revivirProcedencia(p: unknown): NonNullable<Evento['procedencia']> {
  const o = p as { fuente: string; efectivo: string; ingestado: string; escribio: string };
  return { fuente: o.fuente, efectivo: new Date(o.efectivo), ingestado: new Date(o.ingestado), escribio: o.escribio };
}

/* ------------------------------------------------------------- directorio */

const fecha = (d: string | null) => d; // `date` llega como 'YYYY-MM-DD'
const membresia = (m: { id: number; agencyId: number; validFrom: string; validTo: string | null }): Membresia => ({
  id: String(m.id),
  agenciaId: String(m.agencyId),
  desde: m.validFrom,
  hasta: fecha(m.validTo),
});

/** Agrupa las filas de una tabla de relación por la persona. */
function porPersona<T>(filas: T[], clave: (f: T) => number): Map<number, T[]> {
  const mapa = new Map<number, T[]>();
  for (const f of filas) mapa.set(clave(f), [...(mapa.get(clave(f)) ?? []), f]);
  return mapa;
}

export async function cargarDirectorio(): Promise<DirectorioCompleto> {
  const [agencias, arbol, agentes, relAgentes, reps, relReps, staff, relStaff, vendedores, relVendedores, bcs, equipo, lobs, etiquetas, empleados, baselines, legacy, documentos] = await Promise.all([
    db.select().from(t.agencies).orderBy(asc(t.agencies.name)),
    db.select().from(t.agencyTree),
    db.select().from(t.agents).orderBy(asc(t.agents.name)),
    db.select().from(t.agencyAgents),
    db.select().from(t.agencyRepresentatives).orderBy(asc(t.agencyRepresentatives.name)),
    db.select().from(t.agencyRepresentativeAgencies),
    db.select().from(t.staffMembers).orderBy(asc(t.staffMembers.name)),
    db.select().from(t.agencyStaff),
    db.select().from(t.discountSellers).orderBy(asc(t.discountSellers.name)),
    db.select().from(t.agencyDiscountSellers),
    db.select().from(t.benefitCoordinators).orderBy(asc(t.benefitCoordinators.name)),
    db.select().from(t.agencyWorkTeam).where(isNull(t.agencyWorkTeam.validTo)).orderBy(asc(t.agencyWorkTeam.validFrom)),
    db.select().from(t.agencyLobs).where(isNull(t.agencyLobs.validTo)).orderBy(asc(t.agencyLobs.lob)),
    db.select().from(t.agencyLabels).where(isNull(t.agencyLabels.validTo)).orderBy(asc(t.agencyLabels.validFrom)),
    db.select({ id: t.empleado.id, nombre: t.empleado.nombre, puesto: t.empleado.puesto }).from(t.empleado).where(isNull(t.empleado.validTo)).orderBy(asc(t.empleado.nombre)),
    cargarBaselinesVigentes(),
    db.select().from(t.agencyLegacyNegotiations).where(isNull(t.agencyLegacyNegotiations.validTo)).orderBy(asc(t.agencyLegacyNegotiations.validFrom)),
    db.select().from(t.paymentDocuments),
  ]);
  const deAgentes = porPersona(relAgentes, (r) => r.agentId);
  const deReps = porPersona(relReps, (r) => r.representativeId);
  const deStaff = porPersona(relStaff, (r) => r.staffMemberId);
  const deVendedores = porPersona(relVendedores, (r) => r.discountSellerId);
  const id = (n: number | null) => (n === null ? null : String(n));

  return {
    agencias: agencias.map<AgenciaDirectorio>((a) => ({
      id: String(a.id),
      nombre: a.name,
      parentId: id(a.parentId),
      companias: a.internalCompanies,
      npn: a.npn,
      taxId: a.taxId,
      estado: a.status,
      telefono: a.phone,
      inicio: a.startedAt,
      agentesUsanPortal: a.agentsUsePortal,
      alcanceComunicaciones: a.communicationsScope,
      alcanceReportes: a.reportsScope,
      cobraAgenteId: id(a.payeeAgentId),
      calle: a.addressStreet,
      ciudad: a.addressCity,
      estadoUS: a.addressState,
      zip: a.addressZip,
      lobs: lobs.filter((l) => l.agencyId === a.id).map((l) => ({ id: String(l.id), lob: l.lob })),
      etiquetas: etiquetas.filter((l) => l.agencyId === a.id).map((l) => ({ id: String(l.id), texto: l.label })),
      web: a.website,
      linkedin: a.linkedin,
      redes: a.socialMedia,
      tipoComision: a.commissionType,
      comisionPagadaA: a.commissionPaidTo,
      bonoPagadoA: a.bonusPaidTo,
      codigoPago: { claro: a.paymentCodeClaro, atoz: a.paymentCodeAtoz },
      legacy: a.isLegacy,
      negociacionesLegacy: legacy
        .filter((n) => n.agencyId === a.id)
        .map((n) => ({ id: String(n.id), compania: n.company, lob: n.lob, tasaAgente: n.agentRate, cargoAdministrativo: n.adminFee, detalle: n.detail, desde: n.validFrom })),
      demo: a.isDemo,
    })),
    equipoClaro: equipo.map((x) => {
      const e = empleados.find((y) => y.id === x.employeeId);
      return { id: String(x.id), agenciaId: String(x.agencyId), empleadoId: x.employeeId, nombre: e?.nombre ?? x.employeeId, puesto: e?.puesto ?? '', rol: x.role, desde: x.validFrom };
    }),
    empleados,
    baselines,
    documentosPago: documentos.map((x) => ({ titular: x.holderKind, titularId: String(x.holderId), documento: x.document, estado: x.status, revisado: x.reviewedAt, nota: x.note })),
    arbol: arbol.map((r) => ({ ancestroId: String(r.ancestorId), descendienteId: String(r.descendantId), profundidad: r.depth })),
    agentes: agentes.map((a) => ({
      id: String(a.id),
      nombre: a.name,
      npn: a.npn,
      email: a.email,
      telefono: a.phone,
      companias: a.internalCompanies,
      lobs: a.lobs,
      certificacionFFM: a.ffmCertified,
      codigoPago: { claro: a.paymentCodeClaro, atoz: a.paymentCodeAtoz },
      nota: a.note,
      demo: a.isDemo,
      agencias: (deAgentes.get(a.id) ?? []).map(membresia),
    })),
    representantes: reps.map((r) => ({
      id: String(r.id),
      nombre: r.name,
      agenteId: id(r.agentId),
      email: r.email,
      telefono: r.phone,
      demo: r.isDemo,
      agencias: (deReps.get(r.id) ?? []).map(membresia),
    })),
    staff: staff.map((s) => ({
      id: String(s.id),
      nombre: s.name,
      puesto: s.jobTitle,
      email: s.email,
      telefono: s.phone,
      demo: s.isDemo,
      agencias: (deStaff.get(s.id) ?? []).map(membresia),
    })),
    vendedores: vendedores.map((v) => ({
      id: String(v.id),
      codigoPago: { claro: v.paymentCodeClaro, atoz: v.paymentCodeAtoz },
      nombre: v.name,
      agenteId: id(v.agentId),
      email: v.email,
      telefono: v.phone,
      companias: v.internalCompanies,
      demo: v.isDemo,
      agencias: (deVendedores.get(v.id) ?? []).map(membresia),
    })),
    benefitCoordinators: bcs.map((b) => ({
      id: String(b.id),
      nombre: b.name,
      centroMedico: b.medicalCenter,
      email: b.email,
      telefono: b.phone,
      companias: b.internalCompanies,
      demo: b.isDemo,
    })),
  };
}

/* ---------------------------------------------------------- interacciones */

/** Todas las interacciones con agentes y agencias (Interaction · E-062), para la línea de tiempo. */
export async function cargarInteracciones(): Promise<Interaccion[]> {
  const filas = await db.select().from(t.interactions).orderBy(desc(t.interactions.occurredAt));
  return filas.map((i) => ({
    id: String(i.id),
    tipo: i.channel,
    direccion: i.direction,
    cuando: i.occurredAt.toISOString(),
    titulo: i.title,
    detalle: i.detail,
    agenteId: i.agentId === null ? null : String(i.agentId),
    agenciaId: i.agencyId === null ? null : String(i.agencyId),
    fuente: i.source,
  }));
}

/* ------------------------------------------------------------- baselines (H-018) */

/** Todas las filas, con su historia: un código desactivado y reactivado tiene más de una. */
export async function filasBaselines(lector: Lector = db): Promise<ValorBaseline[]> {
  const filas = await lector.select().from(t.baselines).orderBy(asc(t.baselines.name), desc(t.baselines.id));
  return filas.map((r) => ({ id: String(r.id), tipo: r.kind, codigo: r.code, nombre: r.name, lobs: r.lobs, roles: r.roles, padre: r.parent, areas: r.areas, estado: r.state, subregion: r.subregion, zips: r.zips, vigente: r.validTo === null, desde: r.validFrom, hasta: r.validTo }));
}

/** Para la pantalla de Baselines: un renglón por código, el vigente o el último que tuvo. */
export async function cargarBaselines(): Promise<ValorBaseline[]> {
  const vistos = new Set<string>();
  const filas = await filasBaselines();
  return [...filas.filter((v) => v.vigente), ...filas.filter((v) => !v.vigente)].filter((v) => {
    const clave = `${v.tipo}:${v.codigo}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** Las opciones vigentes que ofrecen los formularios del resto de la app. */
export async function cargarBaselinesVigentes(lector: Lector = db): Promise<BaselinesVigentes> {
  const filas = await lector.select().from(t.baselines).where(isNull(t.baselines.validTo)).orderBy(asc(t.baselines.name));
  const de = (tipo: ValorBaseline['tipo']): OpcionBaseline[] => filas.filter((r) => r.kind === tipo).map((r) => ({ codigo: r.code, nombre: r.name }));
  return {
    lobs: de('lob'),
    estados: de('state').sort((a, b) => a.codigo.localeCompare(b.codigo)),
    carriers: de('carrier'),
    cargos: filas.filter((r) => r.kind === 'cargo').map((r) => ({ codigo: r.code, nombre: r.name, roles: r.roles, areas: r.areas })),
    // Las áreas principales primero, cada una seguida de sus sub-áreas (H-038).
    areas: filas
      .filter((r) => r.kind === 'area')
      .map((r) => ({ codigo: r.code, nombre: r.name, padre: r.parent }))
      .sort((a, b) => (a.padre ?? a.codigo).localeCompare(b.padre ?? b.codigo) || (a.padre ? 1 : 0) - (b.padre ? 1 : 0) || a.nombre.localeCompare(b.nombre)),
    tiposComision: de('tipo-comision'),
    territorios: filas.filter((r) => r.kind === 'territorio').map((r) => ({ codigo: r.code, nombre: r.name, estado: r.state })),
  };
}

/* ------------------------------------------------------- Calendario (H-021) */

/** Todas las tareas con su tiempo y su historial, y los cronómetros corriendo. */
export async function cargarTareas(lector: Lector = db): Promise<{ tareas: Tarea[]; cronometros: Cronometro[] }> {
  const [filas, tiempos, historial, timers] = await Promise.all([
    lector.select().from(t.tasks).orderBy(asc(t.tasks.startDate), asc(t.tasks.id)),
    lector.select().from(t.taskTimeEntries).orderBy(asc(t.taskTimeEntries.date), asc(t.taskTimeEntries.id)),
    lector.select().from(t.taskStatusHistory).orderBy(asc(t.taskStatusHistory.at), asc(t.taskStatusHistory.id)),
    lector.select().from(t.taskTimers),
  ]);
  return {
    tareas: filas.map((r) => ({
      id: String(r.id),
      titulo: r.title,
      tipo: r.type,
      prioridad: r.priority,
      fechaInicio: r.startDate,
      fechaFin: r.endDate,
      estado: r.status,
      motivo: r.reason,
      creadaPor: r.createdBy,
      equipoId: r.team,
      responsableId: r.assigneeId,
      cliente: r.relatedKind && r.relatedId ? { tipo: r.relatedKind, id: r.relatedId, nombre: r.relatedName ?? r.relatedId } : null,
      descripcion: r.description,
      tiempo: tiempos
        .filter((x) => x.taskId === r.id)
        .map((x) => ({ id: String(x.id), empleadoId: x.employeeId, minutos: x.minutes, fecha: x.date, origen: x.origin, nota: x.note })),
      historial: historial
        .filter((x) => x.taskId === r.id)
        .map((x) => ({ estado: x.status, cuando: x.at.toISOString(), quien: x.employeeId ?? '', motivo: x.reason })),
    })),
    cronometros: timers.map((x) => ({ empleadoId: x.employeeId, tareaId: String(x.taskId), inicio: x.startedAt.toISOString() })),
  };
}

/* -------------------------------------------------- Lead Management (H-021) */

/** El pool comercial y sus interacciones. */
export async function cargarLeads(lector: Lector = db): Promise<{ leads: Lead[]; interacciones: InteraccionComercial[] }> {
  const [filas, ints] = await Promise.all([
    lector.select().from(t.leads).orderBy(desc(t.leads.leadDate), asc(t.leads.name)),
    lector.select().from(t.leadInteractions).orderBy(asc(t.leadInteractions.date), asc(t.leadInteractions.id)),
  ]);
  return {
    leads: filas.map((r) => ({
      id: String(r.id),
      nombre: r.name,
      tipo: r.type,
      lobs: r.lobs,
      fase: r.stage,
      disposicion: r.disposition,
      estado: r.status,
      motivo: r.reason,
      responsableId: r.assigneeId,
      fecha: r.leadDate,
      contacto: { nombre: r.contactName, telefono: r.contactPhone, email: r.contactEmail },
      contactoTipo: r.contactType,
      telefonos: r.phones,
      emails: r.emails,
      idiomas: r.languages,
      linkedin: r.linkedin,
      webs: r.websites,
      notas: r.notes,
      importacionId: r.importId === null ? null : String(r.importId),
      fuentes: (r.sources as Lead['fuentes']) ?? [],
      referidoPor: r.referredBy,
      prioridad: r.priority,
      territorio: r.territory,
      idioma: r.language,
      direccion: (r.address as Lead['direccion']) ?? null,
      centroMedico: r.medicalCenter,
      cierre: (r.closure as Lead['cierre']) ?? null,
      infoNegocio: (r.businessInfo as Lead['infoNegocio']) ?? null,
      cadencia: (r.cadence as Lead['cadencia']) ?? null,
      demo: r.isDemo,
    })),
    interacciones: ints.map((i) => ({
      id: String(i.id),
      leadId: String(i.leadId),
      tipo: i.type,
      fecha: i.date,
      estado: i.status,
      motivo: i.reason,
      empleadoId: i.employeeId,
      nombre: i.name,
      notas: i.notes,
      origen: i.origin,
      contactoNombre: i.contactName,
      primera: i.isFirst,
      seguimiento: i.isFollowUp,
      personaContactada: i.personContacted,
      disposicion: i.disposition,
      ordenRuta: i.routeOrder,
      resultado: i.result,
      familiaResultado: i.resultFamily,
      motivoResultado: i.resultReason,
      siguientePaso: i.nextStep,
    })),
  };
}

/** Agentes y agencias, solo id y nombre: para relacionar una tarea con un cliente. */
export async function cargarClientesDirectorio(lector: Lector = db): Promise<{ tipo: 'agente' | 'agencia'; id: string; nombre: string }[]> {
  const [ags, agcs] = await Promise.all([
    lector.select({ id: t.agents.id, nombre: t.agents.name }).from(t.agents).orderBy(asc(t.agents.name)),
    lector.select({ id: t.agencies.id, nombre: t.agencies.name }).from(t.agencies).orderBy(asc(t.agencies.name)),
  ]);
  return [...ags.map((a) => ({ tipo: 'agente' as const, id: String(a.id), nombre: a.nombre })), ...agcs.map((a) => ({ tipo: 'agencia' as const, id: String(a.id), nombre: a.nombre }))];
}

/** Las importaciones de leads, la más reciente primero (H-025). */
export async function cargarImportaciones(lector: Lector = db): Promise<ImportacionHecha[]> {
  const filas = await lector
    .select({ i: t.leadImports, por: t.empleado.nombre, borro: sql<string | null>`(SELECT nombre FROM empleado WHERE id = ${t.leadImports.deletedBy})` })
    .from(t.leadImports)
    .leftJoin(t.empleado, eq(t.empleado.id, t.leadImports.createdBy))
    .orderBy(desc(t.leadImports.createdAt));
  return filas.map(({ i, por, borro }) => ({
    id: String(i.id),
    tipo: i.type,
    archivo: i.fileName,
    por: por ?? i.createdBy,
    cuando: i.createdAt.toISOString(),
    total: i.totalRows,
    importados: i.imported,
    rechazados: i.rejected,
    errores: i.errors as ErrorFila[],
    eliminada: i.deletedAt ? { cuando: i.deletedAt.toISOString(), por: borro ?? i.deletedBy ?? '' } : null,
  }));
}

/* ------------------------------------------------------- campos por área (H-027) */

/** Los campos vigentes de todas las áreas y los valores vigentes de los usuarios activos. */
export async function cargarCamposArea(lector: Lector = db): Promise<{ campos: CampoArea[]; valores: ValorCampoArea[] }> {
  const [campos, valores] = await Promise.all([
    lector.select().from(t.areaFields).where(isNull(t.areaFields.validTo)).orderBy(asc(t.areaFields.area), asc(t.areaFields.position), asc(t.areaFields.id)),
    lector
      .select({ v: t.employeeAreaValues })
      .from(t.employeeAreaValues)
      .innerJoin(t.empleado, eq(t.empleado.id, t.employeeAreaValues.employeeId))
      .where(and(isNull(t.employeeAreaValues.validTo), isNull(t.empleado.validTo))),
  ]);
  return {
    campos: campos.map((c) => ({ id: String(c.id), area: c.area, etiqueta: c.label, tipo: c.type, fuente: c.source, opciones: c.options, obligatorio: c.required, orden: c.position, soloRoles: c.forRoles, soloSubareas: c.forSubareas, dependeDe: c.dependsOn === null ? null : String(c.dependsOn), dependeValor: c.dependsValue, filtradoPor: c.filterBy === null ? null : String(c.filterBy), vigente: true })),
    valores: valores.map(({ v }) => ({ id: String(v.id), empleadoId: v.employeeId, campoId: String(v.fieldId), valor: v.value, desde: v.validFrom.toISOString().slice(0, 10) })),
  };
}

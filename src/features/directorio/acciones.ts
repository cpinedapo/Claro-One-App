'use server';
/**
 * La única puerta de escritura de Gestión de agencias. Mismo patrón que Roles y Permisos: el
 * navegador manda acción y entrada; el actor sale de la sesión real; el contrato valida; se persiste
 * la diferencia y el evento queda en el rastro (también un rechazo).
 */
import { revalidatePath } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { actorPara } from '@/dominio/actor';
import { mensajesServidor } from '@/i18n/servidor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import type { Tx } from '@/server/db';
import {
  agencies, agencyAgents, agencyDiscountSellers, agencyLabels, agencyLobs, agencyRepresentativeAgencies, agencyRepresentatives, agencyStaff,
  agencyLegacyNegotiations, agencyWorkTeam, agents, discountSellers, empleado, staffMembers,
} from '@/server/db/schema';
import { cargarBaselinesVigentes } from '@/server/datos';
import { exigirEmpleadoParaEscribir } from '@/server/sesion';
import { RUTAS } from '@/routes/rutas';
import { CAPACIDAD_AGENCIAS } from './contrato';
import type { AgenciaContrato, Alta, EstadoAgencias, Operacion, PersonaContrato, TipoMiembro } from './contrato';

export type AccionAgencias =
  | 'crear-agencia' | 'editar-agencia' | 'agregar-agente' | 'agregar-equipo' | 'agregar-vendedor'
  | 'asignar-equipo-claro' | 'quitar-equipo-claro' | 'relacionar-lob' | 'quitar-lob' | 'relacionar-compania' | 'quitar-compania'
  | 'agregar-etiqueta' | 'quitar-etiqueta' | 'editar-persona' | 'quitar-de-agencia' | 'agregar-negociacion-legacy' | 'quitar-negociacion-legacy';

/** Agentes, representantes, staff y vendedores con sus agencias vigentes (H-020). */
async function cargarPersonas(tx: Tx): Promise<PersonaContrato[]> {
  const [ags, relAg, reps, relReps, stf, relStf, vend, relVend] = await Promise.all([
    tx.select().from(agents),
    tx.select().from(agencyAgents).where(isNull(agencyAgents.validTo)),
    tx.select().from(agencyRepresentatives),
    tx.select().from(agencyRepresentativeAgencies).where(isNull(agencyRepresentativeAgencies.validTo)),
    tx.select().from(staffMembers),
    tx.select().from(agencyStaff).where(isNull(agencyStaff.validTo)),
    tx.select().from(discountSellers),
    tx.select().from(agencyDiscountSellers).where(isNull(agencyDiscountSellers.validTo)),
  ]);
  const base = { npn: null, lobs: [], ffm: false, companias: [], puesto: null, agenteId: null, codigoPagoClaro: null, codigoPagoAtoz: null };
  const id = (n: number | null) => (n === null ? null : String(n));
  return [
    ...ags.map((a) => ({ ...base, tipo: 'agente' as const, id: String(a.id), nombre: a.name, email: a.email, telefono: a.phone, npn: a.npn, lobs: a.lobs, ffm: a.ffmCertified, companias: a.internalCompanies, codigoPagoClaro: a.paymentCodeClaro, codigoPagoAtoz: a.paymentCodeAtoz, agencias: relAg.filter((r) => r.agentId === a.id).map((r) => String(r.agencyId)) })),
    ...reps.map((r) => ({ ...base, tipo: 'representante' as const, id: String(r.id), nombre: r.name, email: r.email, telefono: r.phone, agenteId: id(r.agentId), agencias: relReps.filter((x) => x.representativeId === r.id).map((x) => String(x.agencyId)) })),
    ...stf.map((s) => ({ ...base, tipo: 'staff' as const, id: String(s.id), nombre: s.name, email: s.email, telefono: s.phone, puesto: s.jobTitle, agencias: relStf.filter((x) => x.staffMemberId === s.id).map((x) => String(x.agencyId)) })),
    ...vend.map((v) => ({ ...base, tipo: 'vendedor' as const, id: String(v.id), nombre: v.name, email: v.email, telefono: v.phone, agenteId: id(v.agentId), companias: v.internalCompanies, codigoPagoClaro: v.paymentCodeClaro, codigoPagoAtoz: v.paymentCodeAtoz, agencias: relVend.filter((x) => x.discountSellerId === v.id).map((x) => String(x.agencyId)) })),
  ];
}

async function cargar(tx: Tx): Promise<EstadoAgencias> {
  const [filas, agentes, vinculos, equipo, lobs, etiquetas, empleados, baselines, personas, legacy] = await Promise.all([
    tx.select().from(agencies),
    tx.select({ id: agents.id, npn: agents.npn, nombre: agents.name }).from(agents),
    tx.select({ agentId: agencyAgents.agentId, agencyId: agencyAgents.agencyId }).from(agencyAgents).where(isNull(agencyAgents.validTo)),
    tx.select().from(agencyWorkTeam).where(isNull(agencyWorkTeam.validTo)),
    tx.select().from(agencyLobs).where(isNull(agencyLobs.validTo)),
    tx.select().from(agencyLabels).where(isNull(agencyLabels.validTo)),
    tx.select({ id: empleado.id, nombre: empleado.nombre }).from(empleado),
    cargarBaselinesVigentes(tx),
    cargarPersonas(tx),
    tx.select().from(agencyLegacyNegotiations).where(isNull(agencyLegacyNegotiations.validTo)),
  ]);
  return {
    agencias: filas.map((a) => ({
      id: String(a.id),
      nombre: a.name,
      parentId: a.parentId === null ? null : String(a.parentId),
      estado: a.status,
      npn: a.npn,
      taxId: a.taxId,
      telefono: a.phone,
      inicio: a.startedAt,
      portal: a.agentsUsePortal,
      comunicaciones: a.communicationsScope,
      reportes: a.reportsScope,
      cobraAgenteId: a.payeeAgentId === null ? null : String(a.payeeAgentId),
      companias: a.internalCompanies,
      calle: a.addressStreet,
      ciudad: a.addressCity,
      estadoUS: a.addressState,
      zip: a.addressZip,
      web: a.website,
      linkedin: a.linkedin,
      redes: a.socialMedia,
      tipoComision: a.commissionType,
      comisionPagadaA: a.commissionPaidTo,
      bonoPagadoA: a.bonusPaidTo,
      codigoPagoClaro: a.paymentCodeClaro,
      codigoPagoAtoz: a.paymentCodeAtoz,
      legacy: a.isLegacy,
    })),
    agentes: agentes.map((a) => ({
      id: String(a.id),
      npn: a.npn,
      nombre: a.nombre,
      agencias: vinculos.filter((v) => v.agentId === a.id).map((v) => String(v.agencyId)),
    })),
    altas: [],
    operaciones: [],
    equipoClaro: equipo.map((x) => ({ id: String(x.id), agenciaId: String(x.agencyId), empleadoId: x.employeeId, rol: x.role })),
    lobs: lobs.map((x) => ({ id: String(x.id), agenciaId: String(x.agencyId), lob: x.lob })),
    etiquetas: etiquetas.map((x) => ({ id: String(x.id), agenciaId: String(x.agencyId), texto: x.label })),
    empleados,
    personas,
    legacy: legacy.map((n) => ({ id: String(n.id), agenciaId: String(n.agencyId), compania: n.company, lob: n.lob })),
    catalogo: { lobs: baselines.lobs.map((x) => x.codigo), estados: baselines.estados.map((x) => x.codigo), tiposComision: baselines.tiposComision.map((x) => x.codigo) },
  };
}

const aFila = (a: AgenciaContrato) => ({
  name: a.nombre,
  status: a.estado as (typeof agencies.$inferInsert)['status'],
  npn: a.npn,
  taxId: a.taxId,
  phone: a.telefono,
  startedAt: a.inicio,
  agentsUsePortal: a.portal,
  communicationsScope: a.comunicaciones as (typeof agencies.$inferInsert)['communicationsScope'],
  reportsScope: a.reportes as (typeof agencies.$inferInsert)['reportsScope'],
  payeeAgentId: a.cobraAgenteId === null ? null : Number(a.cobraAgenteId),
  internalCompanies: a.companias,
  addressStreet: a.calle,
  addressCity: a.ciudad,
  addressState: a.estadoUS,
  addressZip: a.zip,
  website: a.web,
  linkedin: a.linkedin,
  socialMedia: a.redes,
  commissionType: a.tipoComision,
  commissionPaidTo: a.comisionPagadaA as (typeof agencies.$inferInsert)['commissionPaidTo'],
  bonusPaidTo: a.bonoPagadoA as (typeof agencies.$inferInsert)['bonusPaidTo'],
  paymentCodeClaro: a.codigoPagoClaro,
  paymentCodeAtoz: a.codigoPagoAtoz,
  isLegacy: a.legacy,
});

/** Una alta: la persona (si es nueva) y su relación con la agencia, vigente desde hoy. */
async function escribirAlta(tx: Tx, a: Alta) {
  const agencyId = Number(a.agenciaId);
  const agentId = (id: string | null) => (id === null ? null : Number(id));
  switch (a.tipo) {
    case 'agente-existente':
      await tx.insert(agencyAgents).values({ agentId: Number(a.agenteId), agencyId });
      return;
    case 'agente-nuevo': {
      const [fila] = await tx
        .insert(agents)
        .values({ name: a.nombre, npn: a.npn, email: a.email, phone: a.telefono, lobs: a.lobs, ffmCertified: a.ffm, internalCompanies: a.companias, paymentCodeClaro: a.codigoPagoClaro, paymentCodeAtoz: a.codigoPagoAtoz })
        .returning({ id: agents.id });
      await tx.insert(agencyAgents).values({ agentId: fila!.id, agencyId });
      return;
    }
    case 'representante': {
      const [fila] = await tx
        .insert(agencyRepresentatives)
        .values({ name: a.nombre, agentId: agentId(a.agenteId), email: a.email, phone: a.telefono })
        .returning({ id: agencyRepresentatives.id });
      await tx.insert(agencyRepresentativeAgencies).values({ representativeId: fila!.id, agencyId });
      return;
    }
    case 'staff': {
      const [fila] = await tx
        .insert(staffMembers)
        .values({ name: a.nombre, jobTitle: a.puesto, email: a.email, phone: a.telefono })
        .returning({ id: staffMembers.id });
      await tx.insert(agencyStaff).values({ staffMemberId: fila!.id, agencyId });
      return;
    }
    case 'vendedor': {
      const [fila] = await tx
        .insert(discountSellers)
        .values({ name: a.nombre, agentId: agentId(a.agenteId), email: a.email, phone: a.telefono, internalCompanies: a.companias, paymentCodeClaro: a.codigoPagoClaro, paymentCodeAtoz: a.codigoPagoAtoz })
        .returning({ id: discountSellers.id });
      await tx.insert(agencyDiscountSellers).values({ discountSellerId: fila!.id, agencyId });
      return;
    }
  }
}

/** Una operación sobre las relaciones: alta vigente desde hoy, o cierre del intervalo (nunca se borra). */
async function escribirOperacion(tx: Tx, o: Operacion) {
  const hoy = sql`CURRENT_DATE`;
  switch (o.tipo) {
    case 'equipo-claro-alta':
      await tx.insert(agencyWorkTeam).values({ agencyId: Number(o.agenciaId), employeeId: o.empleadoId, role: o.rol as (typeof agencyWorkTeam.$inferInsert)['role'] });
      return;
    case 'equipo-claro-baja':
      await tx.update(agencyWorkTeam).set({ validTo: hoy }).where(eq(agencyWorkTeam.id, Number(o.id)));
      return;
    case 'lob-alta':
      await tx.insert(agencyLobs).values({ agencyId: Number(o.agenciaId), lob: o.lob });
      return;
    case 'lob-baja':
      await tx.update(agencyLobs).set({ validTo: hoy }).where(eq(agencyLobs.id, Number(o.id)));
      return;
    case 'etiqueta-alta':
      await tx.insert(agencyLabels).values({ agencyId: Number(o.agenciaId), label: o.texto });
      return;
    case 'etiqueta-baja':
      await tx.update(agencyLabels).set({ validTo: hoy }).where(eq(agencyLabels.id, Number(o.id)));
      return;
    case 'persona-edicion':
      await editarPersona(tx, o.persona);
      return;
    case 'legacy-alta':
      await tx.insert(agencyLegacyNegotiations).values({
        agencyId: Number(o.agenciaId), company: o.compania, lob: o.lob, agentRate: o.tasaAgente, adminFee: o.cargoAdministrativo, detail: o.detalle,
      });
      return;
    case 'legacy-baja':
      await tx.update(agencyLegacyNegotiations).set({ validTo: hoy }).where(eq(agencyLegacyNegotiations.id, Number(o.id)));
      return;
    case 'membresia-baja':
      await cerrarMembresia(tx, o.persona, Number(o.personaId), Number(o.agenciaId));
      return;
  }
}

/** Los datos de la persona, en su tabla. Sus relaciones con las agencias no cambian. */
async function editarPersona(tx: Tx, p: PersonaContrato) {
  const id = Number(p.id);
  const agentId = p.agenteId === null ? null : Number(p.agenteId);
  switch (p.tipo) {
    case 'agente':
      await tx.update(agents).set({ name: p.nombre, npn: p.npn!, email: p.email, phone: p.telefono, lobs: p.lobs, ffmCertified: p.ffm, internalCompanies: p.companias, paymentCodeClaro: p.codigoPagoClaro, paymentCodeAtoz: p.codigoPagoAtoz }).where(eq(agents.id, id));
      return;
    case 'representante':
      await tx.update(agencyRepresentatives).set({ name: p.nombre, agentId, email: p.email, phone: p.telefono }).where(eq(agencyRepresentatives.id, id));
      return;
    case 'staff':
      await tx.update(staffMembers).set({ name: p.nombre, jobTitle: p.puesto, email: p.email, phone: p.telefono }).where(eq(staffMembers.id, id));
      return;
    case 'vendedor':
      await tx.update(discountSellers).set({ name: p.nombre, agentId, email: p.email, phone: p.telefono, internalCompanies: p.companias, paymentCodeClaro: p.codigoPagoClaro, paymentCodeAtoz: p.codigoPagoAtoz }).where(eq(discountSellers.id, id));
      return;
  }
}

/** Quitar de la agencia cierra el intervalo de esa relación (`valid_to`): nunca se borra. */
async function cerrarMembresia(tx: Tx, tipo: TipoMiembro, personaId: number, agencyId: number) {
  const hoy = sql`CURRENT_DATE`;
  switch (tipo) {
    case 'agente':
      await tx.update(agencyAgents).set({ validTo: hoy }).where(and(eq(agencyAgents.agentId, personaId), eq(agencyAgents.agencyId, agencyId), isNull(agencyAgents.validTo)));
      return;
    case 'representante':
      await tx.update(agencyRepresentativeAgencies).set({ validTo: hoy }).where(and(eq(agencyRepresentativeAgencies.representativeId, personaId), eq(agencyRepresentativeAgencies.agencyId, agencyId), isNull(agencyRepresentativeAgencies.validTo)));
      return;
    case 'staff':
      await tx.update(agencyStaff).set({ validTo: hoy }).where(and(eq(agencyStaff.staffMemberId, personaId), eq(agencyStaff.agencyId, agencyId), isNull(agencyStaff.validTo)));
      return;
    case 'vendedor':
      await tx.update(agencyDiscountSellers).set({ validTo: hoy }).where(and(eq(agencyDiscountSellers.discountSellerId, personaId), eq(agencyDiscountSellers.agencyId, agencyId), isNull(agencyDiscountSellers.validTo)));
      return;
  }
}

/** Persiste lo que el contrato devolvió: agencias nuevas o editadas, altas y operaciones. */
async function persistir(tx: Tx, antes: EstadoAgencias, despues: EstadoAgencias) {
  const previas = new Map(antes.agencias.map((a) => [a.id, a]));
  for (const a of despues.agencias) {
    if (a.id === 'nueva') {
      await tx.insert(agencies).values({ ...aFila(a), parentId: a.parentId === null ? null : Number(a.parentId) });
    } else if (previas.get(a.id) !== a) {
      await tx.update(agencies).set(aFila(a)).where(eq(agencies.id, Number(a.id)));
    }
  }
  for (const alta of despues.altas) await escribirAlta(tx, alta);
  for (const o of despues.operaciones) await escribirOperacion(tx, o);
}

export async function ejecutarAgencias(accionId: AccionAgencias, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_AGENCIAS.acciones[accionId];
  if (!accion) return { ok: false, motivo: (await mensajesServidor()).servidor.accionNoDeclarada(accionId) };

  const r = await ejecutarYPersistir<EstadoAgencias>({
    capacidad: CAPACIDAD_AGENCIAS,
    accionId,
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada,
    cargar,
    persistir,
  });
  if (r.ok) revalidatePath(RUTAS.directorio);
  return r;
}

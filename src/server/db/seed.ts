/**
 * `pnpm db:seed` · Carga los datos de DEMOSTRACIÓN del kit (`@arc2-0/claro-one-kit/fixtures`):
 * los empleados de PB-002 con sus asignaciones, y el Directorio en el modelo de agencias (H-013).
 *
 * Son inventados sobre reglas y estructuras reales. Los empleados quedan marcados `ficticio` y SIN
 * correo, así que nadie puede iniciar sesión con ellos: sirven de datos para las pantallas.
 * Se niega a correr con NODE_ENV=production. Es idempotente: lo que ya existe no se toca, y el
 * Directorio se carga solo si está vacío. Igual el Calendario y Lead Management (H-021).
 */
import { EMPLEADOS } from '@arc2-0/claro-one-kit/fixtures';
import {
  AGENCIAS_DEMO, AGENTES_DEMO, BENEFIT_COORDINATORS_DEMO, INTERACCIONES_DEMO, REPRESENTANTES_DEMO, STAFF_DEMO, VENDEDORES_DEMO,
} from './demo-directorio';
import { sembrarLeads, sembrarTareas } from './demo-calendario-leads';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { crearDb } from './conexion';
import type { Tx } from './conexion';
import {
  agencies, agencyAgents, agencyDiscountSellers, agencyRepresentativeAgencies, agencyRepresentatives, agencyStaff, agents,
  asignacion, benefitCoordinators, discountSellers, empleado, interactions, paymentDocuments, staffMembers,
} from './schema';

if (process.env.NODE_ENV === 'production') {
  throw new Error('db:seed carga datos inventados: no corre con NODE_ENV=production.');
}

const { db, cerrar } = crearDb();

/** Direcciones, LOB, labels y equipo de trabajo de demo (H-017), si todavía no hay. */
async function sembrarRelaciones(tx: Tx): Promise<boolean> {
  const hay = await tx.execute(sql`SELECT 1 FROM agency_lobs LIMIT 1`);
  if (hay.length) return false;
  await tx.execute(sql.raw(readFileSync(new URL('./demo-relaciones.sql', import.meta.url), 'utf8')));
  return true;
}

/** Las interacciones de demo, con los ids reales de agentes (por NPN) y agencias (por clave de demo). */
async function sembrarInteracciones(tx: Tx, agentePorNpn: Map<string, number>, agenciaPorClave: Map<string, number>): Promise<number> {
  const filas = INTERACCIONES_DEMO.map((i) => ({
    channel: i.tipo,
    direction: i.direccion ?? null,
    occurredAt: new Date(i.cuando),
    title: i.titulo,
    detail: i.detalle ?? null,
    agentId: i.agente ? (agentePorNpn.get(i.agente) ?? null) : null,
    agencyId: i.agencia ? (agenciaPorClave.get(i.agencia) ?? null) : null,
    source: i.fuente ?? null,
    isDemo: true,
  })).filter((f) => (f.agentId === null) !== (f.agencyId === null));
  if (!filas.length) return 0;
  return (await tx.insert(interactions).values(filas).returning({ id: interactions.id })).length;
}

/** El cargo de cada empleado demo, del catálogo de Datos base (H-018). El kit trae puestos de texto
 *  libre; quien no tiene cargo equivalente (Coordinator) conserva el del kit. */
const CARGO_DEMO: Record<string, string> = {
  'emp-ricardo-leon': 'President',
  'emp-sara-delgado': 'Chief Operating Officer',
  'emp-ana-fuentes': 'BOB & Commission Manager',
  'emp-valentina-rios': 'Reconciliation Analyst',
  'emp-andres-cano': 'Contracting & Telco Manager',
  'emp-felipe-rojas': 'Financial Professional (Commission Advance)',
  'emp-jorge-nieto': 'New Business & Growth Manager',
  'emp-lucia-ramos': 'Life Specialist',
  'emp-diego-paredes': 'Medicare Manager',
  'emp-paula-vega': 'Customer Operation Specialist',
  'emp-camila-ortiz': 'Administrador IT',
};

/** Del área del kit al área de la organización (H-018); la misma regla que la migración 0014. */
const AREA_DE_KIT: Record<string, string> = {
  'bob-commissions': 'BOB & Commissions', commissions: 'BOB & Commissions', bob: 'BOB & Commissions', reconciliations: 'BOB & Commissions',
  'broker-support': 'Service', cos: 'Service', cms: 'Service',
  'contracting-telco': 'Contracting', telco: 'Contracting', contracting: 'Contracting',
  quality: 'Quality',
  vpf: 'Finance', financial: 'Finance', accounting: 'Finance',
  ceo: 'Strategy', 'vp-strategy': 'Strategy', coo: 'Strategy', bpl: 'Strategy', product: 'Strategy',
  'ceo-commercial': 'Commercial', 'new-business': 'Commercial', gr: 'Commercial', comercial: 'Commercial', 'internal-sales-dtc': 'Commercial',
};

/**
 * Documentos de pago de demo (H-024), si todavía no hay: para ver los tres estados en la ficha. Se aprueban en
 * el Onboarding; aquí solo se siembran.
 */
async function sembrarDocumentosPago(tx: Tx): Promise<number> {
  if ((await tx.select({ id: paymentDocuments.id }).from(paymentDocuments).limit(1)).length) return 0;
  const agencia = async (nombre: string) => (await tx.select({ id: agencies.id }).from(agencies).where(sql`${agencies.name} = ${nombre}`))[0]?.id;
  const agente = async (npn: string) => (await tx.select({ id: agents.id }).from(agents).where(sql`${agents.npn} = ${npn}`))[0]?.id;
  type Fila = typeof paymentDocuments.$inferInsert;
  const filas: Fila[] = [];
  const tres = (holderKind: Fila['holderKind'], holderId: number | undefined, estados: [Fila['status'], Fila['status'], Fila['status']]) => {
    if (holderId === undefined) return;
    (['w9', 'direct_deposit', 'voided_check'] as const).forEach((document, i) => {
      const status = estados[i]!;
      if (status === 'pendiente') return;
      filas.push({ holderKind, holderId, document, status, reviewedAt: status === 'aprobado' || status === 'rechazado' ? '2026-09-10' : null, isDemo: true });
    });
  };
  tres('agencia', await agencia('Distribuidora Claro'), ['aprobado', 'aprobado', 'aprobado']);
  tres('agencia', await agencia('Sol Insurance'), ['aprobado', 'aprobado', 'recibido']);
  tres('agente', await agente('18447106'), ['aprobado', 'aprobado', 'aprobado']);
  tres('agente', await agente('18447190'), ['aprobado', 'recibido', 'pendiente']);
  if (filas.length) await tx.insert(paymentDocuments).values(filas);
  return filas.length;
}

try {
  await db.transaction(async (tx) => {
    const emp = await tx
      .insert(empleado)
      .values(EMPLEADOS.map((e) => ({ id: e.id, nombre: e.nombre, puesto: CARGO_DEMO[e.id] ?? e.puesto, areaId: AREA_DE_KIT[e.areaId] ?? e.areaId, nota: e.nota ?? null, ficticio: true })))
      .onConflictDoNothing()
      .returning({ id: empleado.id });

    const asig = await tx
      .insert(asignacion)
      .values(
        EMPLEADOS.flatMap((e) =>
          e.asignaciones.map((a) => ({
            id: a.id,
            empleadoId: e.id,
            rolId: a.rolId,
            alcanceTipo: a.alcanceTipo,
            alcanceValor: a.alcanceValor,
            lob: a.lob,
            validFrom: a.desde ? new Date(a.desde) : new Date(),
            validTo: a.est === 'ok' ? null : new Date(),
          })),
        ),
      )
      .onConflictDoNothing()
      .returning({ id: asignacion.id });

    // ------------------------------------------------- Calendario y Lead Management (H-021)
    const idsEmpleados = new Set((await tx.select({ id: empleado.id }).from(empleado)).map((e) => e.id));
    const nTareas = await sembrarTareas(tx, idsEmpleados);
    const nLeads = await sembrarLeads(tx, idsEmpleados);
    console.log(`Calendario: ${nTareas} tareas · Lead Management: ${nLeads} leads (0 = ya tenía datos).`);

    // ---------------------------------------------------------------- Directorio
    // Las agencias no tienen una clave natural única: el Directorio de demo se carga una sola vez.
    const yaHay = await tx.select({ id: agencies.id }).from(agencies).limit(1);
    if (yaHay.length) {
      // Directorio ya cargado: solo se completan las interacciones si todavía no hay (llegaron después, H-014).
      const hayInteracciones = await tx.select({ id: interactions.id }).from(interactions).limit(1);
      let n = 0;
      if (!hayInteracciones.length) {
        const agentesDb = await tx.select({ id: agents.id, npn: agents.npn }).from(agents);
        const agenciasDb = await tx.select({ id: agencies.id, name: agencies.name }).from(agencies);
        const porNombre = new Map(agenciasDb.map((a) => [a.name, a.id]));
        const porClave = new Map(AGENCIAS_DEMO.filter((a) => porNombre.has(a.nombre)).map((a) => [a.clave, porNombre.get(a.nombre)!]));
        n = await sembrarInteracciones(tx, new Map(agentesDb.map((a) => [a.npn, a.id])), porClave);
      }
      await sembrarRelaciones(tx);
      console.log(`Documentos de pago: ${await sembrarDocumentosPago(tx)} (0 = ya había).`);
      console.log(`Demo cargada: ${emp.length} empleados, ${asig.length} asignaciones, ${n} interacciones. El resto del Directorio ya tenía datos: no se tocó.`);
      return;
    }

    // Agentes primero: las agencias los referencian (quién cobra).
    const agentesIns = await tx
      .insert(agents)
      .values(AGENTES_DEMO.map((a) => ({ name: a.nombre, npn: a.npn, internalCompanies: a.companias, lobs: a.lobs, ffmCertified: a.ffm, note: a.nota ?? null, isDemo: true })))
      .returning({ id: agents.id, npn: agents.npn });
    const agentePorNpn = new Map(agentesIns.map((a) => [a.npn, a.id]));

    // Agencias en orden de jerarquía: un hijo no entra antes que su padre (FK). El trigger arma agency_tree.
    const agenciaPorClave = new Map<string, number>();
    const pendientes = [...AGENCIAS_DEMO];
    while (pendientes.length) {
      const i = pendientes.findIndex((a) => !a.padre || agenciaPorClave.has(a.padre));
      const a = pendientes.splice(i < 0 ? 0 : i, 1)[0]!;
      const [fila] = await tx
        .insert(agencies)
        .values({
          name: a.nombre,
          parentId: a.padre ? (agenciaPorClave.get(a.padre) ?? null) : null,
          payeeAgentId: a.cobra ? (agentePorNpn.get(a.cobra) ?? null) : null,
          npn: a.npn,
          taxId: a.taxId,
          status: a.estado,
          phone: a.telefono,
          startedAt: a.inicio,
          agentsUsePortal: a.portal,
          communicationsScope: a.comunicaciones,
          reportsScope: a.reportes,
          internalCompanies: a.companias,
          isDemo: true,
        })
        .returning({ id: agencies.id });
      agenciaPorClave.set(a.clave, fila!.id);
    }
    const agencia = (clave: string) => agenciaPorClave.get(clave)!;

    const relAgentes = AGENTES_DEMO.flatMap((a) =>
      a.agencias.map((m) => ({ agentId: agentePorNpn.get(a.npn)!, agencyId: agencia(m.clave), validFrom: m.desde })),
    );
    if (relAgentes.length) await tx.insert(agencyAgents).values(relAgentes);

    for (const r of REPRESENTANTES_DEMO) {
      const [fila] = await tx
        .insert(agencyRepresentatives)
        .values({ name: r.nombre, agentId: r.agente ? (agentePorNpn.get(r.agente) ?? null) : null, isDemo: true })
        .returning({ id: agencyRepresentatives.id });
      for (const m of r.agencias) await tx.insert(agencyRepresentativeAgencies).values({ representativeId: fila!.id, agencyId: agencia(m.clave), validFrom: m.desde });
    }
    for (const s of STAFF_DEMO) {
      const [fila] = await tx.insert(staffMembers).values({ name: s.nombre, jobTitle: s.puesto ?? null, isDemo: true }).returning({ id: staffMembers.id });
      for (const m of s.agencias) await tx.insert(agencyStaff).values({ staffMemberId: fila!.id, agencyId: agencia(m.clave), validFrom: m.desde });
    }
    for (const v of VENDEDORES_DEMO) {
      const [fila] = await tx
        .insert(discountSellers)
        .values({ name: v.nombre, agentId: v.agente ? (agentePorNpn.get(v.agente) ?? null) : null, internalCompanies: v.companias ?? [], isDemo: true })
        .returning({ id: discountSellers.id });
      for (const m of v.agencias) await tx.insert(agencyDiscountSellers).values({ discountSellerId: fila!.id, agencyId: agencia(m.clave), validFrom: m.desde });
    }
    await tx.insert(benefitCoordinators).values(
      BENEFIT_COORDINATORS_DEMO.map((b) => ({ name: b.nombre, medicalCenter: b.centroMedico ?? null, internalCompanies: b.companias ?? [], isDemo: true })),
    );

    const interaccionesIns = await sembrarInteracciones(tx, agentePorNpn, agenciaPorClave);
    await sembrarRelaciones(tx);
    await sembrarDocumentosPago(tx);

    console.log(
      `Demo cargada: ${emp.length} empleados, ${asig.length} asignaciones, ${AGENCIAS_DEMO.length} agencias, ${agentesIns.length} agentes, ` +
        `${REPRESENTANTES_DEMO.length} representantes, ${STAFF_DEMO.length} staff, ${VENDEDORES_DEMO.length} vendedores, ${BENEFIT_COORDINATORS_DEMO.length} benefit coordinators, ${interaccionesIns} interacciones.`,
    );
  });
} finally {
  await cerrar();
}

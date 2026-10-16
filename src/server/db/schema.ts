/**
 * El modelo físico de Claro One en PostgreSQL.
 *
 * Qué vive aquí y qué no:
 * - **Datos transaccionales** (empleados, asignaciones, agencias, agentes, el rastro de eventos): aquí.
 * - **Catálogos** (los 5 roles, las áreas, los 15 Flujos, las compañías, los permisos): NO. Viajan
 *   compilados en `@arc2-0/claro-one-kit/dominio` y las columnas guardan su `id` como texto. Si el
 *   arnés cambia un catálogo, cambia el kit, no una tabla.
 * - **Excepción, los baselines** (carriers, estados, LOB): los administra el negocio desde
 *   Configuración, así que viven en `baselines` (H-018).
 *
 * Reglas del arnés que el esquema sostiene:
 * - **Atributos fechados**: `asignacion` lleva `valid_from` / `valid_to`. Revocar no borra ni
 *   sobreescribe: cierra el intervalo. Una revocación de hoy no reescribe qué permisos tenía esa
 *   persona el mes pasado (SPEC-FE-002 §4.1).
 * - **Rastro**: `evento` es append-only. Toda ejecución de un contrato de capability deja una fila
 *   con actor, canal, regla, cambios y procedencia (Change Event · E-091 + Provenance Record · E-090).
 */
import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const creado = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/* ----------------------------------------------------- Internal Actor · E-006 */

export const empleado = pgTable(
  'empleado',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    /** El primer cargo: el kit pide uno solo. Los cargos completos van en `cargos` (H-038). */
    puesto: text('puesto').notNull(),
    /** Los cargos de la persona (códigos de `cargo` en Datos base, H-038): de ellos salen su área y sus roles. */
    cargos: text('cargos').array().notNull().default(sql`'{}'::text[]`),
    /** El área (o sub-área) principal: la del primer cargo (Datos base, H-038). Los permisos y el menú NO salen
     *  de aquí sino de las asignaciones, que usan `AREAS` del kit. */
    areaId: text('area_id').notNull(),
    /** Correo corporativo con el que entra por Google. Sin correo, no puede iniciar sesión. */
    email: text('email'),
    nota: text('nota'),
    /** Dato inventado de demostración (seed). Nunca true en producción. */
    ficticio: boolean('ficticio').notNull().default(false),
    createdAt: creado(),
    /** Dado de baja («Eliminar usuario», H-019): desde esta fecha no entra ni tiene roles. No se borra: el
     *  rastro y las relaciones lo siguen nombrando. */
    validTo: date('valid_to'),
  },
  (t) => [uniqueIndex('empleado_email_uq').on(sql`lower(${t.email})`)],
);

/* ---------------------------------------------------- Assignment · HIPÓTESIS */

export const asignacion = pgTable(
  'asignacion',
  {
    id: text('id').primaryKey(),
    empleadoId: text('empleado_id').notNull().references(() => empleado.id),
    /** Id del catálogo `ROLES` del kit. */
    rolId: text('rol_id').notNull(),
    alcanceTipo: text('alcance_tipo', { enum: ['global', 'vertical', 'team', 'self'] }).notNull(),
    /** Id de `AREAS`; null si el alcance es global o self. */
    alcanceValor: text('alcance_valor'),
    lob: text('lob'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    /** null = activa. Con fecha = revocada desde ese momento. */
    validTo: timestamp('valid_to', { withTimezone: true }),
  },
  (t) => [index('asignacion_empleado_idx').on(t.empleadoId)],
);

/* ------------------------------------------- Change Event · E-091 (append-only) */

export const evento = pgTable(
  'evento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capacidadId: text('capacidad_id').notNull(),
    accion: text('accion').notNull(),
    nombreAccion: text('nombre_accion').notNull(),
    tipo: text('tipo', { enum: ['cambio', 'propuesta', 'consulta', 'rechazo'] }).notNull(),
    /** `Actor` del contrato: tipo, id, nombre, rol. */
    actor: jsonb('actor').notNull(),
    canal: text('canal', { enum: ['ui', 'api', 'evento', 'tool'] }).notNull(),
    cuando: timestamp('cuando', { withTimezone: true }).notNull(),
    regla: text('regla').notNull(),
    entrada: jsonb('entrada').notNull(),
    cambios: jsonb('cambios').notNull(),
    salida: text('salida'),
    datos: jsonb('datos'),
    emite: text('emite').array().notNull().default(sql`'{}'::text[]`),
    procedencia: jsonb('procedencia'),
    motivo: text('motivo'),
  },
  (t) => [index('evento_capacidad_cuando_idx').on(t.capacidadId, t.cuando)],
);

/* =============================================================== Directorio
   Modelo de agencias definido por el negocio (2026-10-13, H-013), con los nombres en inglés del
   diagrama. Las relaciones persona ↔ agencia son N a N y FECHADAS (valid_from / valid_to): una
   relación termina cerrando su intervalo, nunca se borra ni se sobrescribe. Sin relación vigente con
   ninguna agencia, la persona es independiente.

   Dos columnas que el diagrama no trae y la app necesita: `internal_companies` (Claro / AtoZ, RUL-038)
   e `is_demo` (dato inventado de demostración, nunca true en producción). */

const idInterno = () => bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity();
const desde = () => date('valid_from').notNull().defaultNow();
const hasta = () => date('valid_to');

/* ---------------------------------------------------------------- agents · E-002 */

export const agents = pgTable('agents', {
  id: idInterno(),
  name: text('name').notNull(),
  /** NPN: todo agente está licenciado. */
  npn: text('npn').notNull().unique(),
  email: text('email'),
  phone: text('phone'),
  internalCompanies: text('internal_companies').array().notNull(),
  lobs: text('lobs').array().notNull().default(sql`'{}'::text[]`),
  ffmCertified: boolean('ffm_certified').notNull().default(false),
  note: text('note'),
  /** Payment code por compañía en que produce (H-023): solo de sus compañías. */
  paymentCodeClaro: text('payment_code_claro'),
  paymentCodeAtoz: text('payment_code_atoz'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: creado(),
}, (t) => [
  check(
    'agents_payment_code_compania',
    sql`(${t.paymentCodeClaro} IS NULL OR 'claro' = ANY(${t.internalCompanies})) AND (${t.paymentCodeAtoz} IS NULL OR 'atoz' = ANY(${t.internalCompanies}))`,
  ),
]);

/* ------------------------------------------------------------- agencies · E-003 */

export const ESTADOS_AGENCIA = ['active', 'inactive', 'pending_contracting', 'pending_documents'] as const;
export const ALCANCES_COMUNICACIONES = ['parent_agency', 'agency'] as const;
export const ALCANCES_REPORTES = ['agency', 'agents_and_agency', 'agent'] as const;

export const agencies = pgTable(
  'agencies',
  {
    id: idInterno(),
    /** Agencia madre; null si es de primer nivel. Única fuente de verdad de la jerarquía:
        `agency_tree` se deriva de aquí con un trigger. */
    parentId: bigint('parent_id', { mode: 'number' }).references((): AnyPgColumn => agencies.id),
    /** El agente que cobra por la agencia. */
    payeeAgentId: bigint('payee_agent_id', { mode: 'number' }).references(() => agents.id),
    name: text('name').notNull(),
    /** NPN de la agencia como entidad. */
    npn: text('npn'),
    /** EIN, 9 dígitos. */
    taxId: text('tax_id'),
    status: text('status', { enum: ESTADOS_AGENCIA }).notNull(),
    /** 10 dígitos. */
    phone: text('phone'),
    /** Fecha de inicio con Claro. */
    startedAt: date('started_at'),
    /** Si los agentes de la agencia entran al ARC. */
    agentsUsePortal: boolean('agents_use_portal'),
    /** A quién se le mandan las comunicaciones. */
    communicationsScope: text('communications_scope', { enum: ALCANCES_COMUNICACIONES }),
    /** A quién se le mandan los reportes. */
    reportsScope: text('reports_scope', { enum: ALCANCES_REPORTES }),
    /** Dirección de la agencia (US). */
    addressStreet: text('address_street'),
    addressCity: text('address_city'),
    /** Estado de EE.UU., 2 letras. */
    addressState: text('address_state'),
    /** 5 dígitos. */
    addressZip: text('address_zip'),
    internalCompanies: text('internal_companies').array().notNull(),
    /* En línea (H-022). Enlaces http(s). */
    website: text('website'),
    linkedin: text('linkedin'),
    socialMedia: text('social_media').array().notNull().default(sql`'{}'::text[]`),
    /* Comisiones y pagos (H-022). El tipo de comisión es un código de Datos base (`tipo-comision`). */
    commissionType: text('commission_type'),
    /** Solo en la Master Agency: su jerarquía lo hereda (H-023). */
    commissionPaidTo: text('commission_paid_to', { enum: ['agencia', 'subagencia', 'agente'] }),
    bonusPaidTo: text('bonus_paid_to', { enum: ['agencia', 'subagencia', 'agente'] }),
    /** Payment code por compañía (Payment Account · E-051): solo de las compañías a las que pertenece. */
    paymentCodeClaro: text('payment_code_claro'),
    paymentCodeAtoz: text('payment_code_atoz'),
    /** Agencia legacy: puede tener negociaciones especiales tipo Legacy. */
    isLegacy: boolean('is_legacy').notNull().default(false),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    index('agencies_parent_idx').on(t.parentId),
    check(
      'agencies_paid_to',
      sql`(${t.commissionPaidTo} IS NULL OR ${t.commissionPaidTo} IN ('agencia', 'subagencia', 'agente')) AND (${t.bonusPaidTo} IS NULL OR ${t.bonusPaidTo} IN ('agencia', 'subagencia', 'agente'))`,
    ),
    check(
      'agencies_payment_code_compania',
      sql`(${t.paymentCodeClaro} IS NULL OR 'claro' = ANY(${t.internalCompanies})) AND (${t.paymentCodeAtoz} IS NULL OR 'atoz' = ANY(${t.internalCompanies}))`,
    ),
    check('agencies_tax_id_9', sql`${t.taxId} IS NULL OR ${t.taxId} ~ '^[0-9]{9}$'`),
    check('agencies_phone_10', sql`${t.phone} IS NULL OR ${t.phone} ~ '^[0-9]{10}$'`),
    check('agencies_zip_5', sql`${t.addressZip} IS NULL OR ${t.addressZip} ~ '^[0-9]{5}$'`),
    check('agencies_state_2', sql`${t.addressState} IS NULL OR ${t.addressState} ~ '^[A-Z]{2}$'`),
  ],
);

/** Tabla de clausura: una fila por par (ancestro, descendiente), incluida la agencia consigo misma
 *  con depth 0. No se escribe a mano: la mantiene el trigger `agencies_tree_sync` (migración 0005). */
export const agencyTree = pgTable(
  'agency_tree',
  {
    ancestorId: bigint('ancestor_id', { mode: 'number' }).notNull().references(() => agencies.id, { onDelete: 'cascade' }),
    descendantId: bigint('descendant_id', { mode: 'number' }).notNull().references(() => agencies.id, { onDelete: 'cascade' }),
    /** 0 = la misma, 1 = hija directa, 2 = nieta… */
    depth: integer('depth').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ancestorId, t.descendantId] }), index('agency_tree_descendant_idx').on(t.descendantId)],
);

export const agencyAgents = pgTable(
  'agency_agents',
  {
    id: idInterno(),
    agentId: bigint('agent_id', { mode: 'number' }).notNull().references(() => agents.id),
    /** Un agente puede estar en varias agencias a la vez. */
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_agents_agency_idx').on(t.agencyId), index('agency_agents_agent_idx').on(t.agentId)],
);

/* ---------------------------------------------------------- representantes */

export const agencyRepresentatives = pgTable('agency_representatives', {
  id: idInterno(),
  name: text('name').notNull(),
  /** Si el representante también es agente (y por eso tiene NPN). */
  agentId: bigint('agent_id', { mode: 'number' }).references(() => agents.id),
  email: text('email'),
  phone: text('phone'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: creado(),
});

export const agencyRepresentativeAgencies = pgTable(
  'agency_representative_agencies',
  {
    id: idInterno(),
    representativeId: bigint('representative_id', { mode: 'number' }).notNull().references(() => agencyRepresentatives.id),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_rep_agencies_agency_idx').on(t.agencyId)],
);

/* ------------------------------------------------- staff (análoga, H-013) */

export const staffMembers = pgTable('staff_members', {
  id: idInterno(),
  name: text('name').notNull(),
  jobTitle: text('job_title'),
  email: text('email'),
  phone: text('phone'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: creado(),
});

export const agencyStaff = pgTable(
  'agency_staff',
  {
    id: idInterno(),
    staffMemberId: bigint('staff_member_id', { mode: 'number' }).notNull().references(() => staffMembers.id),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_staff_agency_idx').on(t.agencyId)],
);

/* ------------------------------- vendedores de productos de descuento (análoga) */

export const discountSellers = pgTable('discount_sellers', {
  id: idInterno(),
  name: text('name').notNull(),
  /** Si el vendedor también es agente. */
  agentId: bigint('agent_id', { mode: 'number' }).references(() => agents.id),
  email: text('email'),
  phone: text('phone'),
  internalCompanies: text('internal_companies').array().notNull(),
  /** Payment code propio: solo el vendedor sin licencia (sin agente); el que es agente usa el suyo (H-023). */
  paymentCodeClaro: text('payment_code_claro'),
  paymentCodeAtoz: text('payment_code_atoz'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: creado(),
}, (t) => [
  check(
    'discount_sellers_payment_code',
    sql`(${t.agentId} IS NULL OR (${t.paymentCodeClaro} IS NULL AND ${t.paymentCodeAtoz} IS NULL)) AND (${t.paymentCodeClaro} IS NULL OR 'claro' = ANY(${t.internalCompanies})) AND (${t.paymentCodeAtoz} IS NULL OR 'atoz' = ANY(${t.internalCompanies}))`,
  ),
]);

export const agencyDiscountSellers = pgTable(
  'agency_discount_sellers',
  {
    id: idInterno(),
    discountSellerId: bigint('discount_seller_id', { mode: 'number' }).notNull().references(() => discountSellers.id),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_discount_sellers_agency_idx').on(t.agencyId)],
);

/* -------------------------------------------- benefit coordinators (sin agencia) */

export const benefitCoordinators = pgTable('benefit_coordinators', {
  id: idInterno(),
  name: text('name').notNull(),
  /** Hoy texto: si el centro médico es una entidad está por definir (H-010). */
  medicalCenter: text('medical_center'),
  email: text('email'),
  phone: text('phone'),
  internalCompanies: text('internal_companies').array().notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: creado(),
});

/* ------------------------------------------------- Better Auth (sesiones) */
/* Forma exigida por Better Auth. `user` es la identidad de login; quién es en el negocio lo dice
   `empleado`, enlazado por correo. */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------- Interaction · E-062 (Service) */
/* Cualquier contacto registrado entre Claro y un agente o una agencia: correo, mensaje del portal,
   llamada, SMS, chat, caso, aviso del carrier, sesión. Es un hecho con marca de tiempo: no tiene ciclo
   propio y nunca se edita. Alimenta la línea de tiempo unificada del Directorio (MN7, H-014).
   Hoy la escribe solo el seed; los módulos de correo, llamadas (Five9), casos y avisos escribirán
   aquí cuando existan. El sujeto es un agente O una agencia, nunca los dos. */

export const TIPOS_INTERACCION = ['correo', 'portal', 'llamada', 'sms', 'chat', 'caso', 'aviso', 'sesion'] as const;

export const interactions = pgTable(
  'interactions',
  {
    id: idInterno(),
    channel: text('channel', { enum: TIPOS_INTERACCION }).notNull(),
    /** Entró (la escribió el agente o la agencia) o salió (la escribió Claro). Null si no aplica. */
    direction: text('direction', { enum: ['entrada', 'salida'] }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    agentId: bigint('agent_id', { mode: 'number' }).references(() => agents.id),
    agencyId: bigint('agency_id', { mode: 'number' }).references(() => agencies.id),
    /** De qué sistema llegó (por ejemplo, «Five9»). */
    source: text('source'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    index('interactions_agent_idx').on(t.agentId, t.occurredAt),
    index('interactions_agency_idx').on(t.agencyId, t.occurredAt),
    check('interactions_un_sujeto', sql`(${t.agentId} IS NULL) <> (${t.agencyId} IS NULL)`),
    check('interactions_channel_valido', sql`${t.channel} IN ('correo', 'portal', 'llamada', 'sms', 'chat', 'caso', 'aviso', 'sesion')`),
  ],
);

/* ------------------------------------------- equipo de trabajo de Claro (H-017) */
/* Las personas de Claro asignadas a una agencia, con su rol (COS, Growth Specialist…). Fechado:
   quitar a alguien cierra el intervalo, no borra la fila. */

/** Los roles vigentes (0010). Una asignación cerrada puede guardar un rol que ya salió del catálogo. */
export const ROLES_EQUIPO_CLARO = ['cos', 'growth-specialist', 'lob-specialist'] as const;

export const agencyWorkTeam = pgTable(
  'agency_work_team',
  {
    id: idInterno(),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    employeeId: text('employee_id').notNull().references(() => empleado.id),
    role: text('role', { enum: ROLES_EQUIPO_CLARO }).notNull(),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_work_team_agency_idx').on(t.agencyId)],
);

/* ------------------------------------------------ líneas de negocio (H-017) */

export const agencyLobs = pgTable(
  'agency_lobs',
  {
    id: idInterno(),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    lob: text('lob').notNull(),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_lobs_agency_idx').on(t.agencyId)],
);

/* ----------------------------------------------------------- labels (H-017) */
/* Etiquetas libres de la agencia. Avisan, no bloquean (una restricción que bloquea es otra cosa). */

export const agencyLabels = pgTable(
  'agency_labels',
  {
    id: idInterno(),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    label: text('label').notNull(),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [index('agency_labels_agency_idx').on(t.agencyId)],
);

/* ------------------------------------------------------------ baselines (H-018) */
/* La información base del negocio que el Administrador mantiene desde Configuración: carriers,
   estados, líneas de negocio, cargos y áreas. Es el único catálogo que vive en la base (H-018): roles, áreas,
   Flujos, compañías y permisos siguen en el kit. Las tablas que los usan guardan su `code`.
   Desactivar cierra `valid_to`; reactivar abre una fila nueva con el mismo código. Nunca se borra. */

export const TIPOS_BASELINE = ['carrier', 'state', 'lob', 'cargo', 'area', 'tipo-comision', 'territorio'] as const;

export const baselines = pgTable(
  'baselines',
  {
    id: idInterno(),
    kind: text('kind', { enum: TIPOS_BASELINE }).notNull(),
    /** La llave que guardan las otras tablas. No cambia. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Solo carriers: las líneas de negocio que vende (códigos de `lob`). */
    lobs: text('lobs').array().notNull().default(sql`'{}'::text[]`),
    /** Solo cargos: los roles del catálogo del kit para los que aplica (doer, manager…). */
    roles: text('roles').array().notNull().default(sql`'{}'::text[]`),
    /** Solo áreas (H-038): el área a la que pertenece una sub-área. Vacío = área principal. */
    parent: text('parent'),
    /** Solo cargos (H-038): las áreas o sub-áreas donde trabaja quien lo tiene. */
    areas: text('areas').array().notNull().default(sql`'{}'::text[]`),
    /** Solo territorios (H-037): el estado (código de `state`) y sus ZIP codes. */
    state: text('state'),
    /** Solo territorios (H-039): la subregión (condado) dentro del estado. */
    subregion: text('subregion'),
    zips: text('zips').array().notNull().default(sql`'{}'::text[]`),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [
    uniqueIndex('baselines_vigente_uq').on(t.kind, t.code).where(sql`${t.validTo} IS NULL`),
    check('baselines_kind', sql`${t.kind} IN ('carrier', 'state', 'lob', 'cargo', 'area', 'tipo-comision', 'territorio')`),
    check('baselines_state_code', sql`${t.kind} <> 'state' OR ${t.code} ~ '^[A-Z]{2}$'`),
  ],
);

/* -------------------------------------------- Calendario · Task · E-063 (H-021) */
/* Tareas propias o para otro equipo (área de Datos base), con estado y motivo. El historial de estado y
   los registros de tiempo son append-only; el cronómetro corriendo es uno por persona. */

export const ESTADOS_TAREA = ['pendiente', 'en-curso', 'cerrada'] as const;
export const PRIORIDADES_TAREA = ['urgente', 'alta', 'normal', 'baja'] as const;
export const TIPOS_TAREA = ['tarea', 'reunion', 'llamada', 'visita', 'evento'] as const;

export const tasks = pgTable(
  'tasks',
  {
    id: idInterno(),
    title: text('title').notNull(),
    type: text('type', { enum: TIPOS_TAREA }).notNull(),
    priority: text('priority', { enum: PRIORIDADES_TAREA }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: text('status', { enum: ESTADOS_TAREA }).notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull().references(() => empleado.id),
    /** Código del área (Datos base) a la que se asignó; null si es propia. */
    team: text('team'),
    /** Quién la trabaja; null mientras está en la bandeja de un equipo. */
    assigneeId: text('assignee_id').references(() => empleado.id),
    relatedKind: text('related_kind', { enum: ['agente', 'agencia', 'lead'] }),
    relatedId: text('related_id'),
    relatedName: text('related_name'),
    description: text('description'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    index('tasks_assignee_idx').on(t.assigneeId),
    index('tasks_team_idx').on(t.team),
    check('tasks_fechas', sql`${t.endDate} >= ${t.startDate}`),
    check('tasks_status', sql`${t.status} IN ('pendiente', 'en-curso', 'cerrada')`),
    check('tasks_priority', sql`${t.priority} IN ('urgente', 'alta', 'normal', 'baja')`),
    check('tasks_type', sql`${t.type} IN ('tarea', 'reunion', 'llamada', 'visita', 'evento')`),
  ],
);

export const taskStatusHistory = pgTable(
  'task_status_history',
  {
    id: idInterno(),
    taskId: bigint('task_id', { mode: 'number' }).notNull().references(() => tasks.id),
    status: text('status', { enum: ESTADOS_TAREA }).notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    employeeId: text('employee_id').references(() => empleado.id),
    reason: text('reason').notNull(),
  },
  (t) => [index('task_status_history_task_idx').on(t.taskId)],
);

export const taskTimeEntries = pgTable(
  'task_time_entries',
  {
    id: idInterno(),
    taskId: bigint('task_id', { mode: 'number' }).notNull().references(() => tasks.id),
    employeeId: text('employee_id').notNull().references(() => empleado.id),
    minutes: integer('minutes').notNull(),
    date: date('date').notNull(),
    origin: text('origin', { enum: ['manual', 'cronometro'] }).notNull(),
    note: text('note'),
    createdAt: creado(),
  },
  (t) => [index('task_time_entries_task_idx').on(t.taskId), check('task_time_entries_minutes', sql`${t.minutes} > 0 AND ${t.minutes} <= 1440`)],
);

export const taskTimers = pgTable('task_timers', {
  employeeId: text('employee_id').primaryKey().references(() => empleado.id),
  taskId: bigint('task_id', { mode: 'number' }).notNull().references(() => tasks.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
});

/* ---------------------------------------------- Lead Management · Prospect (H-021) */
/* El pool comercial del prototipo: un registro por contacto que se mueve por fases. Contacto, fuentes,
   dirección y Business Information van como jsonb mientras el negocio no cierre su modelo (hipótesis). */

export const TIPOS_LEAD = ['agente', 'agencia', 'vendedor-sin-npn', 'benefit-coordinator'] as const;
export const FASES_LEAD = ['lead', 'onboarding', 'cliente'] as const;
export const ESTADOS_COMERCIALES = ['pending', 'waiting', 'ok', 'at-risk', 'blocked', 'neutral'] as const;

/** Una carga masiva de leads desde una plantilla .xlsx (H-025). Las filas rechazadas quedan con su motivo. */
export const leadImports = pgTable('lead_imports', {
  id: idInterno(),
  type: text('type', { enum: TIPOS_LEAD }).notNull(),
  fileName: text('file_name').notNull(),
  createdBy: text('created_by').notNull().references(() => empleado.id),
  totalRows: integer('total_rows').notNull(),
  imported: integer('imported').notNull(),
  rejected: integer('rejected').notNull(),
  /** [{ fila, campo, mensaje }] de las filas que no entraron. */
  errors: jsonb('errors').notNull().default(sql`'[]'::jsonb`),
  createdAt: creado(),
  /** Eliminada (H-026): sus leads se borran; la importación queda en el historial con quién y cuándo. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by').references(() => empleado.id),
});

export const leads = pgTable(
  'leads',
  {
    id: idInterno(),
    name: text('name').notNull(),
    type: text('type', { enum: TIPOS_LEAD }).notNull(),
    lobs: text('lobs').array().notNull().default(sql`'{}'::text[]`),
    stage: text('stage', { enum: FASES_LEAD }).notNull(),
    disposition: text('disposition'),
    status: text('status', { enum: ESTADOS_COMERCIALES }).notNull(),
    reason: text('reason').notNull(),
    assigneeId: text('assignee_id').references(() => empleado.id),
    leadDate: date('lead_date').notNull(),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    /* Contacto ampliado de las plantillas de importación (H-025). */
    contactType: text('contact_type'),
    phones: text('phones').array().notNull().default(sql`'{}'::text[]`),
    emails: text('emails').array().notNull().default(sql`'{}'::text[]`),
    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    linkedin: text('linkedin'),
    websites: text('websites').array().notNull().default(sql`'{}'::text[]`),
    notes: text('notes'),
    /** La importación de la que salió, si salió de una. */
    importId: bigint('import_id', { mode: 'number' }).references(() => leadImports.id),
    sources: jsonb('sources').notNull().default(sql`'[]'::jsonb`),
    referredBy: text('referred_by'),
    priority: text('priority'),
    territory: text('territory'),
    language: text('language'),
    address: jsonb('address'),
    medicalCenter: text('medical_center'),
    closure: jsonb('closure'),
    businessInfo: jsonb('business_info'),
    cadence: jsonb('cadence'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    index('leads_stage_idx').on(t.stage),
    check('leads_type', sql`${t.type} IN ('agente', 'agencia', 'vendedor-sin-npn', 'benefit-coordinator')`),
    check('leads_stage', sql`${t.stage} IN ('lead', 'onboarding', 'cliente')`),
    check('leads_status', sql`${t.status} IN ('pending', 'waiting', 'ok', 'at-risk', 'blocked', 'neutral')`),
  ],
);

export const TIPOS_INTERACCION_COMERCIAL = ['llamada', 'visita', 'reunion', 'evento'] as const;
export const RESULTADOS_INTERACCION = ['exitosa', 'no-interesado', 'sin-exito'] as const;

export const leadInteractions = pgTable(
  'lead_interactions',
  {
    id: idInterno(),
    leadId: bigint('lead_id', { mode: 'number' }).notNull().references(() => leads.id),
    type: text('type', { enum: TIPOS_INTERACCION_COMERCIAL }).notNull(),
    date: date('date').notNull(),
    status: text('status', { enum: ESTADOS_COMERCIALES }).notNull(),
    reason: text('reason').notNull(),
    employeeId: text('employee_id').references(() => empleado.id),
    name: text('name').notNull(),
    notes: text('notes'),
    origin: text('origin').notNull(),
    contactName: text('contact_name'),
    isFirst: boolean('is_first').notNull().default(false),
    isFollowUp: boolean('is_follow_up').notNull().default(false),
    personContacted: text('person_contacted'),
    disposition: text('disposition'),
    routeOrder: integer('route_order'),
    result: text('result', { enum: RESULTADOS_INTERACCION }),
    resultFamily: text('result_family', { enum: ['no-contactable', 'no-interesado'] }),
    resultReason: text('result_reason'),
    nextStep: text('next_step'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    index('lead_interactions_lead_idx').on(t.leadId),
    index('lead_interactions_date_idx').on(t.date),
    check('lead_interactions_type', sql`${t.type} IN ('llamada', 'visita', 'reunion', 'evento')`),
    check('lead_interactions_status', sql`${t.status} IN ('pending', 'waiting', 'ok', 'at-risk', 'blocked', 'neutral')`),
  ],
);

/* ------------------------------------------- negociaciones especiales Legacy (H-022) */
/* Una negociación especial de comisión tipo Legacy de una agencia legacy. Mismos datos que las
   negociaciones del prototipo (TIPOS_NEGOCIACION): compañía, LOB, tasa del agente, cargo administrativo
   y detalle. Fechada: quitarla cierra `valid_to`. */

export const agencyLegacyNegotiations = pgTable(
  'agency_legacy_negotiations',
  {
    id: idInterno(),
    agencyId: bigint('agency_id', { mode: 'number' }).notNull().references(() => agencies.id),
    company: text('company', { enum: ['claro', 'atoz'] }).notNull(),
    lob: text('lob').notNull(),
    /** Porcentaje de la comisión que recibe el agente, 0–100. */
    agentRate: numeric('agent_rate', { precision: 5, scale: 2, mode: 'number' }).notNull(),
    /** Cargo administrativo en USD. */
    adminFee: numeric('admin_fee', { precision: 10, scale: 2, mode: 'number' }),
    detail: text('detail').notNull(),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [
    index('agency_legacy_negotiations_agency_idx').on(t.agencyId),
    check('agency_legacy_rate', sql`${t.agentRate} >= 0 AND ${t.agentRate} <= 100`),
    check('agency_legacy_fee', sql`${t.adminFee} IS NULL OR ${t.adminFee} >= 0`),
  ],
);

/* ------------------------------------------------------- documentos de pago (H-024) */
/* W9, Direct Deposit y Voided Check de quien cobra (Payment Account · E-051: los documentos de pago verificados
   son la condición dura para pagar). Se revisan y aprueban en el Onboarding; el Directorio solo los muestra.
   Una fila por titular y documento, con su estado actual. */

export const DOCUMENTOS_PAGO = ['w9', 'direct_deposit', 'voided_check'] as const;
export const ESTADOS_DOCUMENTO_PAGO = ['pendiente', 'recibido', 'aprobado', 'rechazado'] as const;

export const paymentDocuments = pgTable(
  'payment_documents',
  {
    id: idInterno(),
    holderKind: text('holder_kind', { enum: ['agente', 'vendedor', 'agencia'] }).notNull(),
    holderId: bigint('holder_id', { mode: 'number' }).notNull(),
    document: text('document', { enum: DOCUMENTOS_PAGO }).notNull(),
    status: text('status', { enum: ESTADOS_DOCUMENTO_PAGO }).notNull(),
    /** Cuándo se revisó por última vez (aprobado o rechazado). */
    reviewedAt: date('reviewed_at'),
    note: text('note'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: creado(),
  },
  (t) => [
    uniqueIndex('payment_documents_uq').on(t.holderKind, t.holderId, t.document),
    check('payment_documents_holder', sql`${t.holderKind} IN ('agente', 'vendedor', 'agencia')`),
    check('payment_documents_document', sql`${t.document} IN ('w9', 'direct_deposit', 'voided_check')`),
    check('payment_documents_status', sql`${t.status} IN ('pendiente', 'recibido', 'aprobado', 'rechazado')`),
  ],
);

/* ------------------------------------------------------- campos por área (H-027) */
/* Los datos extra que cada área de la organización necesita de sus usuarios. Desactivar un campo cierra
   `valid_to`; un valor nuevo cierra el anterior: la historia de cada dato queda. */

export const TIPOS_CAMPO_AREA = ['texto', 'numero', 'fecha', 'si-no', 'lista', 'multi-lista'] as const;
export const FUENTES_CAMPO_AREA = ['propias', 'lob', 'carrier', 'state', 'territorio'] as const;

export const areaFields = pgTable(
  'area_fields',
  {
    id: idInterno(),
    /** Código del área de Datos base. */
    area: text('area').notNull(),
    label: text('label').notNull(),
    type: text('type', { enum: TIPOS_CAMPO_AREA }).notNull(),
    /** Listas: de dónde salen las opciones (las propias o un catálogo de Datos base). */
    source: text('source', { enum: FUENTES_CAMPO_AREA }).notNull().default('propias'),
    options: text('options').array().notNull().default(sql`'{}'::text[]`),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull().default(0),
    /** H-040 «Solo para»: el campo aplica a quien tiene uno de estos roles (vacío = a todos)… */
    forRoles: text('for_roles').array().notNull().default(sql`'{}'::text[]`),
    /** …en una de estas sub-áreas (vacío = en cualquiera del área). */
    forSubareas: text('for_subareas').array().notNull().default(sql`'{}'::text[]`),
    /** H-040 «Solo si»: el campo aparece cuando otro campo del área tiene este valor. */
    dependsOn: bigint('depends_on', { mode: 'number' }),
    dependsValue: text('depends_value'),
    /** H-041 «Filtrar opciones por»: una lista de territorios muestra solo los de los estados de este otro campo. */
    filterBy: bigint('filter_by', { mode: 'number' }),
    validFrom: desde(),
    validTo: hasta(),
  },
  (t) => [
    index('area_fields_area_idx').on(t.area),
    check('area_fields_type', sql`${t.type} IN ('texto', 'numero', 'fecha', 'si-no', 'lista', 'multi-lista')`),
    check('area_fields_source', sql`${t.source} IN ('propias', 'lob', 'carrier', 'state', 'territorio')`),
  ],
);

export const employeeAreaValues = pgTable(
  'employee_area_values',
  {
    id: idInterno(),
    employeeId: text('employee_id').notNull().references(() => empleado.id),
    fieldId: bigint('field_id', { mode: 'number' }).notNull().references(() => areaFields.id),
    value: text('value').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
  },
  (t) => [
    index('employee_area_values_employee_idx').on(t.employeeId),
    uniqueIndex('employee_area_values_vigente_uq').on(t.employeeId, t.fieldId).where(sql`${t.validTo} IS NULL`),
  ],
);

/* ------------------------------------------------------- permisos por persona (H-032) */
/* Los permisos que se encienden a una persona, uno por uno (hoy: los de Leads). Apagar cierra `valid_to`. */

export const employeePermissions = pgTable(
  'employee_permissions',
  {
    id: idInterno(),
    employeeId: text('employee_id').notNull().references(() => empleado.id),
    permission: text('permission').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
  },
  (t) => [
    index('employee_permissions_employee_idx').on(t.employeeId),
    uniqueIndex('employee_permissions_vigente_uq').on(t.employeeId, t.permission).where(sql`${t.validTo} IS NULL`),
  ],
);

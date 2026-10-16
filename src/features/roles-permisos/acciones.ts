'use server';
/**
 * La única puerta de escritura de Gestión de Roles y Permisos.
 *
 * El navegador manda QUÉ acción y CON QUÉ entrada. Quién la ejecuta y por qué canal lo decide el
 * servidor a partir de la sesión: un cliente no puede declararse Administrador.
 */
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { actorIA, actorPara } from '@/dominio/actor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import { DOMINIO_CORPORATIVO, esCorreoCorporativo } from '@/server/auth';
import { cargarBaselinesVigentes, cargarCamposArea, cargarEmpleados, empleadoPorEmail } from '@/server/datos';
import type { Tx } from '@/server/db';
import { agencyWorkTeam, areaFields, asignacion, empleado, employeeAreaValues, employeePermissions } from '@/server/db/schema';
import { RUTAS } from '@/routes/rutas';
import { mensajesServidor } from '@/i18n/servidor';
import { exigirEmpleadoParaEscribir } from '@/server/sesion';
import { CAPACIDAD } from './contrato';
import { CAPACIDAD_BAJA } from './contrato-baja';
import type { EstadoBaja } from './contrato-baja';
import { CAPACIDAD_CAMPOS_AREA } from './contrato-campos';
import { catalogosDe } from '@/dominio/camposArea';
import { areasPrincipales, perfilDeCargos } from '@/dominio/areas';
import { CAPACIDAD_EDICION } from './contrato-edicion';
import { CAPACIDAD_PERMISOS } from './contrato-permisos';
import type { EstadoPermisos } from './contrato-permisos';
import type { EstadoEdicion } from './contrato-edicion';
import type { EstadoCamposArea } from './contrato-campos';
import { cargarEstadoRoles, persistidor } from './persistencia';

export async function ejecutarRolesPermisos(accionId: string, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const { empleado } = quien;
  const m = await mensajesServidor();
  const accion = CAPACIDAD.acciones[accionId];
  if (!accion) return { ok: false, motivo: m.servidor.accionNoDeclarada(accionId) };

  // H-001: el contrato no pide correo, pero sin correo nadie puede entrar. Se valida aquí, antes
  // del contrato, y viaja en la entrada para que quede en el rastro.
  let email: string | undefined;
  let cargos: string[] | undefined;
  if (accionId === 'crear-usuario') {
    email = (entrada.email ?? '').trim().toLowerCase();
    if (!esCorreoCorporativo(email)) {
      return { ok: false, motivo: m.servidor.correoCorporativo(DOMINIO_CORPORATIVO) };
    }
    if (await empleadoPorEmail(email, { incluirBajas: true })) return { ok: false, motivo: m.servidor.correoExiste(email) };
    // H-038: los cargos deciden el cargo y el área que el contrato guarda. Los decide el servidor, no el navegador.
    const base = await cargarBaselinesVigentes();
    cargos = [...new Set((entrada.cargos ?? '').split('|').map((x) => x.trim()).filter(Boolean))];
    const ajeno = cargos.find((c) => !base.cargos.some((x) => x.codigo === c));
    if (!cargos.length || ajeno) return { ok: false, motivo: ajeno ? `El cargo «${ajeno}» no está vigente en Datos base.` : 'Elige al menos un cargo.' };
    entrada = { ...entrada, puesto: cargos[0]!, areaId: perfilDeCargos(cargos, base.cargos, base.areas).principal ?? '' };
  }

  const esIA = accionId === 'sugerir-asignacion';
  const r = await ejecutarYPersistir({
    capacidad: CAPACIDAD,
    accionId,
    actor: esIA ? actorIA(empleado) : actorPara(empleado, accion),
    canal: esIA ? 'tool' : 'ui',
    entrada: email ? { ...entrada, email } : entrada,
    cargar: cargarEstadoRoles,
    persistir: persistidor({ email, cargos }),
  });

  if (r.ok && r.modo === 'ejecuta' && r.evento.tipo === 'cambio') revalidatePath('/', 'layout');
  return r;
}

/* ------------------------------------------------------- baja de usuarios (H-019) */

async function cargarBaja(tx: Tx): Promise<EstadoBaja> {
  const empleados = await cargarEmpleados(tx);
  return {
    usuarios: empleados.map((e) => {
      const vigentes = e.asignaciones.filter((a) => a.est === 'ok');
      return { id: e.id, nombre: e.nombre, esAdministrador: vigentes.some((a) => a.rolId === 'configurador-admin'), asignacionesVigentes: vigentes.length };
    }),
    bajas: [],
  };
}

/** Dar de baja cierra; no borra. La persona, sus asignaciones y su equipo de trabajo quedan con fecha. */
async function persistirBaja(tx: Tx, _antes: EstadoBaja, despues: EstadoBaja) {
  for (const id of despues.bajas) {
    await tx.update(empleado).set({ validTo: sql`CURRENT_DATE` }).where(eq(empleado.id, id));
    await tx.update(asignacion).set({ validTo: sql`now()` }).where(and(eq(asignacion.empleadoId, id), isNull(asignacion.validTo)));
    await tx.update(agencyWorkTeam).set({ validTo: sql`CURRENT_DATE` }).where(and(eq(agencyWorkTeam.employeeId, id), isNull(agencyWorkTeam.validTo)));
  }
}

export async function eliminarUsuario(empleadoId: string): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_BAJA.acciones['eliminar-usuario'];
  const r = await ejecutarYPersistir<EstadoBaja>({
    capacidad: CAPACIDAD_BAJA,
    accionId: 'eliminar-usuario',
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada: { empleadoId },
    cargar: cargarBaja,
    persistir: persistirBaja,
  });
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}

/* ------------------------------------------------------- campos por área (H-027) */

export type AccionCamposArea = 'agregar-campo' | 'editar-campo' | 'desactivar-campo' | 'guardar-datos-area';

async function cargarCampos(tx: Tx): Promise<EstadoCamposArea> {
  const [empleados, baselines, { campos, valores }] = await Promise.all([cargarEmpleados(tx), cargarBaselinesVigentes(tx), cargarCamposArea(tx)]);
  return {
    areas: baselines.areas.map((a) => ({ codigo: a.codigo, padre: a.padre })),
    empleados: empleados.map((e) => ({ id: e.id, nombre: e.nombre, areas: areasPrincipales(e, baselines), roles: perfilDeCargos(e.cargos, baselines.cargos, baselines.areas).roles })),
    campos,
    catalogos: catalogosDe(baselines),
    valores,
    operaciones: [],
  };
}

/** Un campo nuevo abre su intervalo; desactivarlo lo cierra. Un valor nuevo cierra el anterior. Nada se borra. */
async function persistirCampos(tx: Tx, _antes: EstadoCamposArea, despues: EstadoCamposArea) {
  for (const o of despues.operaciones) {
    switch (o.tipo) {
      case 'alta':
        await tx.insert(areaFields).values({ area: o.campo.area, label: o.campo.etiqueta, type: o.campo.tipo, source: o.campo.fuente, options: o.campo.opciones, required: o.campo.obligatorio, position: o.campo.orden, forRoles: o.campo.soloRoles, forSubareas: o.campo.soloSubareas, dependsOn: o.campo.dependeDe === null ? null : Number(o.campo.dependeDe), dependsValue: o.campo.dependeValor, filterBy: o.campo.filtradoPor === null ? null : Number(o.campo.filtradoPor) });
        break;
      case 'edicion':
        await tx.update(areaFields).set({ label: o.etiqueta, options: o.opciones, required: o.obligatorio, forRoles: o.condiciones.soloRoles, forSubareas: o.condiciones.soloSubareas, dependsOn: o.condiciones.dependeDe === null ? null : Number(o.condiciones.dependeDe), dependsValue: o.condiciones.dependeValor, filterBy: o.condiciones.filtradoPor === null ? null : Number(o.condiciones.filtradoPor) }).where(eq(areaFields.id, Number(o.id)));
        break;
      case 'baja':
        await tx.update(areaFields).set({ validTo: sql`CURRENT_DATE` }).where(eq(areaFields.id, Number(o.id)));
        break;
      case 'valores':
        for (const v of o.valores) {
          await tx
            .update(employeeAreaValues)
            .set({ validTo: sql`now()` })
            .where(and(eq(employeeAreaValues.employeeId, o.empleadoId), eq(employeeAreaValues.fieldId, Number(v.campoId)), isNull(employeeAreaValues.validTo)));
          if (v.valor !== null) await tx.insert(employeeAreaValues).values({ employeeId: o.empleadoId, fieldId: Number(v.campoId), value: v.valor });
        }
        break;
    }
  }
}

export async function ejecutarCamposArea(accionId: AccionCamposArea, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_CAMPOS_AREA.acciones[accionId];
  if (!accion) return { ok: false, motivo: (await mensajesServidor()).servidor.accionNoDeclarada(accionId) };
  const r = await ejecutarYPersistir<EstadoCamposArea>({
    capacidad: CAPACIDAD_CAMPOS_AREA,
    accionId,
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada,
    cargar: cargarCampos,
    persistir: persistirCampos,
  });
  if (r.ok) revalidatePath(RUTAS.rolesPermisos);
  return r;
}

/* ------------------------------------------------------- edición de usuarios (H-030) */

async function cargarEdicion(tx: Tx): Promise<EstadoEdicion> {
  const [empleados, baselines] = await Promise.all([cargarEmpleados(tx), cargarBaselinesVigentes(tx)]);
  return {
    usuarios: empleados.map((e) => ({ id: e.id, nombre: e.nombre, cargos: e.cargos, puesto: e.puesto, area: e.areaId, email: e.email ?? null })),
    cargos: baselines.cargos,
    areas: baselines.areas,
    ediciones: [],
  };
}

async function persistirEdicion(tx: Tx, _antes: EstadoEdicion, despues: EstadoEdicion) {
  for (const u of despues.ediciones) {
    await tx.update(empleado).set({ nombre: u.nombre, puesto: u.puesto, cargos: u.cargos, areaId: u.area, email: u.email }).where(eq(empleado.id, u.id));
  }
}

export async function editarUsuario(entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const m = await mensajesServidor();
  // H-001: el correo es corporativo y único. Se revisa antes del contrato, como al crear.
  const email = (entrada.email ?? '').trim().toLowerCase();
  if (!esCorreoCorporativo(email)) return { ok: false, motivo: m.servidor.correoCorporativo(DOMINIO_CORPORATIVO) };
  const otro = await empleadoPorEmail(email, { incluirBajas: true });
  if (otro && otro.id !== entrada.empleadoId) return { ok: false, motivo: m.servidor.correoExiste(email) };

  const accion = CAPACIDAD_EDICION.acciones['editar-usuario'];
  const r = await ejecutarYPersistir<EstadoEdicion>({
    capacidad: CAPACIDAD_EDICION,
    accionId: 'editar-usuario',
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada: { ...entrada, email },
    cargar: cargarEdicion,
    persistir: persistirEdicion,
  });
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}

/* ------------------------------------------------------- permisos por persona (H-032) */

async function cargarPermisos(tx: Tx): Promise<EstadoPermisos> {
  const empleados = await cargarEmpleados(tx);
  return { usuarios: empleados.map((e) => ({ id: e.id, nombre: e.nombre, permisos: e.permisosDirectos })), cambios: [] };
}

/** Encender abre un intervalo; apagar lo cierra. Nada se borra. */
async function persistirPermisos(tx: Tx, _antes: EstadoPermisos, despues: EstadoPermisos) {
  for (const c of despues.cambios) {
    if (c.apagar.length) {
      await tx
        .update(employeePermissions)
        .set({ validTo: sql`now()` })
        .where(and(eq(employeePermissions.employeeId, c.empleadoId), inArray(employeePermissions.permission, c.apagar), isNull(employeePermissions.validTo)));
    }
    if (c.encender.length) await tx.insert(employeePermissions).values(c.encender.map((permission) => ({ employeeId: c.empleadoId, permission })));
  }
}

export async function definirPermisos(empleadoId: string, permisos: string[]): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_PERMISOS.acciones['definir-permisos'];
  const r = await ejecutarYPersistir<EstadoPermisos>({
    capacidad: CAPACIDAD_PERMISOS,
    accionId: 'definir-permisos',
    actor: actorPara(quien.empleado, accion),
    canal: 'ui',
    entrada: { empleadoId, permisos: permisos.join(',') },
    cargar: cargarPermisos,
    persistir: persistirPermisos,
  });
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}

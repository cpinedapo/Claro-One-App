'use server';
/**
 * La única puerta de escritura de Lead Management. Las sugerencias de la IA corren como agente de IA
 * por el canal `tool` en modo «propone»: dejan su evento en el rastro y no cambian nada (D-011).
 */
import { revalidatePath } from 'next/cache';
import { eq, inArray, sql } from 'drizzle-orm';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { actorIA, actorPara } from '@/dominio/actor';
import { mensajesServidor } from '@/i18n/servidor';
import { ejecutarYPersistir } from '@/server/capacidad';
import type { ResultadoEjecucion } from '@/server/capacidad';
import { cargarBaselinesVigentes, cargarCamposArea, cargarEmpleados, cargarImportaciones, cargarLeads, filasBaselines } from '@/server/datos';
import { candidatosDeLeads } from '@/dominio/territorioLeads';
import type { Tx } from '@/server/db';
import { leadImports, leadInteractions, leads } from '@/server/db/schema';
import { exigirEmpleadoParaEscribir } from '@/server/sesion';
import { RUTAS } from '@/routes/rutas';
import { leerPrimeraHoja } from '@/server/xlsx';
import { MAX_FILAS, TIPOS_IMPORTACION, claveLead, encabezadosDeHoja, filasDeHoja, validarImportacion } from '@/dominio/importacion';
import type { ErrorFila, FilaCruda, LeadImportado } from '@/dominio/importacion';
import type { TipoLead } from '@/dominio/leads';
import { permisosDe, tiene } from '@/dominio/permisos';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { CAPACIDAD_COMERCIAL } from './contrato';
import type { EstadoComercial, OperacionLead } from './contrato';

export type AccionComercial =
  | 'asignar-lead'
  | 'sugerir-asignacion-lead'
  | 'registrar-resultado-interaccion'
  | 'sugerir-resultado-interaccion'
  | 'crear-interaccion'
  | 'importar-leads'
  | 'eliminar-importacion'
  | 'asignar-territorios'
  | 'sugerir-territorios'
  | 'asignar-leads';
const DE_IA: AccionComercial[] = ['sugerir-asignacion-lead', 'sugerir-resultado-interaccion', 'sugerir-territorios'];

async function cargar(tx: Tx, quien: EmpleadoConCorreo): Promise<EstadoComercial> {
  const [{ leads: ls, interacciones }, empleados, baselines, importaciones, filas, { campos, valores }] = await Promise.all([
    cargarLeads(tx),
    cargarEmpleados(tx),
    cargarBaselinesVigentes(tx),
    cargarImportaciones(tx),
    filasBaselines(tx),
    cargarCamposArea(tx),
  ]);
  return {
    leads: ls, interacciones, empleados, hoy: new Date().toISOString().slice(0, 10), operaciones: [],
    catalogo: { lobs: baselines.lobs, estados: baselines.estados.map((e) => e.codigo) },
    importaciones,
    permisosActor: permisosDe(quien.permisosDirectos),
    territorios: filas.filter((v) => v.tipo === 'territorio' && v.vigente).map((v) => ({ codigo: v.codigo, nombre: v.nombre, estado: v.estado, zips: v.zips })),
    candidatos: candidatosDeLeads(empleados, baselines, campos, valores),
  };
}

async function escribir(tx: Tx, o: OperacionLead) {
  switch (o.tipo) {
    case 'asignar':
      await tx.update(leads).set({ assigneeId: o.empleadoId }).where(eq(leads.id, Number(o.leadId)));
      return;
    case 'territorio':
      await tx.update(leads).set({ territory: o.territorio }).where(eq(leads.id, Number(o.leadId)));
      return;
    case 'resultado':
      await tx
        .update(leadInteractions)
        .set({ result: o.resultado, resultFamily: o.familia, resultReason: o.motivo, nextStep: o.siguientePaso })
        .where(eq(leadInteractions.id, Number(o.interaccionId)));
      return;
    case 'eliminar-importacion':
      // Leads nunca trabajados (status «New», sin interacciones): salen. La importación queda, marcada.
      if (o.leadIds.length) await tx.delete(leads).where(inArray(leads.id, o.leadIds.map(Number)));
      await tx.update(leadImports).set({ deletedAt: sql`now()`, deletedBy: o.por }).where(eq(leadImports.id, Number(o.id)));
      return;
    case 'importar': {
      const im = o.importacion;
      const [fila] = await tx
        .insert(leadImports)
        .values({ type: im.tipo, fileName: im.archivo, createdBy: im.creadoPor, totalRows: im.total, imported: o.leads.length, rejected: new Set(im.errores.map((e) => e.fila)).size, errors: im.errores })
        .returning({ id: leadImports.id });
      const hoy = new Date().toISOString().slice(0, 10);
      // En lotes: una carga puede traer cientos de filas.
      for (let i = 0; i < o.leads.length; i += 200) {
        await tx.insert(leads).values(
          o.leads.slice(i, i + 200).map((l) => ({
            name: l.nombre, type: im.tipo, lobs: l.lobs, stage: 'lead' as const, disposition: l.disposicion, status: 'pending' as const,
            reason: `Importado de ${im.archivo}: todavía sin responsable`, leadDate: hoy,
            contactName: l.contactoNombre, contactPhone: l.telefonos[0] ?? null, contactEmail: l.emails[0] ?? null, contactType: l.contactoTipo,
            phones: l.telefonos, emails: l.emails, languages: l.idiomas, linkedin: l.linkedin, websites: l.webs, notes: l.notas,
            sources: l.fuente ? [{ origen: l.fuente, canal: '' }] : [], priority: l.prioridad, address: l.direccion, medicalCenter: l.centroMedico,
            businessInfo: l.infoNegocio, importId: fila!.id, territory: l.territorio ?? null,
          })),
        );
      }
      return;
    }
    case 'crear-interaccion': {
      const i = o.interaccion;
      await tx.insert(leadInteractions).values({
        leadId: Number(i.leadId), type: i.tipo, date: i.fecha, status: i.estado as (typeof leadInteractions.$inferInsert)['status'], reason: i.motivo,
        employeeId: i.empleadoId, name: i.nombre, notes: i.notas, origin: i.origen, contactName: i.contactoNombre,
      });
      return;
    }
  }
}

async function persistir(tx: Tx, _antes: EstadoComercial, despues: EstadoComercial) {
  for (const o of despues.operaciones) await escribir(tx, o);
}

export async function ejecutarComercial(accionId: AccionComercial, entrada: EntradaAccion): Promise<ResultadoEjecucion> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  const accion = CAPACIDAD_COMERCIAL.acciones[accionId];
  if (!accion) return { ok: false, motivo: (await mensajesServidor()).servidor.accionNoDeclarada(accionId) };
  const deIA = DE_IA.includes(accionId);
  const r = await ejecutarYPersistir<EstadoComercial>({
    capacidad: CAPACIDAD_COMERCIAL,
    accionId,
    actor: deIA ? actorIA(quien.empleado) : actorPara(quien.empleado, accion),
    canal: deIA ? 'tool' : 'ui',
    entrada,
    cargar: (tx) => cargar(tx, quien.empleado),
    persistir,
  });
  if (r.ok && r.modo === 'ejecuta' && r.evento.tipo === 'cambio') {
    revalidatePath(RUTAS.leads);
    revalidatePath(RUTAS.calendario);
  }
  return r;
}

/* ------------------------------------------------------------ importación (H-025) */

export interface VistaPrevia {
  ok: true;
  filas: FilaCruda[];
  /** Los encabezados del archivo, en su orden, con su campo interno. */
  encabezados: { clave: string; etiqueta: string }[];
  validos: { fila: number; lead: LeadImportado }[];
  errores: ErrorFila[];
}

/**
 * Lee el .xlsx y lo valida sin guardar nada: es lo que la persona revisa antes de importar. Solo lectura: el
 * contrato `importar-leads` vuelve a validar al importar.
 */
export async function previsualizarImportacion(datos: FormData): Promise<VistaPrevia | { ok: false; motivo: string }> {
  const quien = await exigirEmpleadoParaEscribir();
  if (!quien.ok) return { ok: false, motivo: quien.motivo };
  // Leer el archivo ya es importar: sin el permiso no se lee (H-032).
  if (!tiene(quien.empleado.permisosDirectos, 'leads.importar')) return { ok: false, motivo: 'No tienes el permiso «Leads: importar». Lo enciende un Administrador en Roles y Permisos.' };
  const tipo = String(datos.get('tipo') ?? '') as TipoLead;
  const archivo = datos.get('archivo');
  if (!TIPOS_IMPORTACION.includes(tipo)) return { ok: false, motivo: 'Elige el tipo de lead.' };
  if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith('.xlsx')) return { ok: false, motivo: 'Sube un archivo .xlsx de la plantilla.' };
  if (archivo.size > 5 * 1024 * 1024) return { ok: false, motivo: 'El archivo pasa de 5 MB.' };
  let hoja;
  try {
    hoja = leerPrimeraHoja(Buffer.from(await archivo.arrayBuffer()));
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo leer el archivo.' };
  }
  const r = filasDeHoja(tipo, hoja);
  if ('error' in r) return { ok: false, motivo: r.error };
  const encabezados = encabezadosDeHoja(hoja);
  if (!r.filas.length) return { ok: false, motivo: 'El archivo solo trae los encabezados: no tiene filas.' };
  if (r.filas.length > MAX_FILAS) return { ok: false, motivo: `Un archivo tiene hasta ${MAX_FILAS} filas.` };
  const [{ leads: ls }, baselines] = await Promise.all([cargarLeads(), cargarBaselinesVigentes()]);
  const existentes = new Set(ls.map((l) => claveLead(l.nombre, l.telefonos[0] ?? l.contacto.telefono)));
  const v = validarImportacion(tipo, r.filas, { lobs: baselines.lobs, estados: baselines.estados.map((e) => e.codigo) }, existentes);
  return { ok: true, filas: r.filas, encabezados, ...v };
}

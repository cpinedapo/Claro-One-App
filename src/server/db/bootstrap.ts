/**
 * `pnpm db:bootstrap` · Crea el primer Administrador (rol `configurador-admin`), con alcance global.
 *
 * Sirve en cualquier ambiente, producción incluida: alguien tiene que poder entrar a dar de alta a
 * los demás. Es idempotente: si ese correo ya tiene la asignación activa, no hace nada. Deja su
 * propio evento en el rastro, con actor `automation`, para que el origen del primer admin se pueda
 * auditar como cualquier otro cambio.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { crearDb } from './conexion';
import { asignacion, empleado, evento } from './schema';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const nombre = process.env.BOOTSTRAP_ADMIN_NOMBRE?.trim() || 'Administrador';
if (!email) throw new Error('Falta BOOTSTRAP_ADMIN_EMAIL en .env.local.');

const { db, cerrar } = crearDb();

try {
  await db.transaction(async (tx) => {
    let [emp] = await tx.select().from(empleado).where(eq(sql`lower(${empleado.email})`, email));
    if (!emp) {
      const id = 'u-' + email.split('@')[0]!.replace(/[^a-z0-9]+/g, '-');
      [emp] = await tx.insert(empleado).values({ id, nombre, puesto: 'Administrador', areaId: 'plataforma', email }).returning();
      console.log(`Empleado creado: ${emp!.id} <${email}>`);
    }
    const yaEsAdmin = await tx
      .select({ id: asignacion.id })
      .from(asignacion)
      .where(and(eq(asignacion.empleadoId, emp!.id), eq(asignacion.rolId, 'configurador-admin'), isNull(asignacion.validTo)));
    if (yaEsAdmin.length) {
      console.log(`${email} ya es Administrador. Nada que hacer.`);
      return;
    }
    const total = await tx.select({ id: asignacion.id }).from(asignacion).where(eq(asignacion.empleadoId, emp!.id));
    const asignacionId = `${emp!.id}-a${total.length + 1}`;
    const cuando = new Date();
    await tx.insert(asignacion).values({
      id: asignacionId, empleadoId: emp!.id, rolId: 'configurador-admin', alcanceTipo: 'global', validFrom: cuando,
    });
    await tx.insert(evento).values({
      capacidadId: 'gestion-de-roles-y-permisos',
      accion: 'asignar-rol',
      nombreAccion: 'Asignar rol',
      tipo: 'cambio',
      actor: { tipo: 'automation', id: 'db-bootstrap', nombre: 'Arranque de la plataforma' },
      canal: 'evento',
      cuando,
      regla: 'Arranque: el primer Administrador no puede asignárselo nadie desde la UI',
      entrada: { empleadoId: emp!.id, rolId: 'configurador-admin', alcanceTipo: 'global' },
      cambios: [{ entidad: 'Assignment · hipótesis', id: asignacionId, de: '—', a: 'configurador-admin · global', motivo: 'Bootstrap' }],
      emite: ['assignment.created'],
      procedencia: { fuente: 'pnpm db:bootstrap', efectivo: cuando, ingestado: cuando, escribio: 'Automatización · db-bootstrap' },
    });
    console.log(`${email} ahora es Administrador con alcance global.`);
  });
} finally {
  await cerrar();
}

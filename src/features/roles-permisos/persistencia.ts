/**
 * Gestión de Roles y Permisos ↔ PostgreSQL.
 *
 * `cargar` arma el `EstadoRoles` que el contrato espera; `persistir` escribe la diferencia entre el
 * estado de antes y el que devolvió el contrato. Se diffea en vez de reescribir porque el contrato
 * trabaja sobre el estado completo, y la base sobre filas: una asignación revocada se CIERRA
 * (`valid_to`), no se borra ni se pisa.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import type { Evento } from '@arc2-0/claro-one-kit/capacidad';
import type { Asignacion } from '@arc2-0/claro-one-kit/dominio';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import type { Tx } from '@/server/db';
import { asignacion, empleado } from '@/server/db/schema';
import { cargarEmpleados, cargarEventos } from '@/server/datos';
import { CAPACIDAD } from './contrato';
import type { EstadoRoles } from './contrato';

export async function cargarEstadoRoles(tx?: Tx): Promise<EstadoRoles & { empleados: EmpleadoConCorreo[] }> {
  const [empleados, eventos] = await Promise.all([cargarEmpleados(tx), cargarEventos(CAPACIDAD.def.id, tx)]);
  return { empleados, eventos };
}

/** Lo que el producto agrega a una ejecución y el contrato no conoce (H-001: el correo). */
export interface ExtrasRoles {
  email?: string;
  /** H-038: los cargos con los que nace (el contrato de PB-002 solo conoce uno, `puesto`). */
  cargos?: string[];
}

export function persistidor(extras: ExtrasRoles = {}) {
  return async (tx: Tx, antes: EstadoRoles, despues: EstadoRoles, evento: Evento) => {
    const previos = new Map(antes.empleados.map((e) => [e.id, e]));

    for (const emp of despues.empleados) {
      const previo = previos.get(emp.id);

      if (!previo) {
        await tx.insert(empleado).values({
          id: emp.id,
          nombre: emp.nombre,
          puesto: emp.puesto,
          areaId: emp.areaId,
          email: extras.email ?? null,
          cargos: extras.cargos ?? [emp.puesto],
          // El contrato marca `ficticio` a todo lo que crea porque nació en un prototipo. Aquí lo
          // crea una persona real, desde la plataforma: no es ficticio.
          ficticio: false,
        });
      }

      const asignacionesPrevias = new Map<string, Asignacion>((previo?.asignaciones ?? []).map((a) => [a.id, a]));
      for (const a of emp.asignaciones) {
        const p = asignacionesPrevias.get(a.id);
        if (!p) {
          await tx.insert(asignacion).values({
            id: a.id,
            empleadoId: emp.id,
            rolId: a.rolId,
            alcanceTipo: a.alcanceTipo,
            alcanceValor: a.alcanceValor,
            lob: a.lob,
            validFrom: evento.cuando,
          });
        } else if (p.est === 'ok' && a.est === 'neutral') {
          await tx.update(asignacion).set({ validTo: evento.cuando }).where(eq(asignacion.id, a.id));
        }
      }
    }
  };
}

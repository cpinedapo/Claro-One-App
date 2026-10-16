import { Pagina } from '@/components/Comunes';
import { actorPara } from '@/dominio/actor';
import { CAPACIDAD_COMERCIAL } from '@/features/leads/contrato';
import { mensajesServidor } from '@/i18n/servidor';
import { cargarBaselinesVigentes, cargarClientesDirectorio, cargarEmpleados, cargarLeads, cargarTareas } from '@/server/datos';
import { exigirEmpleado } from '@/server/sesion';
import { CalendarioConectado } from './CalendarioConectado';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.calendario };
}

/* Mi espacio › Calendario: todo interno con sesión tiene el suyo (NAV-R23). */
export default async function PaginaCalendario() {
  const { empleado, sesion } = await exigirEmpleado();
  const m = await mensajesServidor();
  const [{ tareas, cronometros }, empleados, baselines, { leads, interacciones }, clientes] = await Promise.all([
    cargarTareas(),
    cargarEmpleados(),
    cargarBaselinesVigentes(),
    cargarLeads(),
    cargarClientesDirectorio(),
  ]);

  const nombreLead = new Map(leads.map((l) => [l.id, l.nombre]));
  const accionInteraccion = CAPACIDAD_COMERCIAL.acciones['crear-interaccion']!;
  const puedeInteraccion = !sesion.viendoComo && CAPACIDAD_COMERCIAL.permiso(accionInteraccion, actorPara(empleado, accionInteraccion)).ok;

  return (
    <Pagina titulo={m.paginas.calendario}>
      <CalendarioConectado
        puede={!sesion.viendoComo}
        leads={puedeInteraccion ? leads.filter((l) => l.fase === 'lead').map((l) => ({ id: l.id, nombre: l.nombre })) : []}
        datos={{
          hoy: new Date().toISOString().slice(0, 10),
          empleado,
          empleados,
          tareas,
          cronometros,
          // Las interacciones con leads que son mías entran a mi calendario: es la misma cola, no una copia.
          interacciones: interacciones
            .filter((i) => i.empleadoId === empleado.id)
            .map((i) => ({ id: i.id, leadNombre: nombreLead.get(i.leadId) ?? '—', tipo: i.tipo, fecha: i.fecha, estado: i.estado, motivo: i.motivo, nombre: i.nombre, notas: i.notas, contactoNombre: i.contactoNombre })),
          areas: baselines.areas,
          clientes: [...clientes, ...leads.map((l) => ({ tipo: 'lead' as const, id: l.id, nombre: l.nombre }))],
        }}
      />
    </Pagina>
  );
}

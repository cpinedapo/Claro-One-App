import { flujoPorId, nombreArea, puedeVerFlujo } from '@arc2-0/claro-one-kit/dominio';
import { FueraDeAlcance, Pagina } from '@/components/Comunes';
import { actorPara } from '@/dominio/actor';
import { tiene } from '@/dominio/permisos';
import { PantallaLeads } from '@/features/leads/components/Leads';
import { CAPACIDAD_COMERCIAL } from '@/features/leads/contrato';
import { mensajesServidor } from '@/i18n/servidor';
import { cargarEmpleados, cargarImportaciones, cargarLeads, filasBaselines } from '@/server/datos';
import { CAPACIDAD_BASELINES } from '@/features/baselines/contrato';
import { ejecutarBaselines } from '@/features/baselines/acciones';
import { exigirEmpleado } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.leads };
}

/* Lead Management es el Flujo `lead-conversion` del kit: lo ve quien tiene alcance sobre su área dueña. */
export default async function PaginaLeads() {
  const { empleado, sesion } = await exigirEmpleado();
  const m = await mensajesServidor();
  const flujo = flujoPorId('lead-conversion')!;
  // Sin «ver» ni «importar» no hay nada que mostrarle (H-032).
  const ver = tiene(empleado.permisosDirectos, 'leads.ver');
  const importar = tiene(empleado.permisosDirectos, 'leads.importar');
  if (!puedeVerFlujo(empleado, flujo) || (!ver && !importar)) {
    return (
      <Pagina titulo={m.paginas.leads}>
        <FueraDeAlcance nombre={empleado.nombre} que={`«${m.paginas.leads}»`} />
      </Pagina>
    );
  }
  const [{ leads, interacciones }, empleados, importaciones, filas] = await Promise.all([cargarLeads(), cargarEmpleados(), cargarImportaciones(), filasBaselines()]);
  // Los territorios de Datos base y quién puede crearlos o agregarles ZIP (H-042). La página compone las dos
  // features: Leads no importa Datos base.
  const territorios = filas.filter((v) => v.tipo === 'territorio' && v.vigente).map((v) => ({ id: v.id, codigo: v.codigo, nombre: v.nombre, estado: v.estado, subregion: v.subregion, zips: v.zips }));
  const accionTerritorio = CAPACIDAD_BASELINES.acciones['editar-valor']!;
  const puedeTerritorios = !sesion.viendoComo && CAPACIDAD_BASELINES.permiso(accionTerritorio, actorPara(empleado, accionTerritorio)).ok;

  const editar = tiene(empleado.permisosDirectos, 'leads.editar');
  // Un botón existe solo si el contrato le concede la acción a quien mira. En «Ver como» nunca.
  const puede = (id: 'asignar-lead' | 'registrar-resultado-interaccion' | 'importar-leads') => {
    const accion = CAPACIDAD_COMERCIAL.acciones[id]!;
    return !sesion.viendoComo && CAPACIDAD_COMERCIAL.permiso(accion, actorPara(empleado, accion)).ok;
  };

  return (
    <Pagina titulo={m.paginas.leads} subtitulo={nombreArea(flujo.areaDuenaId)}>
      <PantallaLeads
        // Sin «ver», solo llegan los leads de las importaciones (su detalle) y ninguna interacción.
        datos={{ hoy: new Date().toISOString().slice(0, 10), leads: ver ? leads : leads.filter((l) => l.importacionId), interacciones: ver ? interacciones : [], empleados, yo: empleado, importaciones, territorios }}
        gestionarTerritorio={ejecutarBaselines}
        permisos={{
          territorios: puedeTerritorios,
          ver,
          verImportaciones: importar,
          asignar: editar && puede('asignar-lead'),
          trabajar: editar && puede('registrar-resultado-interaccion'),
          importar: importar && puede('importar-leads'),
        }}
      />
    </Pagina>
  );
}

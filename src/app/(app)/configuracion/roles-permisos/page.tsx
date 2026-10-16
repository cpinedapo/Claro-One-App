import { esConfiguradorAdmin } from '@arc2-0/claro-one-kit/dominio';
import { actorPara } from '@/dominio/actor';
import { catalogosDe } from '@/dominio/camposArea';
import { CAPACIDAD_BAJA } from '@/features/roles-permisos/contrato-baja';
import { CAPACIDAD_CAMPOS_AREA } from '@/features/roles-permisos/contrato-campos';
import { FueraDeAlcance, Pagina } from '@/components/Comunes';
import { RolesPermisosConectado } from '@/features/roles-permisos/components/RolesPermisosConectado';
import { cargarEstadoRoles } from '@/features/roles-permisos/persistencia';
import { DOMINIO_CORPORATIVO } from '@/server/auth';
import { mensajesServidor } from '@/i18n/servidor';
import { cargarBaselinesVigentes, cargarCamposArea } from '@/server/datos';
import { exigirEmpleado } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.rolesPermisos };
}

export default async function PaginaRolesPermisos() {
  const { empleado, sesion } = await exigirEmpleado();
  const m = await mensajesServidor();
  const titulo = m.paginas.rolesPermisos;
  if (!esConfiguradorAdmin(empleado)) {
    return (
      <Pagina titulo={titulo}>
        <FueraDeAlcance nombre={empleado.nombre} que={titulo} />
      </Pagina>
    );
  }
  const [estado, baselines, camposArea] = await Promise.all([cargarEstadoRoles(), cargarBaselinesVigentes(), cargarCamposArea()]);
  // «Eliminar» existe solo si el contrato se lo concede a quien mira (Administrador), y nunca en «Ver como».
  const accionEliminar = CAPACIDAD_BAJA.acciones['eliminar-usuario']!;
  const puedeEliminar = !sesion.viendoComo && CAPACIDAD_BAJA.permiso(accionEliminar, actorPara(empleado, accionEliminar)).ok;
  // Campos por área (H-027): mismo criterio, con su propio contrato.
  const accionCampos = CAPACIDAD_CAMPOS_AREA.acciones['guardar-datos-area']!;
  const puedeCampos = !sesion.viendoComo && CAPACIDAD_CAMPOS_AREA.permiso(accionCampos, actorPara(empleado, accionCampos)).ok;
  return (
    <Pagina titulo={titulo}>
      <RolesPermisosConectado estado={estado} empleadoActual={empleado} dominioCorreo={DOMINIO_CORPORATIVO} cargos={baselines.cargos} areas={baselines.areas} puedeEliminar={puedeEliminar} campos={camposArea.campos} valores={camposArea.valores} puedeCampos={puedeCampos} catalogos={catalogosDe(baselines)} />
    </Pagina>
  );
}

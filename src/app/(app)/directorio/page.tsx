import { Pagina } from '@/components/Comunes';
import { actorPara } from '@/dominio/actor';
import { CAPACIDAD_AGENCIAS } from '@/features/directorio/contrato';
import { PantallaDirectorio } from '@/features/directorio/components/Directorio';
import { mensajesServidor } from '@/i18n/servidor';
import { cargarDirectorio, cargarInteracciones } from '@/server/datos';
import { exigirEmpleado } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.directorio };
}

/* Todo interno con sesión ve el Directorio (como en PB-002, grupo Transversal). Si el negocio lo
   acota por alcance, la regla entra aquí y en `construirMenu`, no en la pantalla. */
export default async function PaginaDirectorio() {
  const { empleado, sesion } = await exigirEmpleado();
  const [directorio, interacciones, m] = await Promise.all([cargarDirectorio(), cargarInteracciones(), mensajesServidor()]);

  // Un botón existe solo si el contrato le concede la acción a quien mira (regla dura 5 del kit).
  // En «Ver como» nunca: es de solo lectura.
  const puede = (id: 'crear-agencia' | 'editar-agencia' | 'agregar-agente' | 'asignar-equipo-claro' | 'editar-persona') => {
    const accion = CAPACIDAD_AGENCIAS.acciones[id]!;
    return !sesion.viendoComo && CAPACIDAD_AGENCIAS.permiso(accion, actorPara(empleado, accion)).ok;
  };

  return (
    <Pagina titulo={m.paginas.directorio}>
      <PantallaDirectorio
        directorio={directorio}
        interacciones={interacciones}
        permisos={{ crearAgencia: puede('crear-agencia'), editarAgencia: puede('editar-agencia'), agregarPersonas: puede('agregar-agente'), relaciones: puede('asignar-equipo-claro'), editarPersonas: puede('editar-persona') }}
      />
    </Pagina>
  );
}

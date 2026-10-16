'use client';
/** Ata la pantalla a sus escrituras. La pantalla no sabe que hay un servidor detrás. */
import type { AreaOpcion, CargoOpcion } from '@/dominio/baselines';
import type { CampoArea, CatalogosCampos, ValorCampoArea } from '@/dominio/camposArea';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { useCamposArea } from '../useCamposArea';
import { useRolesPermisos } from '../useRolesPermisos';
import { PantallaRolesPermisos } from './RolesPermisos';
import type { EstadoRolesConCorreo } from './RolesPermisos';

export function RolesPermisosConectado({
  estado,
  empleadoActual,
  dominioCorreo,
  cargos,
  areas,
  puedeEliminar,
  campos,
  valores,
  puedeCampos,
  catalogos,
}: {
  estado: EstadoRolesConCorreo;
  empleadoActual: EmpleadoConCorreo;
  dominioCorreo: string;
  cargos: CargoOpcion[];
  areas: AreaOpcion[];
  puedeEliminar: boolean;
  campos: CampoArea[];
  valores: ValorCampoArea[];
  puedeCampos: boolean;
  catalogos: CatalogosCampos;
}) {
  const { ejecutar, eliminar, editar, definirPermisos } = useRolesPermisos();
  const ejecutarCampos = useCamposArea();
  return (
    <PantallaRolesPermisos
      estado={estado}
      ejecutar={ejecutar}
      eliminar={eliminar}
      editar={editar}
      definirPermisos={definirPermisos}
      empleadoActual={empleadoActual}
      dominioCorreo={dominioCorreo}
      cargos={cargos}
      areas={areas}
      puedeEliminar={puedeEliminar}
      campos={campos}
      valores={valores}
      puedeCampos={puedeCampos}
      ejecutarCampos={ejecutarCampos}
      catalogos={catalogos}
    />
  );
}

import { asignacionesActivas } from '@arc2-0/claro-one-kit/dominio';
import { Pagina } from '@/components/Comunes';
import { PantallaInicio } from '@/features/inicio/components/Inicio';
import { cargarEmpleados } from '@/server/datos';
import { mensajesServidor } from '@/i18n/servidor';
import { exigirEmpleado } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.inicio };
}

export default async function PaginaInicio() {
  const { empleado } = await exigirEmpleado();
  const empleados = await cargarEmpleados();
  const m = await mensajesServidor();
  return (
    <Pagina titulo={m.paginas.inicio}>
      <PantallaInicio
        empleado={empleado}
        totalUsuarios={empleados.length}
        totalAsignacionesActivas={empleados.reduce((n, e) => n + asignacionesActivas(e).length, 0)}
      />
    </Pagina>
  );
}

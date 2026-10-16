import type { ReactNode } from 'react';
import { esConfiguradorAdmin } from '@arc2-0/claro-one-kit/dominio';
import ShellCliente from '@/components/layout/ShellCliente';
import { BarraVerComo, PanelVerComo } from '@/features/soporte/components/VerComo';
import { cargarEmpleados } from '@/server/datos';
import { exigirEmpleado } from '@/server/sesion';

/** Todo lo que vive dentro del shell exige sesión y un empleado enlazado. */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const { empleado, sesion } = await exigirEmpleado();

  // «Ver como» lo decide quien inició sesión de verdad, no la persona que se está viendo.
  const real = sesion.real;
  const puedeVerComo = !!real && esConfiguradorAdmin(real);
  const opciones = puedeVerComo
    ? (await cargarEmpleados())
        .filter((e) => e.id !== real.id)
        .map((e) => ({ value: e.id, label: `${e.nombre} · ${e.puesto}` }))
    : [];

  return (
    <ShellCliente
      empleado={empleado}
      simulada={sesion.simulada}
      {...(puedeVerComo
        ? {
            pieMenu: (
              <PanelVerComo opciones={opciones} viendoAId={sesion.viendoComo ? empleado.id : null} />
            ),
          }
        : {})}
    >
      {sesion.viendoComo && <BarraVerComo nombre={empleado.nombre} puesto={empleado.puesto} />}
      {children}
    </ShellCliente>
  );
}

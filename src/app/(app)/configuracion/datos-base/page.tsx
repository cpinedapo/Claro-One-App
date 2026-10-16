import { esConfiguradorAdmin } from '@arc2-0/claro-one-kit/dominio';
import { FueraDeAlcance, Pagina } from '@/components/Comunes';
import { actorPara } from '@/dominio/actor';
import { PantallaBaselines } from '@/features/baselines/components/Baselines';
import { CAPACIDAD_BASELINES } from '@/features/baselines/contrato';
import { mensajesServidor } from '@/i18n/servidor';
import { cargarBaselines } from '@/server/datos';
import { exigirEmpleado } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.baselines };
}

export default async function PaginaBaselines() {
  const { empleado, sesion } = await exigirEmpleado();
  const m = await mensajesServidor();
  const titulo = m.paginas.baselines;
  if (!esConfiguradorAdmin(empleado)) {
    return (
      <Pagina titulo={titulo}>
        <FueraDeAlcance nombre={empleado.nombre} que={titulo} />
      </Pagina>
    );
  }
  // Un botón existe solo si el contrato le concede la acción a quien mira. En «Ver como» nunca.
  const accion = CAPACIDAD_BASELINES.acciones['agregar-valor']!;
  const puede = !sesion.viendoComo && CAPACIDAD_BASELINES.permiso(accion, actorPara(empleado, accion)).ok;
  return (
    <Pagina titulo={titulo}>
      <PantallaBaselines valores={await cargarBaselines()} puede={puede} />
    </Pagina>
  );
}

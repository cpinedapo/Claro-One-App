import { notFound } from 'next/navigation';
import { flujoPorId, nombreArea, puedeVerFlujo } from '@arc2-0/claro-one-kit/dominio';
import { FueraDeAlcance, Pagina } from '@/components/Comunes';
import { PantallaFlujoReferencia } from '@/features/flujos/components/FlujoReferencia';
import { exigirEmpleado } from '@/server/sesion';

export default async function PaginaFlujo({ params }: { params: Promise<{ flujoId: string }> }) {
  const { flujoId } = await params;
  const flujo = flujoPorId(flujoId);
  if (!flujo) notFound();
  const { empleado } = await exigirEmpleado();
  const titulo = flujo.nombre.replace(' end-to-end', '');

  return (
    <Pagina titulo={titulo} subtitulo={nombreArea(flujo.areaDuenaId)}>
      {puedeVerFlujo(empleado, flujo) ? (
        <PantallaFlujoReferencia flujo={flujo} />
      ) : (
        <FueraDeAlcance nombre={empleado.nombre} que={`«${titulo}»`} />
      )}
    </Pagina>
  );
}

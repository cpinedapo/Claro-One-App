import { notFound } from 'next/navigation';
import { Pagina, ModuloPendiente } from '@/components/Comunes';
import { mensajesServidor } from '@/i18n/servidor';
import type { Mensajes } from '@/i18n/mensajes';
import { exigirEmpleado } from '@/server/sesion';

type Clave = keyof Mensajes['modulos'];

/** Destinos del menú que todavía no se construyen (NAV-R23): nunca una pantalla vacía sin razón. */
export async function generateMetadata({ params }: { params: Promise<{ clave: string }> }) {
  const m = await mensajesServidor();
  const modulo = m.modulos[(await params).clave as Clave];
  return { title: modulo?.titulo ?? m.paginas.inicio };
}

export default async function PaginaModulo({ params }: { params: Promise<{ clave: string }> }) {
  await exigirEmpleado();
  const m = await mensajesServidor();
  const modulo = m.modulos[(await params).clave as Clave];
  if (!modulo) notFound();
  return (
    <Pagina titulo={modulo.titulo}>
      <ModuloPendiente titulo={modulo.vacio} motivo={modulo.motivo} />
    </Pagina>
  );
}

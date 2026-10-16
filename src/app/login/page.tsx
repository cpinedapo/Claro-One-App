import { redirect } from 'next/navigation';
import { PantallaLogin } from '@/features/acceso/components/Acceso';
import { mensajesServidor } from '@/i18n/servidor';
import { DOMINIO_CORPORATIVO } from '@/server/auth';
import { sesionActual } from '@/server/sesion';
import { RUTAS } from '@/routes/rutas';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.login };
}

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sesion = await sesionActual();
  if (sesion) redirect(sesion.empleado ? RUTAS.inicio : RUTAS.sinAcceso);
  const { error } = await searchParams;
  return (
    <PantallaLogin
      dominio={DOMINIO_CORPORATIVO}
      googleConfigurado={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      {...(error ? { error } : {})}
    />
  );
}

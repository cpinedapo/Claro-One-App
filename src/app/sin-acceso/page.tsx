import { redirect } from 'next/navigation';
import { PantallaSinAcceso } from '@/features/acceso/components/Acceso';
import { mensajesServidor } from '@/i18n/servidor';
import { RUTAS } from '@/routes/rutas';
import { sesionActual } from '@/server/sesion';

export async function generateMetadata() {
  return { title: (await mensajesServidor()).paginas.sinAcceso };
}

/** Un correo corporativo que inició sesión pero no está dado de alta como empleado. */
export default async function PaginaSinAcceso() {
  const sesion = await sesionActual();
  if (!sesion) redirect(RUTAS.login);
  if (sesion.empleado) redirect(RUTAS.inicio);
  return <PantallaSinAcceso email={sesion.email} />;
}

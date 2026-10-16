'use client';
/**
 * Compone el Calendario con el alta de una interacción con un lead, que vive en Lead Management. Una
 * feature no importa de otra (regla dura 6): se juntan aquí, en la ruta.
 */
import { PantallaCalendario } from '@/features/calendario/components/Calendario';
import type { DatosCalendario } from '@/features/calendario/components/Calendario';
import { FormularioInteraccion } from '@/features/leads/components/Leads';

export function CalendarioConectado({
  datos,
  puede,
  leads,
}: {
  datos: DatosCalendario;
  puede: boolean;
  /** Los leads a los que se les puede agendar una interacción; vacío si no hay permiso. */
  leads: { id: string; nombre: string }[];
}) {
  return (
    <PantallaCalendario
      datos={datos}
      puede={puede}
      {...(leads.length
        ? {
            renderNuevaInteraccion: (abierto: boolean, cerrar: () => void) => (
              <FormularioInteraccion abierto={abierto} leads={leads} origen="Calendario" hoy={datos.hoy} onCerrar={cerrar} />
            ),
          }
        : {})}
    />
  );
}

'use client';
/** Las escrituras del Calendario, del lado del navegador: ejecuta, avisa y refresca. */
import { App } from 'antd';
import { useRouter } from 'next/navigation';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarCalendario } from './acciones';
import type { AccionCalendario } from './acciones';

export function useCalendario() {
  const { message } = App.useApp();
  const router = useRouter();
  const { m } = useIdioma();
  /** Devuelve el resultado; en un rechazo, `null` y el motivo ya avisado (o lo muestra quien llama). */
  return async (accion: AccionCalendario, entrada: EntradaAccion, { silencioso = false } = {}) => {
    const r = await ejecutarCalendario(accion, entrada);
    if (!r.ok) {
      if (!silencioso) message.error(r.motivo);
      return r;
    }
    if (r.evento.tipo === 'cambio') {
      message.success(r.evento.salida ?? m.calendario.listo);
      router.refresh();
    }
    return r;
  };
}

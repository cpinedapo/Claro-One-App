'use client';
/** El hook del navegador para Campos por área (H-027): manda acción y entrada, avisa y refresca. */
import { App } from 'antd';
import { useRouter } from 'next/navigation';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarCamposArea } from './acciones';
import type { AccionCamposArea } from './acciones';

export function useCamposArea() {
  const { message } = App.useApp();
  const router = useRouter();
  const { m } = useIdioma();
  return async (accion: AccionCamposArea, entrada: EntradaAccion) => {
    const r = await ejecutarCamposArea(accion, entrada);
    if (!r.ok) {
      message.error(r.motivo);
      return false;
    }
    message.success(r.evento.salida ?? m.rolesPermisos.ejecutada);
    router.refresh();
    return true;
  };
}

export type EjecutarCamposArea = ReturnType<typeof useCamposArea>;

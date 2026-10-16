'use client';
/**
 * Las escrituras de Gestión de Roles y Permisos, del lado del navegador.
 *
 * Misma forma que el `useEstado` de PB-002 (`ejecutar`, `ultimo`, `limpiar`), con una diferencia: el
 * contrato ya no corre aquí. Corre en el servidor (`acciones.ts`), que persiste y devuelve el evento.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { definirPermisos as definirPermisosServidor, editarUsuario, ejecutarRolesPermisos, eliminarUsuario } from './acciones';

export function useRolesPermisos() {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();

  // Sin aviso de «Ejecutada» (pedido del negocio, 2026-10-15): el cambio se ve en la pantalla. Los rechazos los
  // muestra quien llama (el detalle, en su formulario; crear y eliminar, con un mensaje).
  async function ejecutar(accionId: string, entrada: EntradaAccion) {
    const r = await ejecutarRolesPermisos(accionId, entrada);
    if (r.ok && r.evento.tipo !== 'consulta') iniciar(() => router.refresh());
    return r;
  }

  /** «Eliminar usuario» (H-019): su propio contrato, al lado de PB-002. */
  async function eliminar(empleadoId: string) {
    const r = await eliminarUsuario(empleadoId);
    if (r.ok) iniciar(() => router.refresh());
    return r;
  }

  /** «Editar usuario» (H-030): su propio contrato, al lado de PB-002. El rechazo lo muestra el Modal. */
  async function editar(entrada: EntradaAccion) {
    const r = await editarUsuario(entrada);
    if (r.ok) iniciar(() => router.refresh());
    return r;
  }

  /** «Definir permisos» (H-032): los de Leads, por persona. Se ejecuta al marcar la casilla. */
  async function definirPermisos(empleadoId: string, permisos: string[]) {
    const r = await definirPermisosServidor(empleadoId, permisos);
    if (r.ok) iniciar(() => router.refresh());
    return r;
  }

  return { ejecutar, eliminar, editar, definirPermisos, ocupado };
}

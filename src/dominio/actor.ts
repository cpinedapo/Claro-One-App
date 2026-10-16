/**
 * Quién ejecuta, para el contrato de capability.
 *
 * El modelo es aditivo: una persona puede tener varios roles a la vez. El runtime del kit compara
 * UN `actor.rol` contra los roles que la acción concede, así que el actor se arma con el rol activo
 * que esa acción reconoce. Si ninguno lo hace, va el primero que tenga, y el contrato lo rechaza con
 * su propio motivo (que queda en el rastro).
 *
 * Puro: sin React, sin antd, sin base de datos.
 */
import type { Accion, Actor } from '@arc2-0/claro-one-kit/capacidad';
import { asignacionesActivas, nombreArea, rolPorId } from '@arc2-0/claro-one-kit/dominio';
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';

export function actorPara<E>(empleado: Empleado, accion: Accion<E> | undefined): Actor {
  const nombresDeRol = asignacionesActivas(empleado)
    .map((a) => rolPorId(a.rolId)?.nombre)
    .filter((n): n is string => !!n);
  const concedidos = new Set((accion?.quien ?? []).filter((q) => q.tipo === 'human').flatMap((q) => q.roles ?? []));
  const rol = nombresDeRol.find((n) => concedidos.has(n)) ?? nombresDeRol[0];
  return {
    tipo: 'human',
    id: empleado.id,
    nombre: empleado.nombre,
    area: nombreArea(empleado.areaId),
    ...(rol ? { rol } : {}),
  };
}

/** El agente de IA de Claro One actuando a pedido de una persona. Nunca ejecuta lo que el contrato
 *  no le concede: por defecto, propone. */
export function actorIA(enNombreDe: Empleado): Actor {
  return { tipo: 'ai-agent', id: 'ask-claro', nombre: 'Ask Claro', enNombreDe: enNombreDe.nombre };
}

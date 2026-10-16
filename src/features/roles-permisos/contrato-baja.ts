/**
 * CONTRATO DE LA CAPABILITY · Baja de usuarios
 *
 * «Eliminar usuario» desde Gestión de Roles y Permisos (pedido del negocio, 2026-10-13). PB-002 no
 * trae esta acción y su contrato se copia verbatim (`contrato.ts`), así que vive aquí, al lado (H-019).
 *
 * Eliminar es dar de baja, no borrar:
 * - La persona deja de entrar a Claro One y desaparece de la lista de usuarios desde hoy.
 * - Sus asignaciones de rol vigentes y su lugar en equipos de trabajo de agencias se cierran hoy.
 * - Su fila, su historia y el rastro de lo que hizo quedan: los eventos la siguen nombrando.
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 * - Nadie se elimina a sí mismo.
 * - Siempre queda al menos un Administrador activo.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';

export interface UsuarioBaja {
  id: string;
  nombre: string;
  esAdministrador: boolean;
  /** Cuántas asignaciones de rol vigentes se van a cerrar. */
  asignacionesVigentes: number;
}

export interface EstadoBaja {
  /** Solo los usuarios activos. */
  usuarios: UsuarioBaja[];
  /** Vacío al cargar; la acción deja aquí a quién dar de baja. */
  bajas: string[];
}

export const CAPACIDAD_BAJA = crearCapacidad<EstadoBaja>({
  id: 'baja-de-usuarios',
  nombre: 'Baja de usuarios',
  journey: 'Sin journey en el arnés: capability del producto, al lado de PB-002 (H-019)',
  entidades: ['Internal Actor · E-006', 'Assignment (hipótesis)'],
  estados: {
    activo: { etiqueta: 'Activo', responsable: 'Internal Actor · E-006' },
    baja: { etiqueta: 'Dado de baja', responsable: 'Internal Actor · E-006' },
  },

  acciones: [
    {
      id: 'eliminar-usuario',
      nombre: 'Eliminar usuario',
      descripcion: 'Da de baja a la persona: deja de entrar a Claro One y pierde sus roles desde hoy.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { empleadoId: 'id del usuario' },
      consecuencia: {
        cambia: 'Desde hoy la persona no puede iniciar sesión, sale de la lista de usuarios y se cierran sus roles y su lugar en equipos de trabajo.',
        noCambia: 'Su historia: lo que hizo sigue en el rastro con su nombre. No se borra.',
        alcance: 'Solo esta persona.',
        requiere: 'Que no seas tú y que quede al menos un Administrador activo.',
        registro: 'Quién la eliminó y cuándo.',
      },
      regla: 'H-019 · decisión de producto 2026-10-13',
      emite: ['internal-actor.deactivated'],
      aplicar(estado, entrada, actor) {
        const u = estado.usuarios.find((x) => x.id === entrada.empleadoId);
        if (!u) return { error: 'Ese usuario no existe o ya fue eliminado.' };
        if (actor?.id === u.id) return { error: 'No puedes eliminarte a ti mismo.' };
        if (u.esAdministrador && !estado.usuarios.some((x) => x.id !== u.id && x.esAdministrador)) {
          return { error: 'Es el único Administrador activo: asigna otro antes de eliminarlo.' };
        }
        return {
          estado: { ...estado, bajas: [...estado.bajas, u.id] },
          cambios: [
            { entidad: 'Internal Actor · E-006', id: u.nombre, de: 'activo', a: 'dado de baja', motivo: `${u.asignacionesVigentes} asignaciones cerradas` },
          ],
          salida: `${u.nombre} fue eliminado.`,
        };
      },
    },
  ],
});

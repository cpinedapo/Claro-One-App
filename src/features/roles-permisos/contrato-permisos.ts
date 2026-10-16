/**
 * CONTRATO DE LA CAPABILITY · Permisos por persona
 *
 * Los permisos se encienden a cada persona, uno por uno: cualquier combinación es válida (pedido del negocio,
 * 2026-10-15, H-032). Por ahora ningún rol suma permisos (H-035): los de prueba del kit no son reales. PB-002 no lo
 * trae; vive aquí, al lado de su contrato.
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 * - Solo se encienden permisos del catálogo del producto (`PERMISOS`).
 * - Apagar cierra el intervalo (`valid_to`); no borra. Encender abre uno nuevo.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import { PERMISOS, PERMISOS_DIRECTOS } from '@/dominio/permisos';

export interface EstadoPermisos {
  usuarios: { id: string; nombre: string; permisos: string[] }[];
  /** Vacío al cargar; la acción deja aquí qué encender y qué apagar. */
  cambios: { empleadoId: string; encender: string[]; apagar: string[] }[];
}

const nombre = (id: string) => PERMISOS.find((p) => p.id === id)?.nombre ?? id;

export const CAPACIDAD_PERMISOS = crearCapacidad<EstadoPermisos>({
  id: 'permisos-por-persona',
  nombre: 'Permisos por persona',
  journey: 'Sin journey en el arnés: capability del producto, al lado de PB-002 (H-032)',
  entidades: ['Internal Actor · E-006', 'Permiso'],
  estados: {
    encendido: { etiqueta: 'Encendido', responsable: 'Internal Actor · E-006' },
    apagado: { etiqueta: 'Apagado', responsable: 'Internal Actor · E-006' },
  },

  acciones: [
    {
      id: 'definir-permisos',
      nombre: 'Definir permisos de la persona',
      descripcion: 'Enciende o apaga, uno por uno, los permisos de la persona.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { empleadoId: 'id del usuario', permisos: `los encendidos, separados por coma: ${PERMISOS_DIRECTOS.join(',')}` },
      consecuencia: {
        cambia: 'Lo que la persona puede hacer desde ya, en las pantallas y en el servidor.',
        noCambia: 'Sus roles.',
        alcance: 'Solo esta persona.',
        registro: 'Quién lo cambió, cuándo, y qué se encendió o apagó.',
      },
      regla: 'H-032 · decisión de producto 2026-10-15',
      emite: ['internal-actor.permissions-changed'],
      aplicar(estado, entrada) {
        const u = estado.usuarios.find((x) => x.id === entrada.empleadoId);
        if (!u) return { error: 'Ese usuario no existe o fue eliminado.' };
        const pedidos = [...new Set((entrada.permisos ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
        const ajeno = pedidos.find((p) => !PERMISOS_DIRECTOS.includes(p));
        if (ajeno) return { error: `«${ajeno}» no es un permiso del catálogo.` };
        const encender = pedidos.filter((p) => !u.permisos.includes(p));
        const apagar = u.permisos.filter((p) => PERMISOS_DIRECTOS.includes(p) && !pedidos.includes(p));
        if (!encender.length && !apagar.length) return { error: 'No cambiaste nada.' };
        return {
          estado: { ...estado, cambios: [...estado.cambios, { empleadoId: u.id, encender, apagar }] },
          cambios: [
            ...encender.map((p) => ({ entidad: 'Permiso', id: `${u.nombre} · ${nombre(p)}`, de: 'apagado', a: 'encendido' })),
            ...apagar.map((p) => ({ entidad: 'Permiso', id: `${u.nombre} · ${nombre(p)}`, de: 'encendido', a: 'apagado' })),
          ],
          salida: `Se actualizaron los permisos de ${u.nombre}.`,
        };
      },
    },
  ],
});

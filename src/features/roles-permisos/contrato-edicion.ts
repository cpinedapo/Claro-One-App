/**
 * CONTRATO DE LA CAPABILITY · Edición de usuarios
 *
 * «Editar» el detalle de un usuario desde su perfil en Gestión de Roles y Permisos (pedido del negocio,
 * 2026-10-15). PB-002 no trae esta acción y su contrato se copia verbatim (`contrato.ts`), así que vive aquí,
 * al lado, como la baja (H-019, H-030).
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 * - Nombre obligatorio y al menos un cargo vigente de Datos base (o uno que ya tenía).
 * - Los cargos deciden el área (H-038): la persona queda en el área o sub-área de su primer cargo. Sus roles también
 *   salen de los cargos, pero se ajustan con su propio contrato (asignar / revocar), cada uno con su evento.
 * - El correo es corporativo y no lo tiene otra persona: lo revisa el servidor antes del contrato, como al crear.
 * - Cambiar de área no borra los datos del área anterior: dejan de mostrarse y quedan en su historia (H-027).
 * - El valor de antes y el de después quedan en el rastro.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import { perfilDeCargos } from '@/dominio/areas';
import type { AreaOpcion, CargoOpcion } from '@/dominio/baselines';

export interface UsuarioEditable {
  id: string;
  nombre: string;
  cargos: string[];
  /** El primer cargo (el kit pide uno). */
  puesto: string;
  area: string;
  email: string | null;
}

export interface EstadoEdicion {
  usuarios: UsuarioEditable[];
  /** Los vigentes de Datos base. */
  cargos: CargoOpcion[];
  areas: AreaOpcion[];
  /** Vacío al cargar; la acción deja aquí el usuario con sus datos nuevos. */
  ediciones: UsuarioEditable[];
}

export const CAPACIDAD_EDICION = crearCapacidad<EstadoEdicion>({
  id: 'edicion-de-usuarios',
  nombre: 'Edición de usuarios',
  journey: 'Sin journey en el arnés: capability del producto, al lado de PB-002 (H-030)',
  entidades: ['Internal Actor · E-006'],
  estados: {
    activo: { etiqueta: 'Activo', responsable: 'Internal Actor · E-006' },
  },

  acciones: [
    {
      id: 'editar-usuario',
      nombre: 'Editar usuario',
      descripcion: 'Cambia el nombre, el correo o los cargos de una persona. Su área sale de los cargos.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { empleadoId: 'id del usuario', nombre: 'string', email: 'correo corporativo', cargos: 'códigos de cargo (Datos base), separados por |' },
      consecuencia: {
        cambia: 'Los datos de la persona desde hoy, y su área según sus cargos. Con otro correo, inicia sesión con ese.',
        noCambia: 'Su historia. Los datos de su área anterior quedan guardados. Sus roles se ajustan aparte, con su contrato.',
        alcance: 'Solo esta persona.',
        requiere: 'Nombre, correo corporativo y al menos un cargo vigente.',
        registro: 'Quién lo cambió, cuándo y el valor de antes y de después.',
      },
      regla: 'H-030 · H-038 · decisión de producto 2026-10-15',
      emite: ['internal-actor.edited'],
      aplicar(estado, entrada) {
        const u = estado.usuarios.find((x) => x.id === entrada.empleadoId);
        if (!u) return { error: 'Ese usuario no existe o fue eliminado.' };
        const nombre = (entrada.nombre ?? '').trim();
        if (!nombre) return { error: 'Escribe el nombre.' };
        if (nombre.length > 80) return { error: 'El nombre tiene que tener 80 caracteres o menos.' };
        const cargos = [...new Set((entrada.cargos ?? '').split('|').map((x) => x.trim()).filter(Boolean))];
        if (!cargos.length) return { error: 'Elige al menos un cargo.' };
        const ajeno = cargos.find((c) => !u.cargos.includes(c) && !estado.cargos.some((x) => x.codigo === c));
        if (ajeno) return { error: `El cargo «${ajeno}» no está vigente en Datos base.` };
        const email = (entrada.email ?? '').trim().toLowerCase() || null;
        if (!email) return { error: 'Escribe el correo corporativo: sin él no puede iniciar sesión.' };
        const area = perfilDeCargos(cargos, estado.cargos, estado.areas).principal ?? u.area;

        const nuevo = { ...u, nombre, email, cargos, puesto: cargos[0]!, area };
        const campos: [string, string | null, string | null][] = [
          ['nombre', u.nombre, nombre],
          ['correo', u.email, email],
          ['cargos', u.cargos.join(', ') || u.puesto, cargos.join(', ')],
          ['área', u.area, area],
        ];
        const cambios = campos
          .filter(([, de, a]) => de !== a)
          .map(([que, de, a]) => ({ entidad: 'Internal Actor · E-006', id: `${u.id} · ${que}`, de: de ?? '—', a: a ?? '—' }));
        if (!cambios.length) return { error: 'No cambiaste nada.' };
        return {
          estado: { ...estado, ediciones: [...estado.ediciones, nuevo] },
          cambios,
          salida: `Se actualizó ${nombre}.`,
        };
      },
    },
  ],
});

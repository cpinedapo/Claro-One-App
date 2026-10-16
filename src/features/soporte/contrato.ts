/**
 * CONTRATO DE LA CAPABILITY · Soporte: Ver como
 *
 * Un Administrador navega la plataforma con la identidad de otro empleado para ver exactamente lo
 * que esa persona ve (menú, alcance, vacíos, errores) y darle soporte.
 *
 * Es una capability de PLATAFORMA pedida por el producto (2026-10-13), no viene del arnés: ver
 * docs/hallazgos.md · H-009. Por eso su regla dice «decisión de producto» y no cita una RUL.
 *
 * Reglas que el contrato sostiene:
 * - Solo una persona con rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 *   Ninguna IA, ni siquiera para proponer.
 * - No se puede «ver como» uno mismo, ni como alguien que no existe.
 * - Mientras dura, la sesión es de SOLO LECTURA (lo hace cumplir `exigirEmpleadoParaEscribir`).
 * - Entrar y salir dejan evento: quién vio como quién, y cuándo.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';

export interface PersonaSoporte {
  id: string;
  nombre: string;
}

export interface EstadoSoporte {
  /** A quién se está viendo ahora, si a alguien. */
  viendoA: PersonaSoporte | null;
  /** Los empleados que existen, para validar el objetivo. */
  empleados: PersonaSoporte[];
}

export const CAPACIDAD_SOPORTE = crearCapacidad<EstadoSoporte>({
  id: 'soporte-ver-como',
  nombre: 'Soporte: Ver como',
  journey: 'Sin journey en el arnés: capability de plataforma pedida por el producto (H-009)',
  entidades: ['Internal Actor · E-006', 'Sesión de soporte · HIPÓTESIS (no está en el catálogo)'],
  estados: {
    ok: { etiqueta: 'Viendo como', responsable: 'Sesión de soporte · hipótesis' },
    neutral: { etiqueta: 'Con su propio usuario', responsable: 'Sesión de soporte · hipótesis' },
  },

  acciones: [
    {
      id: 'iniciar-ver-como',
      nombre: 'Ver como',
      descripcion:
        'Navegar la plataforma con la identidad de otro empleado, para ver lo mismo que esa persona y darle soporte.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { empleadoId: 'string' },
      consecuencia: {
        cambia: 'Ves la plataforma tal como la ve esa persona: su menú, su alcance y sus pantallas.',
        noCambia: 'Nada de sus datos ni de sus permisos. Mientras dure no puedes guardar cambios: es de solo lectura.',
        alcance: 'Solo tu sesión, en este navegador.',
        requiere: 'Ser Administrador, y que la persona exista y no seas tú.',
        registro: 'Quién vio como quién, y cuándo empezó.',
      },
      regla: 'Decisión de producto 2026-10-13 · H-009 · soporte de solo lectura',
      emite: ['support.impersonation.started'],
      aplicar(estado, entrada, actor) {
        const objetivo = estado.empleados.find((e) => e.id === entrada.empleadoId);
        if (!objetivo) return { error: `No existe el usuario ${entrada.empleadoId}.` };
        if (actor?.id === objetivo.id) return { error: 'Ya estás viendo la plataforma con tu propio usuario.' };
        return {
          estado: { ...estado, viendoA: objetivo },
          cambios: [
            {
              entidad: 'Sesión de soporte · hipótesis',
              id: objetivo.id,
              de: estado.viendoA ? `viendo como ${estado.viendoA.nombre}` : 'propio usuario',
              a: `viendo como ${objetivo.nombre}`,
              motivo: 'Soporte, de solo lectura',
            },
          ],
          salida: `Ahora ves Claro One como ${objetivo.nombre}.`,
        };
      },
    },

    {
      id: 'terminar-ver-como',
      nombre: 'Volver a mi usuario',
      descripcion: 'Terminar la sesión de soporte y volver a navegar con tu propia identidad.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: {},
      consecuencia: {
        cambia: 'Vuelves a ver la plataforma con tu usuario y tus permisos.',
        alcance: 'Solo tu sesión.',
        registro: 'Cuándo terminó la sesión de soporte.',
      },
      regla: 'Decisión de producto 2026-10-13 · H-009',
      emite: ['support.impersonation.ended'],
      aplicar(estado) {
        if (!estado.viendoA) return { error: 'No estás viendo como nadie.' };
        return {
          estado: { ...estado, viendoA: null },
          cambios: [
            {
              entidad: 'Sesión de soporte · hipótesis',
              id: estado.viendoA.id,
              de: `viendo como ${estado.viendoA.nombre}`,
              a: 'propio usuario',
            },
          ],
        };
      },
    },
  ],
});

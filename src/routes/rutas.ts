/** Las URLs de Claro One. La costura de **rutas** de ESTRUCTURA-DEL-FRONT §7: el `switch` del
 *  prototipo se vuelve estas rutas del App Router. */
export const RUTAS = {
  inicio: '/',
  login: '/login',
  sinAcceso: '/sin-acceso',
  directorio: '/directorio',
  calendario: '/calendario',
  leads: '/lead-management',
  rolesPermisos: '/configuracion/roles-permisos',
  baselines: '/configuracion/datos-base',
  flujo: (flujoId: string) => `/flujos/${flujoId}`,
  /** Destinos del menú que todavía no se construyen. */
  modulo: (clave: string) => `/modulo/${clave}`,
} as const;

/**
 * Los idiomas de la interfaz. Puro: lo usan el servidor, el navegador y el dominio.
 *
 * Regla del kit (Preferencias): el idioma traduce la PANTALLA, no los datos. Los nombres de Flujos,
 * áreas, agencias y los textos de los contratos siguen como vienen del arnés.
 */
export type Idioma = 'es' | 'en';

export const IDIOMAS: Idioma[] = ['es', 'en'];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

/** Cookie y no localStorage: las páginas del servidor también necesitan saber el idioma. */
export const COOKIE_IDIOMA = 'claro_idioma';

export const idiomaValido = (v: string | null | undefined): Idioma => (v === 'en' || v === 'es' ? v : IDIOMA_POR_DEFECTO);

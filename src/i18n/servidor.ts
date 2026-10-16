import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { COOKIE_IDIOMA, idiomaValido } from './idioma';
import type { Idioma } from './idioma';
import { MENSAJES } from './mensajes';
import type { Mensajes } from './mensajes';

/** El idioma de quien mira, para páginas, metadatos y acciones de servidor. */
export const idiomaActual = cache(async (): Promise<Idioma> => idiomaValido((await cookies()).get(COOKIE_IDIOMA)?.value));

export async function mensajesServidor(): Promise<Mensajes> {
  return MENSAJES[await idiomaActual()];
}

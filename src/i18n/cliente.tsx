'use client';
/**
 * El idioma en el navegador. El layout raíz lo lee de la cookie y lo pasa como valor inicial; al
 * cambiarlo se reescribe la cookie y se refresca, para que las páginas del servidor (títulos,
 * metadatos) también cambien.
 */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { COOKIE_IDIOMA } from './idioma';
import type { Idioma } from './idioma';
import { MENSAJES } from './mensajes';
import type { Mensajes } from './mensajes';

interface EstadoIdioma {
  idioma: Idioma;
  m: Mensajes;
  cambiarIdioma: (i: Idioma) => void;
}

const Contexto = createContext<EstadoIdioma | null>(null);

export function IdiomaProvider({ inicial, children }: { inicial: Idioma; children: ReactNode }) {
  const router = useRouter();
  const [idioma, setIdioma] = useState<Idioma>(inicial);

  function cambiarIdioma(i: Idioma) {
    document.cookie = `${COOKIE_IDIOMA}=${i}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = i;
    setIdioma(i);
    router.refresh();
  }

  return <Contexto.Provider value={{ idioma, m: MENSAJES[idioma], cambiarIdioma }}>{children}</Contexto.Provider>;
}

export function useIdioma(): EstadoIdioma {
  const c = useContext(Contexto);
  if (!c) throw new Error('useIdioma va dentro de <IdiomaProvider>.');
  return c;
}

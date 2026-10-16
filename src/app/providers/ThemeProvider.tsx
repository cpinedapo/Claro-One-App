'use client';
/**
 * El tema de Claro One para toda la app: `ConfigProvider` con el tema del kit, en español.
 *
 * Apariencia (claro/oscuro) y tema (Marino/Cielo) son dos cosas distintas (TOP-R11 del Manual de uso).
 * Las dos son preferencias de quien mira: se recuerdan en este navegador y nada más. El idioma de
 * los componentes de antd (paginación, vacíos, filtros) sigue al de la interfaz (`useIdioma`).
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { TEMA_CLARO_ONE, TEMA_CLARO_ONE_OSCURO } from '@arc2-0/claro-one-kit';
import type { Apariencia, TemaApp } from '@arc2-0/claro-one-kit';
import { useIdioma } from '@/i18n/cliente';

interface Preferencias {
  apariencia: Apariencia;
  setApariencia: (a: Apariencia) => void;
  tema: TemaApp;
  setTema: (t: TemaApp) => void;
}

const Contexto = createContext<Preferencias | null>(null);
const CLAVE = 'claro-one.preferencias';

export function usePreferencias(): Preferencias {
  const p = useContext(Contexto);
  if (!p) throw new Error('usePreferencias va dentro de <ThemeProvider>.');
  return p;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [apariencia, setApariencia] = useState<Apariencia>('claro');
  const [tema, setTema] = useState<TemaApp>('marino');
  const { idioma } = useIdioma();

  useEffect(() => {
    try {
      const guardado = JSON.parse(window.localStorage.getItem(CLAVE) ?? '{}') as Partial<{ apariencia: Apariencia; tema: TemaApp }>;
      if (guardado.apariencia) setApariencia(guardado.apariencia);
      if (guardado.tema) setTema(guardado.tema);
    } catch {
      /* sin storage: valen los valores por defecto */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = apariencia === 'oscuro' ? 'dark' : 'light';
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify({ apariencia, tema }));
    } catch {
      /* sin storage: vale esta sesión */
    }
  }, [apariencia, tema]);

  // Los nombres de meses y días (Calendar, DatePicker) salen de dayjs: sigue el idioma de la pantalla.
  dayjs.locale(idioma === 'en' ? 'en' : 'es');

  return (
    <Contexto.Provider value={{ apariencia, setApariencia, tema, setTema }}>
      <ConfigProvider theme={apariencia === 'oscuro' ? TEMA_CLARO_ONE_OSCURO : TEMA_CLARO_ONE} locale={idioma === 'en' ? enUS : esES}>
        {/* `App` da `message` y `modal` con el tema y el idioma (App.useApp), sin las funciones estáticas que antd desaconseja. */}
        <App>{children}</App>
      </ConfigProvider>
    </Contexto.Provider>
  );
}

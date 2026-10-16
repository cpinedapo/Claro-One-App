'use client';
/**
 * El chrome de Claro One: `AppShell` + `MenuLateral` del kit, con el menú calculado.
 *
 * Regla 4 de ESTRUCTURA-DEL-FRONT: construir el menú (`construirMenu`) va separado de navegar. El
 * menú dice qué ve la persona; el clic solo avisa una clave, y aquí esa clave ya es una ruta.
 *
 * `pieMenu` es un espacio al pie del menú lateral para piezas que traen las features (hoy, «Ver como»
 * de soporte). `components/` no importa de `features/`: la feature se compone desde el layout, y
 * lee el estado del menú con `useShell`.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Grid } from 'antd';
import { LogOut } from 'lucide-react';
import { AppShell, Ico, MenuLateral } from '@arc2-0/claro-one-kit';
import { esConfiguradorAdmin } from '@arc2-0/claro-one-kit/dominio';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { usePreferencias } from '@/app/providers/ThemeProvider';
import { useIdioma } from '@/i18n/cliente';
import { authCliente } from '@/lib/auth-cliente';
import { RUTAS } from '@/routes/rutas';
import { claveSeleccionada, construirMenu } from './menu';

interface EstadoShell {
  colapsado: boolean;
  /** Despliega el menú lateral (por ejemplo, para usar algo de `pieMenu` desde el riel de iconos). */
  expandir: () => void;
  /** El tono real del menú lateral: claro solo con tema «cielo» en apariencia clara. */
  menuClaro: boolean;
}

const ContextoShell = createContext<EstadoShell>({ colapsado: false, expandir: () => {}, menuClaro: false });

export const useShell = () => useContext(ContextoShell);

export default function Shell({
  empleado,
  simulada,
  pieMenu,
  children,
}: {
  empleado: EmpleadoConCorreo;
  /** La identidad viene de un atajo de desarrollo, no de un login real. */
  simulada: boolean;
  /** Va al pie del menú lateral. */
  pieMenu?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const { apariencia, setApariencia, tema, setTema } = usePreferencias();
  const { idioma, m, cambiarIdioma } = useIdioma();
  const pantalla = Grid.useBreakpoint();
  const angosta = pantalla.md === false;
  const [colapsado, setColapsado] = useState(false);
  // H-004: el AppShell del kit todavia no tiene variante movil. En pantalla angosta (el embebido en
  // mobile) el menu arranca plegado al riel de iconos para dejarle el ancho al contenido.
  useEffect(() => {
    if (angosta) setColapsado(true);
  }, [angosta]);

  const nav = useMemo(() => construirMenu(empleado, m.menu), [empleado, m]);
  const seleccion = claveSeleccionada(nav, ruta);

  async function salir() {
    await authCliente.signOut();
    router.push(RUTAS.login);
    router.refresh();
  }

  const menuClaro = tema === 'cielo' && apariencia === 'claro';

  return (
    <ContextoShell.Provider value={{ colapsado, expandir: () => setColapsado(false), menuClaro }}>
    <AppShell
      title="Claro One"
      collapsed={colapsado}
      onToggle={() => setColapsado(!colapsado)}
      tone={tema}
      topBar={{
        user: { nombre: empleado.nombre, puesto: empleado.puesto },
        appearance: apariencia,
        onAppearance: setApariencia,
        tone: tema,
        onTone: setTema,
        // El selector de idioma vive en el menú del avatar (reglas TOP del manual del kit).
        language: idioma,
        onLanguage: cambiarIdioma,
        // Roles y permisos vive en Configuración, en el menú de la cuenta (TOP-R14), solo para quien administra.
        ...(esConfiguradorAdmin(empleado) ? { onSettings: () => router.push(RUTAS.rolesPermisos) } : {}),
      }}
      sider={
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ flex: 1 }}>
        <MenuLateral
          items={nav}
          selectedKey={seleccion}
          onSelect={(clave) => clave.startsWith('/') && router.push(clave)}
          storageKey={`claro-one.menu.${empleado.id}`}
          collapsed={colapsado}
          onToggle={() => setColapsado(!colapsado)}
          tone={tema}
          {...(m.menuLateral ? { labels: m.menuLateral } : {})}
        />
        </div>
        {pieMenu}
        </div>
      }
      actions={
        <>
          {!simulada && (
            <Button type="text" size="small" icon={<Ico de={LogOut} />} onClick={salir}>
              {m.comun.cerrarSesion}
            </Button>
          )}
        </>
      }
    >
      {children}
    </AppShell>
    </ContextoShell.Provider>
  );
}

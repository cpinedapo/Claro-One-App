'use client';
/**
 * `AppShell` y `MenuLateral` del kit leen `document` y `localStorage` mientras renderizan, así que
 * no se pueden renderizar en el servidor (H-002). Se cargan solo en el navegador; mientras tanto se
 * ve un esqueleto en el lugar del chrome.
 */
import dynamic from 'next/dynamic';
import { Skeleton, theme } from 'antd';

function Cargando() {
  const { token } = theme.useToken();
  return <Skeleton active style={{ padding: token.paddingLG }} />;
}

const ShellCliente = dynamic(() => import('./Shell'), { ssr: false, loading: Cargando });

export default ShellCliente;

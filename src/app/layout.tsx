import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import 'antd/dist/reset.css';
import '@arc2-0/claro-one-kit/tokens.css';
import { IdiomaProvider } from '@/i18n/cliente';
import { idiomaActual, mensajesServidor } from '@/i18n/servidor';
import { ThemeProvider } from './providers/ThemeProvider';

export async function generateMetadata(): Promise<Metadata> {
  const m = await mensajesServidor();
  return { title: { default: 'Claro One', template: '%s · Claro One' }, description: m.paginas.descripcion };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const idioma = await idiomaActual();
  return (
    <html lang={idioma} suppressHydrationWarning>
      <body>
        <AntdRegistry>
          <IdiomaProvider inicial={idioma}>
            <ThemeProvider>{children}</ThemeProvider>
          </IdiomaProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

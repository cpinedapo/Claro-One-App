'use client';
/**
 * Las dos pantallas fuera del shell: entrar, y «entraste pero todavía no eres nadie aquí».
 * Fase 1: solo personal interno, con su cuenta corporativa de Google Workspace.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Flex, Segmented, Typography, theme } from 'antd';
import { LogIn, LogOut } from 'lucide-react';
import { Cap, Ico, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { authCliente } from '@/lib/auth-cliente';
import { RUTAS } from '@/routes/rutas';
import { useIdioma } from '@/i18n/cliente';
import type { Idioma } from '@/i18n/idioma';
import type { Mensajes } from '@/i18n/mensajes';

const { Title, Text } = Typography;

function Centro({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: token.padding, background: token.colorBgLayout }}>
      <div style={{ width: '100%', maxWidth: token.controlHeightLG * 12 }}>{children}</div>
    </Flex>
  );
}

const mensajeError = (codigo: string, m: Mensajes) =>
  codigo === 'FORBIDDEN' ? m.acceso.errorNoCorporativa : codigo === 'access_denied' ? m.acceso.errorCancelado : m.acceso.errorGenerico;

/** Fuera del shell no hay menú del avatar: el idioma se elige aquí mismo. */
function SelectorIdioma() {
  const { idioma, cambiarIdioma } = useIdioma();
  return (
    <Segmented
      size="small"
      aria-label="Idioma · Language"
      value={idioma}
      onChange={(v) => cambiarIdioma(v as Idioma)}
      options={[
        { label: 'Español', value: 'es' },
        { label: 'English', value: 'en' },
      ]}
    />
  );
}

export function PantallaLogin({ dominio, googleConfigurado, error }: { dominio: string; googleConfigurado: boolean; error?: string }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.acceso;
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    setEntrando(true);
    await authCliente.signIn.social({ provider: 'google', callbackURL: RUTAS.inicio, errorCallbackURL: RUTAS.login });
  }

  return (
    <Centro>
      <Card>
        <Flex align="center" gap={token.marginSM} style={{ marginBottom: token.marginLG }}>
          <span aria-hidden style={{ width: token.controlHeight, height: token.controlHeight, borderRadius: token.borderRadius, background: token.colorPrimary }} />
          <Title level={3} style={{ margin: 0 }}>Claro One</Title>
          <div style={{ marginInlineStart: 'auto' }}>
            <SelectorIdioma />
          </div>
        </Flex>
        <Text>{t.entraConGoogle}</Text>
        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: token.margin }}
            title={mensajeError(error, m)}
          />
        )}
        {!googleConfigurado && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: token.margin }}
            title={t.googleNoConfigTitulo}
            description={t.googleNoConfigDetalle}
          />
        )}
        <Button
          type="primary"
          size="large"
          block
          icon={<Ico de={LogIn} />}
          loading={entrando}
          disabled={!googleConfigurado}
          onClick={entrar}
          style={{ marginTop: token.marginLG }}
        >
          {t.botonGoogle}
        </Button>
        <Cap style={{ marginTop: token.margin }}>{t.soloDominio(dominio)}</Cap>
      </Card>
    </Centro>
  );
}

export function PantallaSinAcceso({ email }: { email: string }) {
  const router = useRouter();
  const { m } = useIdioma();
  async function salir() {
    await authCliente.signOut();
    router.push(RUTAS.login);
    router.refresh();
  }
  return (
    <Centro>
      <VacioConMotivo
        titulo={m.acceso.sinUsuarioTitulo}
        motivo={m.acceso.sinUsuarioMotivo(email)}
        acciones={
          <Button icon={<Ico de={LogOut} />} onClick={salir}>
            {m.acceso.otraCuenta}
          </Button>
        }
        pie="Internal Actor · E-006"
      />
    </Centro>
  );
}

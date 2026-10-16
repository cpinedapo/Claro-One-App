'use client';
/**
 * Soporte: Ver como. Dos piezas:
 * - `PanelVerComo`, al pie del menú lateral. Solo lo recibe quien inició sesión como Administrador.
 * - `BarraVerComo`, una barra delgada arriba del contenido mientras se ve como otra persona, con
 *   «Salir». Nunca se esconde: quien mira tiene que saber en todo momento que no es él mismo.
 *
 * Elegir a alguien entra directo, sin ventana de confirmación (pedido del producto): es de solo
 * lectura, se sale con un clic, y el evento queda igual en el rastro.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Select, Tooltip, Typography, theme } from 'antd';
import { Eye, Undo2 } from 'lucide-react';
import { Ico } from '@arc2-0/claro-one-kit';
import { useShell } from '@/components/layout/Shell';
import { RUTAS } from '@/routes/rutas';
import { useIdioma } from '@/i18n/cliente';
import { iniciarVerComo, terminarVerComo } from '../acciones';

const { Text } = Typography;

export interface OpcionPersona {
  value: string;
  label: string;
}

export function PanelVerComo({
  opciones,
  viendoAId,
}: {
  opciones: OpcionPersona[];
  viendoAId: string | null;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const { colapsado, expandir, menuClaro } = useShell();
  const { m } = useIdioma();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const colorTexto = menuClaro ? token.colorTextSecondary : token.colorTextLightSolid;

  if (colapsado) {
    return (
      <div style={{ padding: token.paddingXS, display: 'flex', justifyContent: 'center' }}>
        <Tooltip title={m.verComo.tooltip} placement="right">
          <Button type="text" aria-label={m.verComo.tooltip} icon={<Ico de={Eye} style={{ color: colorTexto }} />} onClick={expandir} />
        </Tooltip>
      </div>
    );
  }

  function verComo(id: string) {
    iniciar(async () => {
      const r = await iniciarVerComo(id);
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      setError(null);
      router.push(RUTAS.inicio);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        padding: token.padding,
        borderTop: `${token.lineWidth}px ${token.lineType} ${menuClaro ? token.colorBorderSecondary : token.colorBorder}`,
      }}
    >
      <Text style={{ color: colorTexto, fontSize: token.fontSizeSM, display: 'block', marginBottom: token.marginXS }}>
        <Ico de={Eye} size={token.fontSizeSM} /> {m.verComo.titulo}
      </Text>
      <Select
        aria-label={m.verComo.tooltip}
        size="small"
        placeholder={m.verComo.placeholder}
        value={viendoAId ?? undefined}
        showSearch={{ optionFilterProp: 'label' }}
        options={opciones}
        onChange={verComo}
        loading={ocupado}
        disabled={ocupado}
        style={{ width: '100%' }}
        popupMatchSelectWidth={false}
      />
      {error && (
        <Alert type="error" showIcon style={{ marginTop: token.marginXS }} title={error} closable={{ onClose: () => setError(null) }} />
      )}
    </div>
  );
}

/** La barra «Viendo como: …» con «Salir». Va pegada arriba del contenido, de borde a borde. */
export function BarraVerComo({ nombre, puesto }: { nombre: string; puesto: string }) {
  const { token } = theme.useToken();
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { m } = useIdioma();

  function salir() {
    iniciar(async () => {
      const r = await terminarVerComo();
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      router.push(RUTAS.inicio);
      router.refresh();
    });
  }

  return (
    <Alert
      banner
      type="warning"
      icon={<Ico de={Eye} />}
      showIcon
      role="status"
      style={{ margin: `-${token.paddingLG}px -${token.paddingLG}px ${token.paddingLG}px` }}
      title={
        <span>
          {m.verComo.viendoComo} <b>{nombre}</b> · {puesto}
          {error && <Text type="danger"> · {error}</Text>}
        </span>
      }
      action={
        <Button size="small" icon={<Ico de={Undo2} />} loading={ocupado} onClick={salir}>
          {m.verComo.salir}
        </Button>
      }
    />
  );
}

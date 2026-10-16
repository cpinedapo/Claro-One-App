'use client';
/**
 * Un Flujo de negocio que todavía no tiene contrato de capability: se muestra como referencia, de
 * solo lectura. Portada de PB-002 (`vistas/comunes.tsx` · `CabeceraFlujo` + `SinAccionesEjecutables`).
 *
 * Cada Flujo deja de pasar por aquí cuando se construye: primero su contrato (desde el arnés), luego
 * su pantalla propia en `features/<slug>/`.
 */
import { Alert, Descriptions, theme } from 'antd';
import { nombreArea } from '@arc2-0/claro-one-kit/dominio';
import type { Flujo } from '@arc2-0/claro-one-kit/dominio';
import { Procedencia } from '@arc2-0/claro-one-kit';
import { useIdioma } from '@/i18n/cliente';

export function PantallaFlujoReferencia({ flujo }: { flujo: Flujo }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.flujo;
  return (
    <div>
      <div style={{ marginBottom: token.marginLG }}>
        <Procedencia texto="flujos-acciones-objetos.md §3 · capacidades-por-rol-y-flujo.md §2 (arnés)" />
      </div>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: 'area', label: t.areaDuena, children: nombreArea(flujo.areaDuenaId) },
          { key: 'manager', label: t.manager, children: flujo.managerHace },
          { key: 'doer', label: t.doer, children: flujo.doerHace },
        ]}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginTop: token.margin }}
        title={t.vsSalesforce}
        description={flujo.cambioVsSalesforce}
      />
      <Alert
        type="warning"
        showIcon
        style={{ marginTop: token.marginLG }}
        title={t.sinAccionesTitulo}
        description={t.sinAccionesDetalle}
      />
    </div>
  );
}

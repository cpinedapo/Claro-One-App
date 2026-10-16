'use client';
/**
 * Inicio, perspectiva Internal. Portada de PB-002 (`vistas/roles.tsx` · `PantallaInicio`).
 * Todo llega por props (regla 1 de ESTRUCTURA-DEL-FRONT).
 */
import { Alert, Card, Statistic, Tag, Typography, theme } from 'antd';
import { FLUJOS, ROLES } from '@arc2-0/claro-one-kit/dominio';
import {
  asignacionesActivas, esConfiguradorAdmin, puedeVerFlujo, rolPorId,
} from '@arc2-0/claro-one-kit/dominio';
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';
import { Cifras, Procedencia, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { etiquetaRol } from '@/dominio/roles';
import { useIdioma } from '@/i18n/cliente';

const { Text } = Typography;

export function PantallaInicio({
  empleado,
  totalUsuarios,
  totalAsignacionesActivas,
}: {
  empleado: Empleado;
  totalUsuarios: number;
  totalAsignacionesActivas: number;
}) {
  const { token } = theme.useToken();
  const { idioma, m } = useIdioma();
  const t = m.inicio;
  const activas = asignacionesActivas(empleado);
  const esCeo = activas.some((a) => a.rolId === 'ceo-level');
  const esAdmin = esConfiguradorAdmin(empleado);
  const flujosVisibles = FLUJOS.filter((f) => puedeVerFlujo(empleado, f));

  if (esAdmin) {
    return (
      <div>
        <div style={{ marginBottom: token.marginLG }}>
          <Procedencia texto={t.procedenciaAdmin} />
        </div>
        <Card>
          <Cifras>
            <Statistic title={t.usuariosPlataforma} value={totalUsuarios} />
            <Statistic title={t.asignacionesActivas} value={totalAsignacionesActivas} />
            <Statistic
              title={t.rolesCatalogo}
              value={ROLES.length}
              suffix={<Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t.fijo}</Text>}
            />
          </Cifras>
        </Card>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: token.marginLG }}
          title={t.adminAviso}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: token.marginLG }}>
        <Procedencia texto={t.procedencia} />
      </div>
      <Card title={t.loQueVe(empleado.nombre)} extra={<Text type="secondary">{empleado.puesto}</Text>}>
        <div style={{ marginBottom: token.margin }}>
          {activas.map((a) => (
            <Tag key={a.id} color={rolPorId(a.rolId)?.color} style={{ marginBottom: token.marginXXS }}>
              {etiquetaRol(a, idioma)}
            </Tag>
          ))}
        </div>
        {esCeo ? (
          <Text>{t.ceo(flujosVisibles.length)}</Text>
        ) : (
          <Text>{t.flujosVisibles(flujosVisibles.length)}</Text>
        )}
      </Card>
      {activas.length === 0 ? (
        <div style={{ marginTop: token.marginLG }}>
          <VacioConMotivo
            titulo={t.sinAsignacionesTitulo}
            motivo={t.sinAsignacionesMotivo}
            pie="roles-permisos-spec.md §8"
          />
        </div>
      ) : (
        flujosVisibles.length === 0 && (
          <div style={{ marginTop: token.marginLG }}>
            <VacioConMotivo
              titulo={t.sinFlujosTitulo}
              motivo={t.sinFlujosMotivo}
              pie="roles-permisos-spec.md §6 · capacidades-por-rol-y-flujo.md §2"
            />
          </div>
        )
      )}
    </div>
  );
}

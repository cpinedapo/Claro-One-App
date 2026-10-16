'use client';
/**
 * Carga masiva de territorios (H-039): se sube el archivo de la plantilla, se ve cada fila con su resultado y se
 * importa solo si el 100 % está bien (como la importación de leads, H-026). El archivo se lee en el navegador; el
 * contrato `importar-territorios` vuelve a validar todo al importar.
 */
import { useState } from 'react';
import { Alert, Button, Checkbox, Flex, Modal, Space, Tag, Tooltip, Typography, Upload, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { CircleCheck, FileSpreadsheet, Info, TriangleAlert, Upload as IconoSubir } from 'lucide-react';
import { Cap, Ico, IcoTag, Pila, Tabla } from '@arc2-0/claro-one-kit';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import type { OpcionBaseline } from '@/dominio/baselines';
import { COLUMNAS_TERRITORIO, filasDeCsv, validarTerritorios } from '@/dominio/territorios';
import type { FilaTerritorio, TerritorioLeido } from '@/dominio/territorios';
import { useIdioma } from '@/i18n/cliente';
import type { AccionBaselines } from '../acciones';

const { Text } = Typography;

export function SubirTerritorios({
  estados,
  existentes,
  onImportar,
  onCerrar,
}: {
  /** Los estados vigentes de Datos base. */
  estados: OpcionBaseline[];
  /** Los territorios que ya existen (los inactivos no ocupan sus ZIP). */
  existentes: { nombre: string; zips: string[] }[];
  onImportar: (accion: AccionBaselines, entrada: EntradaAccion) => Promise<boolean>;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.baselines.importar;
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaTerritorio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloErrores, setSoloErrores] = useState(false);
  const [importando, setImportando] = useState(false);

  const leidos: TerritorioLeido[] = filas ? validarTerritorios(filas, estados, existentes) : [];
  const conError = leidos.filter((l) => l.errores.length).length;
  const listas = leidos.length - conError;
  const visibles = leidos.filter((l) => !soloErrores || l.errores.length);

  const reiniciar = () => {
    setArchivo(null);
    setFilas(null);
    setError(null);
    setSoloErrores(false);
  };

  async function leer(f: File) {
    reiniciar();
    setArchivo(f.name);
    if (!f.name.toLowerCase().endsWith('.csv')) return setError(t.soloCsv);
    if (f.size > 2 * 1024 * 1024) return setError(t.muyGrande);
    const r = filasDeCsv(await f.text());
    if ('error' in r) return setError(r.error);
    setFilas(r.filas);
  }

  async function importar() {
    if (!filas || !archivo) return;
    setImportando(true);
    const ok = await onImportar('importar-territorios', { archivo, filas: JSON.stringify(filas) });
    setImportando(false);
    if (ok) onCerrar();
  }

  const nombreEstado = (c: string | null) => (c ? (estados.find((e) => e.codigo === c)?.nombre ?? c) : null);
  const columnas: TableColumnsType<TerritorioLeido> = [
    { key: 'fila', title: t.colFila, align: 'right', width: token.controlHeightLG * 1.5, render: (_, l) => l.fila },
    {
      key: 'resultado',
      title: t.colResultado,
      width: token.controlHeightLG * 3,
      render: (_, l) =>
        l.errores.length ? (
          <Tag color="error" icon={<IcoTag de={TriangleAlert} />}>
            {t.conErrores}
          </Tag>
        ) : (
          <Tag color="success" icon={<IcoTag de={CircleCheck} />}>
            {t.filaOk}
          </Tag>
        ),
    },
    {
      key: 'errores',
      title: t.colError,
      width: token.controlHeightLG * 8,
      render: (_, l) =>
        l.errores.length ? (
          <Pila gap="sm">
            {l.errores.map((e, i) => (
              <Text key={i} type="danger" style={{ fontSize: token.fontSizeSM }}>
                {e}
              </Text>
            ))}
          </Pila>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    { key: 'nombre', title: COLUMNAS_TERRITORIO[0], render: (_, l) => l.nombre || <Text type="secondary">—</Text> },
    { key: 'region', title: COLUMNAS_TERRITORIO[1], render: (_, l) => nombreEstado(l.estado) ?? <Text type="secondary">{filas?.find((f) => f.fila === l.fila)?.region || '—'}</Text> },
    { key: 'subregion', title: COLUMNAS_TERRITORIO[2], render: (_, l) => l.subregion ?? <Text type="secondary">—</Text> },
    {
      key: 'zips',
      title: COLUMNAS_TERRITORIO[3],
      render: (_, l) => (
        <div style={{ maxWidth: token.controlHeightLG * 8 }}>
          <Text strong>{m.baselines.zipsConteo(l.zips.length)}</Text>
          <Text type="secondary" ellipsis={{ tooltip: l.zips.join(', ') }} style={{ display: 'block' }}>
            {l.zips.join(', ')}
          </Text>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open
      title={filas ? t.vistaPrevia : t.titulo}
      width={filas ? '90vw' : token.controlHeightLG * 16}
      onCancel={onCerrar}
      destroyOnHidden
      footer={
        <Flex gap={token.marginXS} justify="flex-end" wrap>
          <Button onClick={filas || error ? reiniciar : onCerrar}>{filas || error ? t.otro : m.comun.cancelar}</Button>
          {filas && (
            // Como en leads (H-026): solo con el 100 % de las filas bien. Deshabilitado, dice por qué.
            <Tooltip title={conError ? t.bloqueado : undefined}>
              <Button type="primary" icon={<Ico de={IconoSubir} />} disabled={conError > 0} loading={importando} onClick={importar}>
                {t.importarN(listas)}
              </Button>
            </Tooltip>
          )}
        </Flex>
      }
    >
      {!filas && (
        <Pila>
          <Tooltip title={t.reglas}>
            <Flex gap={token.marginXXS} align="center" style={{ width: 'fit-content', cursor: 'help' }} tabIndex={0}>
              <Ico de={Info} />
              <Text type="secondary">{t.reglasTitulo}</Text>
            </Flex>
          </Tooltip>
          {!error ? (
            <Upload.Dragger
              accept=".csv"
              showUploadList={false}
              beforeUpload={(f) => {
                void leer(f);
                return Upload.LIST_IGNORE;
              }}
            >
              <Flex vertical align="center" gap={token.marginXS} style={{ padding: token.padding }}>
                <Ico de={FileSpreadsheet} />
                <Text>{t.subir}</Text>
                <Cap>{t.subirAyuda}</Cap>
              </Flex>
            </Upload.Dragger>
          ) : (
            <Alert type="error" showIcon title={archivo ?? undefined} description={error} />
          )}
        </Pila>
      )}

      {filas && archivo && (
        <Pila gap="sm">
          <Flex justify="space-between" align="center" gap={token.margin} wrap>
            <Space size={token.marginLG} wrap>
              <Text type="secondary">{archivo}</Text>
              <Text>
                {t.total}: <Text strong>{leidos.length}</Text>
              </Text>
              <Text type="success">
                {t.validos}: <Text strong type="success">{listas}</Text>
              </Text>
              <Text type="danger">
                {t.conErrores}: <Text strong type="danger">{conError}</Text>
              </Text>
            </Space>
            {conError > 0 && (
              <Checkbox checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)}>
                {t.soloErrores}
              </Checkbox>
            )}
          </Flex>
          {conError > 0 && <Alert type="warning" showIcon title={t.bloqueado} />}
          <Tabla<TerritorioLeido>
            size="small"
            rowKey={(l) => String(l.fila)}
            dataSource={visibles}
            columns={columnas}
            scroll={{ x: 'max-content' }}
            pagination={visibles.length > 20 ? { pageSize: 20 } : false}
          />
        </Pila>
      )}
    </Modal>
  );
}

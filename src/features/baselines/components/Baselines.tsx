'use client';
/**
 * Configuración › Baselines: la información base del negocio (H-018).
 *
 * - Tabs `line` de nivel 1, una por tipo; el tab activo vive en la URL, `?vista=` (TAB-R08).
 * - Cada tab: búsqueda + estado (Vigentes / Inactivos / Todos), filtros activos como tags con
 *   «Limpiar filtros», y la acción de la vista en el encabezado de la tabla (TBL 3.4).
 * - Agregar o editar pide 3 campos o menos: `Modal` (FRM-R30). Desactivar es reversible y de un solo
 *   registro: `Popconfirm` (GLB-R10). Sin permiso, todo se ve igual pero sin acciones.
 */
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { App, Button, Checkbox, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Tabs, Tag, Typography, theme } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import { Download, Plus, Search, Upload as IconoSubir } from 'lucide-react';
import { Ico, Tabla } from '@arc2-0/claro-one-kit';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import type { TipoBaseline, ValorBaseline } from '@/dominio/baselines';
import { leerZips, nombreDe } from '@/dominio/baselines';
import { nombreRol, rolesProducto } from '@/dominio/roles';
import { useIdioma } from '@/i18n/cliente';
import type { Mensajes } from '@/i18n/mensajes';
import { ejecutarBaselines } from '../acciones';
import { SubirTerritorios } from './SubirTerritorios';
import type { AccionBaselines } from '../acciones';

const { Text } = Typography;

const VISTAS: TipoBaseline[] = ['carrier', 'state', 'lob', 'cargo', 'area', 'tipo-comision', 'territorio'];
const esVista = (v: string | null): v is TipoBaseline => !!v && (VISTAS as string[]).includes(v);

type FiltroEstado = 'vigentes' | 'inactivos' | 'todos';
interface Filtros {
  texto: string;
  estado: FiltroEstado;
}
const SIN_FILTROS: Filtros = { texto: '', estado: 'vigentes' };

function paginacion(total: number, m: Mensajes): TablePaginationConfig | false {
  if (total <= 20) return false;
  return { pageSize: 20, pageSizeOptions: [10, 20, 50, 100], showSizeChanger: true, showTotal: (t, [desde, hasta]) => m.directorio.paginacion(desde, hasta, t) };
}

/** Ejecuta una acción del contrato y avisa: éxito con `message`, rechazo con `message.error` y el motivo. */
function useEjecutar() {
  const { message } = App.useApp();
  const router = useRouter();
  const { m } = useIdioma();
  return async (accion: AccionBaselines, entrada: EntradaAccion) => {
    const r = await ejecutarBaselines(accion, entrada);
    if (!r.ok) {
      message.error(r.motivo);
      return false;
    }
    message.success(r.evento.salida ?? m.baselines.listo);
    router.refresh();
    return true;
  };
}

export function PantallaBaselines({ valores, puede }: { valores: ValorBaseline[]; puede: boolean }) {
  const { m } = useIdioma();
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const vistaUrl = params.get('vista');
  const vista: TipoBaseline = esVista(vistaUrl) ? vistaUrl : 'carrier';
  // Cada tab conserva sus filtros (TAB-R07).
  const [filtros, setFiltros] = useState<Record<TipoBaseline, Filtros>>({ carrier: SIN_FILTROS, state: SIN_FILTROS, lob: SIN_FILTROS, cargo: SIN_FILTROS, area: SIN_FILTROS, 'tipo-comision': SIN_FILTROS, territorio: SIN_FILTROS });

  return (
    <Tabs
      activeKey={vista}
      onChange={(v) => router.replace(`${ruta}?vista=${v}`, { scroll: false })}
      items={VISTAS.map((tipo) => ({
        key: tipo,
        label: m.baselines.vistas[tipo],
        children: (
          <PanelTipo
            tipo={tipo}
            valores={valores}
            puede={puede}
            filtros={filtros[tipo]}
            onCambio={(c) => setFiltros((f) => ({ ...f, [tipo]: { ...f[tipo], ...c } }))}
          />
        ),
      }))}
    />
  );
}

function PanelTipo({
  tipo,
  valores,
  puede,
  filtros,
  onCambio,
}: {
  tipo: TipoBaseline;
  valores: ValorBaseline[];
  puede: boolean;
  filtros: Filtros;
  onCambio: (c: Partial<Filtros>) => void;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const t = m.baselines;
  const ejecutar = useEjecutar();
  const [formulario, setFormulario] = useState<{ valor: ValorBaseline | null } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const lobs = valores.filter((v) => v.tipo === 'lob' && v.vigente).map((v) => ({ codigo: v.codigo, nombre: v.nombre }));
  // Áreas (H-038): las principales, y todas con su ruta («Operations › Service») para elegir las de un cargo.
  const areasVig = valores.filter((v) => v.tipo === 'area' && v.vigente);
  const rutaArea = (codigo: string) => {
    const a = areasVig.find((x) => x.codigo === codigo);
    const p = a?.padre ? areasVig.find((x) => x.codigo === a.padre) : undefined;
    return a ? (p ? `${p.nombre} › ${a.nombre}` : a.nombre) : codigo;
  };
  const opcionesAreas = areasVig.map((a) => ({ value: a.codigo, label: rutaArea(a.codigo) })).sort((a, b) => a.label.localeCompare(b.label));
  const principales = areasVig.filter((a) => !a.padre).map((a) => ({ codigo: a.codigo, nombre: a.nombre }));
  const estadosUS = valores.filter((v) => v.tipo === 'state' && v.vigente).map((v) => ({ codigo: v.codigo, nombre: v.nombre })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const q = filtros.texto.trim().toLowerCase();
  const filas = valores
    .filter((v) => v.tipo === tipo)
    .filter((v) => (filtros.estado === 'todos' ? true : filtros.estado === 'vigentes' ? v.vigente : !v.vigente))
    .filter((v) => !q || v.nombre.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q) || v.zips.some((z) => z.startsWith(q)) || (v.estado ?? '').toLowerCase() === q)
    .sort((a, b) => (tipo === 'state' ? a.codigo.localeCompare(b.codigo) : a.nombre.localeCompare(b.nombre)));

  const activos = [
    ...(filtros.texto ? [{ key: 'texto', label: t.filtroBusqueda(filtros.texto), quitar: { texto: '' } }] : []),
    ...(filtros.estado !== 'vigentes' ? [{ key: 'estado', label: t.filtroEstado(t.estados[filtros.estado]), quitar: { estado: 'vigentes' as const } }] : []),
  ];

  const columnas: TableColumnsType<ValorBaseline> = [
    ...(tipo === 'state' ? [{ key: 'codigo', title: t.codigo, width: token.controlHeightLG * 2, render: (_: unknown, v: ValorBaseline) => <Text strong>{v.codigo}</Text> }] : []),
    {
      key: 'nombre',
      title: m.comun.nombre,
      fixed: 'left',
      render: (_, v) =>
        puede && v.vigente ? <Typography.Link onClick={() => setFormulario({ valor: v })}>{v.nombre}</Typography.Link> : <Text type={v.vigente ? undefined : 'secondary'}>{v.nombre}</Text>,
    },
    ...(tipo === 'carrier'
      ? [
          {
            key: 'lobs',
            title: t.lobs,
            render: (_: unknown, v: ValorBaseline) => (
              <Space size={token.marginXXS} wrap>
                {v.lobs.map((l) => (
                  <Tag key={l}>{nombreDe(lobs, l)}</Tag>
                ))}
              </Space>
            ),
          },
        ]
      : []),
    ...(tipo === 'area'
      ? [
          {
            key: 'padre',
            title: t.perteneceA,
            render: (_: unknown, v: ValorBaseline) => (v.padre ? <Tag>{nombreDe(principales, v.padre)}</Tag> : <Text type="secondary">{t.areaPrincipal}</Text>),
          },
        ]
      : []),
    ...(tipo === 'cargo'
      ? [
          {
            key: 'areasCargo',
            title: t.areasDelCargo,
            render: (_: unknown, v: ValorBaseline) => (
              <Space size={token.marginXXS} wrap>
                {v.areas.map((a) => (
                  <Tag key={a}>{rutaArea(a)}</Tag>
                ))}
              </Space>
            ),
          },
        ]
      : []),
    ...(tipo === 'territorio'
      ? [
          {
            key: 'estadoUS',
            title: t.estadoUS,
            render: (_: unknown, v: ValorBaseline) => (v.estado ? <Tag>{nombreDe(estadosUS, v.estado)}</Tag> : null),
          },
          {
            key: 'subregion',
            title: t.subregion,
            render: (_: unknown, v: ValorBaseline) => v.subregion ?? <Text type="secondary">—</Text>,
          },
          {
            key: 'zips',
            title: t.zips,
            render: (_: unknown, v: ValorBaseline) => (
              <div style={{ maxWidth: token.controlHeightLG * 10 }}>
                <Text strong>{t.zipsConteo(v.zips.length)}</Text>
                <Text type="secondary" ellipsis={{ tooltip: v.zips.join(', ') }} style={{ display: 'block' }}>
                  {v.zips.join(', ')}
                </Text>
              </div>
            ),
          },
        ]
      : []),
    ...(tipo === 'cargo'
      ? [
          {
            key: 'roles',
            title: t.roles,
            render: (_: unknown, v: ValorBaseline) => (
              <Space size={token.marginXXS} wrap>
                {v.roles.map((r) => (
                  <Tag key={r}>{nombreRol(r, idioma)}</Tag>
                ))}
              </Space>
            ),
          },
        ]
      : []),
    {
      key: 'estado',
      title: t.estado,
      render: (_, v) => (v.vigente ? <Text>{t.estados.vigente}</Text> : <Text type="secondary">{t.inactivoDesde(v.hasta ?? '—')}</Text>),
    },
    { key: 'desde', title: m.comun.desde, render: (_, v) => v.desde },
    ...(puede
      ? [
          {
            key: 'acciones',
            title: '',
            align: 'right' as const,
            render: (_: unknown, v: ValorBaseline) =>
              v.vigente ? (
                <Popconfirm
                  title={t.desactivarPregunta(v.nombre)}
                  description={t.desactivarNota}
                  okText={t.desactivar}
                  cancelText={m.comun.cancelar}
                  onConfirm={() => ejecutar('desactivar-valor', { valorId: v.id })}
                >
                  <Button type="link" size="small" aria-label={`${t.desactivar} ${v.nombre}`}>
                    {t.desactivar}
                  </Button>
                </Popconfirm>
              ) : (
                <Button type="link" size="small" aria-label={`${t.reactivar} ${v.nombre}`} onClick={() => ejecutar('reactivar-valor', { valorId: v.id })}>
                  {t.reactivar}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div style={{ marginBottom: token.margin }}>
        <div style={{ display: 'flex', gap: token.margin, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            allowClear
            aria-label={t.buscar[tipo]}
            placeholder={t.buscar[tipo]}
            prefix={<Ico de={Search} />}
            value={filtros.texto}
            onChange={(e) => onCambio({ texto: e.target.value })}
            style={{ width: token.controlHeightLG * 8, maxWidth: '100%' }}
          />
          <Segmented
            aria-label={t.estado}
            value={filtros.estado}
            onChange={(v) => onCambio({ estado: v as FiltroEstado })}
            options={(['vigentes', 'inactivos', 'todos'] as const).map((e) => ({ value: e, label: t.estados[e] }))}
          />
          <Text type="secondary" style={{ marginInlineStart: 'auto' }}>
            {t.total(filas.length)}
          </Text>
        </div>
        {activos.length > 0 && (
          <Space size={token.marginXS} wrap style={{ marginTop: token.marginSM }}>
            {activos.map((a) => (
              <Tag key={a.key} closable onClose={(e) => { e.preventDefault(); onCambio(a.quitar); }}>
                {a.label}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => onCambio(SIN_FILTROS)}>
              {m.comun.limpiarFiltros}
            </Button>
          </Space>
        )}
      </div>

      <Tabla<ValorBaseline>
        toolbar={
          puede ? (
            <Space size={token.marginXS} wrap>
              {tipo === 'territorio' && (
                <>
                  {/* La plantilla sale solo con su encabezado (H-039). */}
                  <Button icon={<Ico de={Download} />} href="/api/plantillas/territorios">
                    {t.importar.plantilla}
                  </Button>
                  <Button icon={<Ico de={IconoSubir} />} onClick={() => setSubiendo(true)}>
                    {t.importar.boton}
                  </Button>
                </>
              )}
              <Button type="primary" icon={<Ico de={Plus} />} onClick={() => setFormulario({ valor: null })}>
                {t.agregar[tipo]}
              </Button>
            </Space>
          ) : undefined
        }
        key={`${filtros.estado}-${q}`}
        size="middle"
        rowKey="id"
        dataSource={filas}
        columns={columnas}
        pagination={paginacion(filas.length, m)}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={activos.length ? m.directorio.sinResultados : t.vacio}>
              {activos.length > 0 && (
                <Button size="small" onClick={() => onCambio(SIN_FILTROS)}>
                  {m.comun.limpiarFiltros}
                </Button>
              )}
            </Empty>
          ),
        }}
      />

      {subiendo && (
        <SubirTerritorios
          estados={estadosUS}
          existentes={valores.filter((v) => v.tipo === 'territorio').map((v) => ({ nombre: v.nombre, zips: v.vigente ? v.zips : [] }))}
          onImportar={ejecutar}
          onCerrar={() => setSubiendo(false)}
        />
      )}

      {formulario && (
        <FormularioValor tipo={tipo} valor={formulario.valor} lobs={lobs} estadosUS={estadosUS} opcionesAreas={opcionesAreas} principales={principales} onCerrar={() => setFormulario(null)} onGuardar={ejecutar} />
      )}
    </>
  );
}

interface ValoresForm {
  codigo?: string;
  nombre: string;
  lobs?: string[];
  roles?: string[];
  estado?: string;
  zips?: string;
  subregion?: string;
  padre?: string;
  areas?: string[];
}

function FormularioValor({
  tipo,
  valor,
  lobs,
  estadosUS,
  opcionesAreas,
  principales,
  onCerrar,
  onGuardar,
}: {
  tipo: TipoBaseline;
  valor: ValorBaseline | null;
  lobs: { codigo: string; nombre: string }[];
  estadosUS: { codigo: string; nombre: string }[];
  opcionesAreas: { value: string; label: string }[];
  principales: { codigo: string; nombre: string }[];
  onCerrar: () => void;
  onGuardar: ReturnType<typeof useEjecutar>;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const { modal } = App.useApp();
  const t = m.baselines;
  const [form] = Form.useForm<ValoresForm>();
  const [guardando, setGuardando] = useState(false);
  const zipsTexto = Form.useWatch('zips', form) ?? '';
  const lectura = leerZips(zipsTexto);

  const cancelar = () => {
    if (!form.isFieldsTouched()) return onCerrar();
    const f = m.directorio.form;
    modal.confirm({ title: f.descartarTitulo, content: f.descartarTexto, okText: f.descartar, okButtonProps: { danger: true }, cancelText: f.seguir, onOk: onCerrar });
  };

  return (
    <Modal
      open
      title={valor ? t.editarTitulo(valor.nombre) : t.agregar[tipo]}
      okText={valor ? t.guardar : t.agregarBoton}
      cancelText={m.comun.cancelar}
      confirmLoading={guardando}
      onOk={() => form.submit()}
      onCancel={cancelar}
      destroyOnHidden
    >
      <Form<ValoresForm>
        form={form}
        layout="vertical"
        colon={false}
        requiredMark
        scrollToFirstError
        initialValues={valor ? { nombre: valor.nombre, lobs: valor.lobs.filter((l) => lobs.some((x) => x.codigo === l)), roles: valor.roles, estado: valor.estado ?? undefined, zips: valor.zips.join(', '), subregion: valor.subregion ?? undefined, padre: valor.padre ?? undefined, areas: valor.areas } : {}}
        onFinish={async (v) => {
          setGuardando(true);
          const entrada: EntradaAccion = {
            nombre: v.nombre,
            ...(tipo === 'carrier' ? { lobs: (v.lobs ?? []).join(',') } : {}),
            ...(tipo === 'cargo' ? { roles: (v.roles ?? []).join(',') } : {}),
            ...(tipo === 'territorio' ? { estado: v.estado ?? '', subregion: v.subregion ?? '', zips: v.zips ?? '' } : {}),
            ...(tipo === 'area' ? { padre: v.padre ?? '' } : {}),
            ...(tipo === 'cargo' ? { areas: (v.areas ?? []).join('|') } : {}),
          };
          const ok = valor
            ? await onGuardar('editar-valor', { valorId: valor.id, ...entrada })
            : await onGuardar('agregar-valor', { tipo, ...entrada, ...(tipo === 'state' ? { codigo: (v.codigo ?? '').toUpperCase() } : {}) });
          setGuardando(false);
          if (ok) onCerrar();
        }}
      >
        {tipo === 'state' &&
          (valor ? (
            <Form.Item label={t.codigo}>
              <Text strong>{valor.codigo}</Text>
            </Form.Item>
          ) : (
            <Form.Item
              name="codigo"
              label={t.codigo}
              extra={t.codigoEstadoAyuda}
              validateTrigger="onBlur"
              rules={[{ required: true, pattern: /^[A-Za-z]{2}$/, message: t.errCodigoEstado }]}
            >
              <Input style={{ width: token.controlHeightLG * 2 }} maxLength={2} placeholder="FL" autoComplete="off" />
            </Form.Item>
          ))}
        <Form.Item name="nombre" label={m.comun.nombre} validateTrigger="onBlur" rules={[{ required: true, whitespace: true, message: t.errNombre }, { max: 60, message: t.errNombreLargo }]}>
          <Input autoComplete="off" />
        </Form.Item>
        {tipo === 'carrier' && (
          <Form.Item name="lobs" label={t.lobsQueVende} rules={[{ required: true, type: 'array', min: 1, message: t.errLobs }]}>
            <Checkbox.Group options={lobs.map((l) => ({ value: l.codigo, label: l.nombre }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>
        )}
        {tipo === 'area' && (
          <Form.Item name="padre" label={t.perteneceA} extra={t.perteneceAyuda}>
            <Select allowClear placeholder={t.areaPrincipal} options={principales.filter((p) => p.codigo !== valor?.codigo).map((p) => ({ value: p.codigo, label: p.nombre }))} />
          </Form.Item>
        )}
        {tipo === 'territorio' && (
          <>
            <Form.Item name="estado" label={t.estadoUS} rules={[{ required: true, message: t.errEstadoUS }]}>
              <Select showSearch={{ optionFilterProp: 'label' }} options={estadosUS.map((e) => ({ value: e.codigo, label: `${e.codigo} · ${e.nombre}` }))} />
            </Form.Item>
            <Form.Item name="subregion" label={t.subregion} rules={[{ max: 60, message: t.errNombreLargo }]}>
              <Input autoComplete="off" placeholder="Miami-Dade" />
            </Form.Item>
            <Form.Item
              name="zips"
              label={t.zips}
              extra={
                <span>
                  {t.zipsAyuda} <Text strong>{t.zipsConteo(lectura.zips.length)}</Text>
                  {lectura.invalidos.length > 0 && <Text type="danger"> · {t.zipsInvalidos(lectura.invalidos.slice(0, 5).join(', '))}</Text>}
                </span>
              }
              rules={[{ required: true, whitespace: true, message: t.errZips }]}
            >
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} placeholder="33602, 33603, 33604" />
            </Form.Item>
          </>
        )}
        {tipo === 'cargo' && (
          <Form.Item name="areas" label={t.areasDelCargo} extra={t.areasDelCargoAyuda} rules={[{ required: true, type: 'array', min: 1, message: t.errAreasCargo }]}>
            <Select mode="multiple" showSearch={{ optionFilterProp: 'label' }} options={opcionesAreas} />
          </Form.Item>
        )}
        {tipo === 'cargo' && (
          <Form.Item name="roles" label={t.rolesDelCargo} rules={[{ required: true, type: 'array', min: 1, message: t.errRoles }]}>
            <Checkbox.Group options={rolesProducto(idioma).map((r) => ({ value: r.id, label: r.nombre }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

'use client';
/**
 * Lo que se relaciona con una agencia sin ser parte de su organización (H-017): sus labels, sus
 * compañías internas, sus líneas de negocio y su equipo de trabajo de Claro (Work Team).
 *
 * Cada cambio pasa por el contrato `gestion-de-agencias`. Quitar es reversible y de un solo registro:
 * `Popconfirm` (GLB-R10); quitar cierra la relación, no la borra. Relacionar o asignar pide menos de
 * 5 campos: `Modal` (FRM-R30). Sin permiso, todo se ve igual pero sin acciones.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Checkbox, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Tag, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { Plus, UserPlus } from 'lucide-react';
import { COMPANIAS, nombreCompania } from '@arc2-0/claro-one-kit/dominio';
import { Cap, Ico, Tabla } from '@arc2-0/claro-one-kit';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import type { AgenciaDirectorio, DirectorioCompleto, MiembroEquipoClaro, NegociacionLegacy } from '@/dominio/directorio';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarAgencias } from '../acciones';
import type { AccionAgencias } from '../acciones';
import { nombreDe } from '@/dominio/baselines';
import type { OpcionBaseline } from '@/dominio/baselines';
import { ROLES_EQUIPO } from '../contrato';

const { Text } = Typography;
const marca = (cid: string) => (cid === 'atoz' ? 'AtoZ' : 'Claro');

/** Ejecuta una acción del contrato y avisa: éxito con `message`, rechazo con `message.error` y el motivo. */
export function useEjecutar() {
  const { message } = App.useApp();
  const router = useRouter();
  const { m } = useIdioma();
  return async (accion: AccionAgencias, entrada: EntradaAccion) => {
    const r = await ejecutarAgencias(accion, entrada);
    if (!r.ok) {
      message.error(r.motivo);
      return false;
    }
    message.success(r.evento.salida ?? m.directorio.relaciones.listo);
    router.refresh();
    return true;
  };
}

/**
 * Un Tag con «x» que pide confirmación antes de quitar (GLB-R10). El Tag de antd frena el clic de su
 * «x», así que el `Popconfirm` se abre a mano desde `onClose`.
 */
function TagQuitable({ texto, pregunta, descripcion, onQuitar, title }: { texto: string; pregunta: string; descripcion?: string; onQuitar: () => void; title?: string }) {
  const { m } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  return (
    <Popconfirm
      open={abierto}
      onOpenChange={(v) => !v && setAbierto(false)}
      title={pregunta}
      {...(descripcion ? { description: descripcion } : {})}
      okText={m.directorio.relaciones.quitar}
      cancelText={m.comun.cancelar}
      onConfirm={() => {
        setAbierto(false);
        onQuitar();
      }}
      onCancel={() => setAbierto(false)}
    >
      <Tag
        closable
        onClose={(e) => {
          e.preventDefault();
          setAbierto(true);
        }}
        {...(title ? { title } : {})}
      >
        {texto}
      </Tag>
    </Popconfirm>
  );
}

/* ----------------------------------------------------------------- labels */

export function EtiquetasAgencia({ agencia, puede }: { agencia: AgenciaDirectorio; puede: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.relaciones;
  const ejecutar = useEjecutar();
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');

  async function agregar() {
    const v = texto.trim();
    if (v && (await ejecutar('agregar-etiqueta', { agenciaId: agencia.id, texto: v }))) setTexto('');
    setEscribiendo(false);
  }

  return (
    <Flex gap={token.marginXS} wrap align="center" aria-label={t.etiquetas}>
      {agencia.etiquetas.length === 0 && !puede && <Cap>{t.sinEtiquetas}</Cap>}
      {agencia.etiquetas.map((e) =>
        puede ? (
          <TagQuitable key={e.id} texto={e.texto} pregunta={t.quitarEtiqueta(e.texto)} onQuitar={() => ejecutar('quitar-etiqueta', { etiquetaId: e.id })} />
        ) : (
          <Tag key={e.id}>{e.texto}</Tag>
        ),
      )}
      {puede &&
        (escribiendo ? (
          <Input
            size="small"
            autoFocus
            maxLength={40}
            aria-label={t.nuevaEtiqueta}
            placeholder={t.nuevaEtiqueta}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPressEnter={agregar}
            onBlur={agregar}
            style={{ width: token.controlHeightLG * 4 }}
          />
        ) : (
          <Button size="small" type="dashed" icon={<Ico de={Plus} />} onClick={() => setEscribiendo(true)}>
            {t.agregarEtiqueta}
          </Button>
        ))}
    </Flex>
  );
}

/* ------------------------------------------------------------- compañías */

export function CompaniasAgencia({ agencia, puede }: { agencia: AgenciaDirectorio; puede: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.relaciones;
  const ejecutar = useEjecutar();
  const faltan = COMPANIAS.filter((c) => !agencia.companias.includes(c.id));
  const unica = agencia.companias.length === 1;

  return (
    <Flex gap={token.marginXS} wrap align="center">
      {agencia.companias.map((c) =>
        puede && !unica ? (
          <TagQuitable key={c} texto={marca(c)} title={nombreCompania(c)} pregunta={t.quitarCompania(marca(c))} onQuitar={() => ejecutar('quitar-compania', { agenciaId: agencia.id, compania: c })} />
        ) : (
          <Tag key={c} title={puede && unica ? t.unaCompania : nombreCompania(c)}>
            {marca(c)}
          </Tag>
        ),
      )}
      {puede &&
        faltan.map((c) => (
          <Popconfirm key={c.id} title={t.confirmarCompania(marca(c.id))} okText={t.relacionar} cancelText={m.comun.cancelar} onConfirm={() => ejecutar('relacionar-compania', { agenciaId: agencia.id, compania: c.id })}>
            <Button size="small" type="dashed" icon={<Ico de={Plus} />}>
              {t.relacionarCompania(marca(c.id))}
            </Button>
          </Popconfirm>
        ))}
    </Flex>
  );
}

/* ------------------------------------------------------- líneas de negocio */

export function LobsAgencia({ agencia, opciones, puede }: { agencia: AgenciaDirectorio; opciones: OpcionBaseline[]; puede: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.relaciones;
  const ejecutar = useEjecutar();
  const [abierto, setAbierto] = useState(false);
  const [form] = Form.useForm<{ lobs: string[] }>();
  // Las opciones salen de Configuración › Baselines (H-018): solo las vigentes que la agencia no tiene.
  const disponibles = opciones.filter((o) => !agencia.lobs.some((x) => x.lob === o.codigo));

  return (
    <Flex gap={token.marginXS} wrap align="center">
      {agencia.lobs.length === 0 && <Text type="secondary">{t.sinLobs}</Text>}
      {agencia.lobs.map((l) =>
        puede ? (
          <TagQuitable key={l.id} texto={nombreDe(opciones, l.lob)} pregunta={t.quitarLob(nombreDe(opciones, l.lob))} onQuitar={() => ejecutar('quitar-lob', { relacionId: l.id })} />
        ) : (
          <Tag key={l.id}>{nombreDe(opciones, l.lob)}</Tag>
        ),
      )}
      {puede && disponibles.length > 0 && (
        <Button size="small" type="dashed" icon={<Ico de={Plus} />} onClick={() => setAbierto(true)}>
          {t.relacionarLob}
        </Button>
      )}
      <Modal
        open={abierto}
        title={t.tituloLob}
        okText={t.relacionar}
        cancelText={m.comun.cancelar}
        onOk={() => form.submit()}
        onCancel={() => setAbierto(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          colon={false}
          onFinish={async (v) => {
            if (await ejecutar('relacionar-lob', { agenciaId: agencia.id, lobs: v.lobs.join(',') })) setAbierto(false);
          }}
        >
          <Form.Item name="lobs" label={t.lob} rules={[{ required: true, type: 'array', min: 1, message: t.errLob }]}>
            <Checkbox.Group options={disponibles.map((o) => ({ value: o.codigo, label: o.nombre }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}

/* --------------------------------------------------- equipo de trabajo de Claro */

export function PanelEquipoClaro({ agencia, directorio, puede }: { agencia: AgenciaDirectorio; directorio: DirectorioCompleto; puede: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.relaciones;
  const ejecutar = useEjecutar();
  const [abierto, setAbierto] = useState(false);
  const [form] = Form.useForm<{ empleadoId: string; rol: string }>();
  const miembros = directorio.equipoClaro.filter((x) => x.agenciaId === agencia.id).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const columnas: TableColumnsType<MiembroEquipoClaro> = [
    {
      key: 'persona',
      title: t.persona,
      render: (_, x) => (
        <div>
          <Text>{x.nombre}</Text>
          {x.puesto && (
            <div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {x.puesto}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    { key: 'rol', title: t.rol, render: (_, x) => t.roles[x.rol] },
    { key: 'desde', title: m.comun.desde, render: (_, x) => x.desde },
    ...(puede
      ? [
          {
            key: 'acciones',
            title: '',
            align: 'right' as const,
            render: (_: unknown, x: MiembroEquipoClaro) => (
              <Popconfirm title={t.quitarMiembro(x.nombre)} description={t.quitarNota} okText={t.quitar} cancelText={m.comun.cancelar} onConfirm={() => ejecutar('quitar-equipo-claro', { asignacionId: x.id })}>
                <Button type="link" size="small" aria-label={`${t.quitar} ${x.nombre}`}>
                  {t.quitar}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" gap={token.marginXS} wrap style={{ marginBottom: token.marginXS }}>
        <Cap>{t.equipoClaroAyuda}</Cap>
        {puede && (
          <Button size="small" icon={<Ico de={UserPlus} />} onClick={() => setAbierto(true)}>
            {t.asignar}
          </Button>
        )}
      </Flex>
      <Tabla<MiembroEquipoClaro>
        size="small"
        rowKey="id"
        dataSource={miembros}
        columns={columnas}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.sinEquipo} /> }}
      />
      <Modal
        open={abierto}
        title={t.tituloAsignar(agencia.nombre)}
        okText={t.asignarBoton}
        cancelText={m.comun.cancelar}
        onOk={() => form.submit()}
        onCancel={() => setAbierto(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          colon={false}
          requiredMark
          onFinish={async (v) => {
            if (await ejecutar('asignar-equipo-claro', { agenciaId: agencia.id, empleadoId: v.empleadoId, rol: v.rol })) setAbierto(false);
          }}
        >
          <Form.Item name="empleadoId" label={t.persona} rules={[{ required: true, message: t.errPersona }]}>
            <Select showSearch={{ optionFilterProp: 'label' }} options={directorio.empleados.map((e) => ({ value: e.id, label: `${e.nombre} · ${e.puesto}` }))} />
          </Form.Item>
          <Form.Item name="rol" label={t.rol} rules={[{ required: true, message: t.errRol }]}>
            <Radio.Group options={ROLES_EQUIPO.map((r) => ({ value: r, label: t.roles[r] }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------- negociaciones especiales Legacy (H-022) */

/**
 * Las negociaciones especiales tipo Legacy de una agencia legacy. Agregar pide 5 campos: `Modal`
 * (FRM-R30); quitar es reversible y de un solo registro: `Popconfirm` (GLB-R10) y cierra el intervalo.
 */
export function NegociacionesLegacy({ agencia, opcionesLob, puede }: { agencia: AgenciaDirectorio; opcionesLob: OpcionBaseline[]; puede: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.legacy;
  const ejecutar = useEjecutar();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [form] = Form.useForm<{ compania: 'claro' | 'atoz'; lob: string; tasaAgente: number; cargoAdministrativo?: number; detalle: string }>();
  const unaCompania = agencia.companias.length === 1 ? (agencia.companias[0] as 'claro' | 'atoz') : undefined;

  const columnas: TableColumnsType<NegociacionLegacy> = [
    {
      key: 'lob',
      title: t.lob,
      render: (_, n) => (
        <div>
          <Text>{nombreDe(opcionesLob, n.lob)}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {marca(n.compania)} · {n.detalle}
            </Text>
          </div>
        </div>
      ),
    },
    { key: 'tasa', title: t.tasa, align: 'right', render: (_, n) => `${n.tasaAgente}%` },
    { key: 'cargo', title: t.cargo, align: 'right', render: (_, n) => (n.cargoAdministrativo === null ? <Text type="secondary">—</Text> : `$${n.cargoAdministrativo}`) },
    { key: 'desde', title: t.desde, render: (_, n) => n.desde },
    ...(puede
      ? [
          {
            key: 'acciones',
            title: '',
            align: 'right' as const,
            render: (_: unknown, n: NegociacionLegacy) => (
              <Popconfirm
                title={t.quitarPregunta(nombreDe(opcionesLob, n.lob))}
                description={t.quitarNota}
                okText={t.quitar}
                cancelText={m.comun.cancelar}
                onConfirm={() => ejecutar('quitar-negociacion-legacy', { negociacionId: n.id })}
              >
                <Button type="link" size="small" danger>
                  {t.quitar}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  return (
    <section>
      <Flex justify="space-between" align="center" gap={token.marginXS} wrap style={{ marginBottom: token.marginXS }}>
        <Text strong>
          {t.titulo} ({agencia.negociacionesLegacy.length})
        </Text>
        {puede && (
          <Button size="small" icon={<Ico de={Plus} />} onClick={() => setAbierto(true)}>
            {t.agregar}
          </Button>
        )}
      </Flex>
      <Tabla<NegociacionLegacy>
        size="small"
        rowKey="id"
        dataSource={agencia.negociacionesLegacy}
        columns={columnas}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.vacio} /> }}
      />
      <Modal
        open={abierto}
        title={t.tituloAgregar(agencia.nombre)}
        okText={t.registrar}
        cancelText={m.comun.cancelar}
        confirmLoading={enviando}
        onOk={() => form.submit()}
        onCancel={() => setAbierto(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          colon={false}
          initialValues={unaCompania ? { compania: unaCompania } : {}}
          onFinish={async (v) => {
            setEnviando(true);
            const ok = await ejecutar('agregar-negociacion-legacy', {
              agenciaId: agencia.id,
              compania: v.compania,
              lob: v.lob,
              tasaAgente: String(v.tasaAgente),
              cargoAdministrativo: v.cargoAdministrativo === undefined || v.cargoAdministrativo === null ? '' : String(v.cargoAdministrativo),
              detalle: v.detalle,
            });
            setEnviando(false);
            if (ok) setAbierto(false);
          }}
        >
          {/* La compañía solo se elige si la agencia pertenece a las dos (FRM-R44). */}
          <Form.Item name="compania" label={t.compania} rules={[{ required: true, message: t.errCompania }]} hidden={!!unaCompania}>
            <Radio.Group options={agencia.companias.map((c) => ({ value: c, label: marca(c) }))} />
          </Form.Item>
          <Form.Item name="lob" label={t.lob} rules={[{ required: true, message: t.errLob }]}>
            <Select showSearch={{ optionFilterProp: 'label' }} options={opcionesLob.map((o) => ({ value: o.codigo, label: o.nombre }))} />
          </Form.Item>
          <Flex gap={token.margin} wrap>
            <Form.Item name="tasaAgente" label={t.tasa} extra={t.tasaAyuda} rules={[{ required: true, type: 'number', min: 0, max: 100, message: t.errTasa }]}>
              <InputNumber min={0} max={100} step={1} suffix="%" style={{ width: token.controlHeightLG * 3 }} />
            </Form.Item>
            <Form.Item name="cargoAdministrativo" label={t.cargo}>
              <InputNumber min={0} step={1} prefix="$" style={{ width: token.controlHeightLG * 3 }} />
            </Form.Item>
          </Flex>
          <Form.Item name="detalle" label={t.detalle} rules={[{ required: true, whitespace: true, message: t.errDetalle }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

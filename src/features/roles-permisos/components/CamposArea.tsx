'use client';
/**
 * Campos por área (H-027): los datos que cada área necesita de sus usuarios.
 *
 * - `ConfigurarCamposArea`: Drawer con los campos del área; agregar y editar van en un Modal (actuar).
 * - `DatosAreaPerfil`: los datos del área en el detalle de la persona, solo para mirar.
 * - `EditorDatosArea`: los mismos campos, editables, dentro de «Editar» del detalle (un solo punto de edición).
 * - `valorVisible` y `EstadoDatosArea`: cómo se ve un valor y si a la persona le faltan obligatorios.
 *
 * Todo por props: la pantalla no sabe de la base. Las escrituras pasan por `ejecutarCamposArea`.
 */
import { useState } from 'react';
import { Button, Checkbox, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Cap, EstadoConMotivo, FechaISO, Ico, Tabla, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { FUENTES_OPCIONES, TIPOS_CAMPO, camposDeArea, camposDePersona, codigosDe, esLista, faltantes, opcionesDe, valorDe } from '@/dominio/camposArea';
import type { CampoArea, CatalogosCampos, FuenteOpciones, RolEnArea, TipoCampo, ValorCampoArea } from '@/dominio/camposArea';
import type { OpcionBaseline } from '@/dominio/baselines';
import { nombreRol, rolesProducto } from '@/dominio/roles';
import { useIdioma } from '@/i18n/cliente';
import type { EjecutarCamposArea } from '../useCamposArea';

const { Text } = Typography;

type Textos = ReturnType<typeof useIdioma>['m']['rolesPermisos']['camposArea'];

/** Cómo se ve un valor guardado. */
export function valorVisible(campo: CampoArea, valor: string | null, t: Textos, catalogos: CatalogosCampos) {
  if (valor === null) return <Text type="secondary">{t.sinValor}</Text>;
  if (campo.tipo === 'si-no') return valor === 'si' ? t.si : t.no;
  // Una opción de Datos base que se desactivó se sigue viendo con su código.
  const nombre = (c: string) => opcionesDe(campo, catalogos).find((o) => o.codigo === c)?.nombre ?? c;
  if (campo.tipo === 'lista') return nombre(valor);
  if (campo.tipo === 'multi-lista')
    return codigosDe(valor).map((c) => (
      <Tag key={c}>
        {nombre(c)}
      </Tag>
    ));
  return valor;
}

/** Completo o cuántos obligatorios le faltan, con el motivo (P1). Nada si el área no pide obligatorios. */
export function EstadoDatosArea({ campos, valores, empleadoId, areas, roles }: { campos: CampoArea[]; valores: ValorCampoArea[]; empleadoId: string; areas: string[]; roles: RolEnArea[] }) {
  const t = useIdioma().m.rolesPermisos.camposArea;
  // Solo cuentan los campos que se le piden a esta persona (H-040).
  if (!camposDePersona(campos, areas, roles, (id) => valorDe(valores, empleadoId, id)).some((c) => c.obligatorio)) return null;
  const falta = faltantes(campos, valores, empleadoId, areas, roles);
  return falta.length ? (
    <EstadoConMotivo compacto est="at-risk" etiqueta={t.faltan(falta.length)} motivo={t.faltanMotivo(falta.map((c) => c.etiqueta).join(', '))} />
  ) : (
    <EstadoConMotivo compacto est="ok" etiqueta={t.completo} motivo={t.completoMotivo} />
  );
}

/* ------------------------------------------------------- configurar (Drawer + Modal) */

export function ConfigurarCamposArea({
  abierto,
  area,
  areaNombre,
  campos,
  subareas,
  puede,
  ejecutar,
  onCerrar,
}: {
  abierto: boolean;
  area: string;
  areaNombre: string;
  campos: CampoArea[];
  /** Las sub-áreas vigentes de esta área: para «Solo para» (H-040). */
  subareas: OpcionBaseline[];
  puede: boolean;
  ejecutar: EjecutarCamposArea;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const t = m.rolesPermisos.camposArea;
  const [formulario, setFormulario] = useState<{ campo: CampoArea | null } | null>(null);
  const delArea = camposDeArea(campos, area);
  /** «Doer · New Business, Growth · si On field = Sí», o «A todos». */
  const aQuien = (c: CampoArea) =>
    [
      c.soloRoles.map((r) => nombreRol(r, idioma)).join(', '),
      c.soloSubareas.map((s) => subareas.find((x) => x.codigo === s)?.nombre ?? s).join(', '),
      c.dependeDe ? t.siCampo(delArea.find((x) => x.id === c.dependeDe)?.etiqueta ?? '—', c.dependeValor === 'no' ? t.no : t.si) : '',
    ]
      .filter(Boolean)
      .join(' · ') || t.aTodos;

  const columnas: TableColumnsType<CampoArea> = [
    { key: 'etiqueta', title: t.etiqueta, render: (_, c) => <Text strong>{c.etiqueta}</Text> },
    {
      key: 'tipo',
      title: t.tipo,
      render: (_, c) => (
        <span>
          {t.tipos[c.tipo]}
          {esLista(c.tipo) && <Cap>{c.fuente === 'propias' ? c.opciones.join(' · ') : t.fuentes[c.fuente]}</Cap>}
          {c.filtradoPor && <Cap>{t.porCampo(delArea.find((x) => x.id === c.filtradoPor)?.etiqueta ?? '—')}</Cap>}
        </span>
      ),
    },
    { key: 'obligatorio', title: t.obligatorio, render: (_, c) => (c.obligatorio ? <Tag color="gold">{t.si}</Tag> : <Text type="secondary">{t.no}</Text>) },
    { key: 'aquien', title: t.aQuien, render: (_, c) => <Text type={c.soloRoles.length || c.dependeDe ? undefined : 'secondary'}>{aQuien(c)}</Text> },
    ...(puede
      ? [
          {
            key: 'acc',
            title: '',
            align: 'right' as const,
            render: (_: unknown, c: CampoArea) => (
              <span style={{ whiteSpace: 'nowrap' }}>
                <Button type="link" size="small" icon={<Ico de={Pencil} />} aria-label={`${t.editar} ${c.etiqueta}`} onClick={() => setFormulario({ campo: c })} />
                <Popconfirm title={`${t.desactivar} «${c.etiqueta}»`} okText={t.desactivar} cancelText={m.comun.cancelar} onConfirm={() => ejecutar('desactivar-campo', { campoId: c.id })}>
                  <Button type="link" size="small" danger icon={<Ico de={Trash2} />} aria-label={`${t.desactivar} ${c.etiqueta}`} />
                </Popconfirm>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Drawer open={abierto} title={t.titulo(areaNombre)} size={token.controlHeightLG * 16} onClose={onCerrar}>
      <Cap style={{ marginBottom: token.margin }}>{t.nota}</Cap>
      <Tabla<CampoArea>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={delArea}
        columns={columnas}
        toolbar={
          puede && (
            <Button type="primary" icon={<Ico de={Plus} />} onClick={() => setFormulario({ campo: null })}>
              {t.agregar}
            </Button>
          )
        }
        locale={{ emptyText: <VacioConMotivo titulo={t.sinCampos} motivo={t.vacioMotivo} /> }}
      />
      {formulario && (
        <FormularioCampo
          area={area}
          campo={formulario.campo}
          subareas={subareas}
          siNo={delArea.filter((c) => c.tipo === 'si-no' && c.id !== formulario.campo?.id)}
          deEstados={delArea.filter((c) => c.fuente === 'state' && esLista(c.tipo) && c.id !== formulario.campo?.id)}
          ejecutar={ejecutar}
          onCerrar={() => setFormulario(null)}
        />
      )}
    </Drawer>
  );
}

interface ValoresCampo {
  etiqueta: string;
  tipo: TipoCampo;
  fuente: FuenteOpciones;
  opciones: string[];
  obligatorio: boolean;
  soloRoles: string[];
  soloSubareas: string[];
  dependeDe?: string;
  dependeValor: string;
  filtrarPor?: string;
}

function FormularioCampo({
  area,
  campo,
  subareas,
  siNo,
  deEstados,
  ejecutar,
  onCerrar,
}: {
  area: string;
  campo: CampoArea | null;
  subareas: OpcionBaseline[];
  /** Las listas de estados del área: pueden filtrar una lista de territorios (H-041). */
  deEstados: CampoArea[];
  /** Los campos Sí/No del área de los que puede depender (H-040). */
  siNo: CampoArea[];
  ejecutar: EjecutarCamposArea;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const t = m.rolesPermisos.camposArea;
  const [form] = Form.useForm<ValoresCampo>();
  const tipo = Form.useWatch('tipo', form);
  const fuente = Form.useWatch('fuente', form);
  const dependeDe = Form.useWatch('dependeDe', form);
  const [guardando, setGuardando] = useState(false);

  async function guardar(v: ValoresCampo) {
    setGuardando(true);
    const comun = {
      etiqueta: v.etiqueta,
      opciones: (v.opciones ?? []).join('|'),
      obligatorio: v.obligatorio ? 'si' : 'no',
      soloRoles: (v.soloRoles ?? []).join(','),
      soloSubareas: (v.soloSubareas ?? []).join('|'),
      dependeDe: v.dependeDe ?? '',
      dependeValor: v.dependeValor ?? 'si',
      filtrarPor: v.filtrarPor ?? '',
    };
    const ok = campo ? await ejecutar('editar-campo', { campoId: campo.id, ...comun }) : await ejecutar('agregar-campo', { area, tipo: v.tipo, fuente: v.fuente, ...comun });
    setGuardando(false);
    if (ok) onCerrar();
  }

  return (
    <Modal
      open
      title={campo ? t.editar : t.agregar}
      okText={guardando ? m.rolesPermisos.guardando : t.guardar}
      cancelText={m.comun.cancelar}
      onOk={() => form.submit()}
      onCancel={onCerrar}
      destroyOnHidden
    >
      <Form<ValoresCampo>
        form={form}
        layout="vertical"
        requiredMark
        initialValues={
          campo
            ? { etiqueta: campo.etiqueta, tipo: campo.tipo, fuente: campo.fuente, opciones: campo.opciones, obligatorio: campo.obligatorio, soloRoles: campo.soloRoles, soloSubareas: campo.soloSubareas, dependeDe: campo.dependeDe ?? undefined, dependeValor: campo.dependeValor ?? 'si', filtrarPor: campo.filtradoPor ?? undefined }
            : { tipo: 'texto', fuente: 'propias', opciones: [], obligatorio: false, soloRoles: [], soloSubareas: [], dependeValor: 'si' }
        }
        onFinish={guardar}
      >
        <Form.Item name="etiqueta" label={t.etiqueta} rules={[{ required: true, whitespace: true, message: t.etiqueta }]}>
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item name="tipo" label={t.tipo} required extra={campo ? t.tipoFijo : undefined}>
          <Select disabled={!!campo} options={TIPOS_CAMPO.map((x) => ({ value: x, label: t.tipos[x] }))} />
        </Form.Item>
        {tipo && esLista(tipo) && (
          <Form.Item name="fuente" label={t.fuente} required extra={fuente && fuente !== 'propias' ? t.fuenteFija : undefined}>
            <Select disabled={!!campo} options={FUENTES_OPCIONES.map((x) => ({ value: x, label: t.fuentes[x] }))} />
          </Form.Item>
        )}
        {tipo && esLista(tipo) && fuente === 'propias' && (
          <Form.Item name="opciones" label={t.opciones} required extra={t.opcionesAyuda}>
            <Select mode="tags" open={false} suffixIcon={null} tokenSeparators={['|']} />
          </Form.Item>
        )}
        {fuente === 'territorio' && deEstados.length > 0 && (
          <Form.Item name="filtrarPor" label={t.filtrarPor} extra={t.filtrarPorAyuda}>
            <Select allowClear placeholder={t.sinFiltro} options={deEstados.map((c) => ({ value: c.id, label: c.etiqueta }))} />
          </Form.Item>
        )}
        <Form.Item name="obligatorio" valuePropName="checked">
          <Checkbox>{t.obligatorio}</Checkbox>
        </Form.Item>
        <Form.Item name="soloRoles" label={t.soloPara} extra={t.soloParaAyuda}>
          <Select mode="multiple" allowClear placeholder={t.aTodos} options={rolesProducto(idioma).map((r) => ({ value: r.id, label: r.nombre }))} />
        </Form.Item>
        {subareas.length > 0 && (
          <Form.Item name="soloSubareas" label={t.enSubareas}>
            <Select mode="multiple" allowClear placeholder={t.cualquierSubarea} options={subareas.map((s) => ({ value: s.codigo, label: s.nombre }))} />
          </Form.Item>
        )}
        {siNo.length > 0 && (
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="dependeDe" label={t.soloSi} style={{ flex: 1 }} extra={t.soloSiAyuda}>
              <Select allowClear placeholder={t.siempre} options={siNo.map((c) => ({ value: c.id, label: c.etiqueta }))} />
            </Form.Item>
            {dependeDe && (
              <Form.Item name="dependeValor" label=" " colon={false}>
                <Select style={{ minWidth: token.controlHeightLG * 2.5 }} options={[{ value: 'si', label: t.si }, { value: 'no', label: t.no }]} />
              </Form.Item>
            )}
          </Space.Compact>
        )}
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------- en el detalle del usuario */

/** Los datos del área de la persona, solo para mirar. Se editan desde «Editar» del detalle (un solo punto de edición). */
export function DatosAreaPerfil({
  empleadoId,
  area,
  areaNombre,
  campos,
  valores,
  catalogos,
  roles,
}: {
  empleadoId: string;
  area: string;
  areaNombre: string;
  campos: CampoArea[];
  valores: ValorCampoArea[];
  catalogos: CatalogosCampos;
  /** Sus roles en sus áreas: solo se muestran los campos que se le piden (H-040). */
  roles: RolEnArea[];
}) {
  const { token } = theme.useToken();
  const t = useIdioma().m.rolesPermisos.camposArea;
  const delArea = camposDePersona(campos, [area], roles, (id) => valorDe(valores, empleadoId, id));
  if (!delArea.length) return null;
  const desdeDe = (campoId: string) => valores.find((v) => v.empleadoId === empleadoId && v.campoId === campoId)?.desde;

  return (
    <div>
      <div style={{ margin: `${token.marginLG}px 0 ${token.marginXS}px`, display: 'flex', alignItems: 'center', gap: token.marginXS, flexWrap: 'wrap' }}>
        <Text strong>{t.datosTitulo(areaNombre)}</Text>
        <EstadoDatosArea campos={campos} valores={valores} empleadoId={empleadoId} areas={[area]} roles={roles} />
      </div>
      <Descriptions
        column={1}
        size="small"
        items={delArea.map((c) => {
          const desde = desdeDe(c.id);
          return {
            key: c.id,
            label: c.obligatorio ? `${c.etiqueta} *` : c.etiqueta,
            children: (
              <span>
                {valorVisible(c, valorDe(valores, empleadoId, c.id), t, catalogos)}
                {desde && <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginInlineStart: token.marginXS }}>{t.desde(desde)}</Text>}
              </span>
            ),
          };
        })}
      />
    </div>
  );
}

/** Lo que el editor guarda por campo: texto, o la lista de códigos de una multi-lista. */
export type BorradorDatosArea = Record<string, string | string[]>;

export const borradorDatosArea = (campos: CampoArea[], valores: ValorCampoArea[], empleadoId: string): BorradorDatosArea =>
  Object.fromEntries(campos.map((c) => [c.id, c.tipo === 'multi-lista' ? codigosDe(valorDe(valores, empleadoId, c.id)) : (valorDe(valores, empleadoId, c.id) ?? '')]));

/** Los campos de un área, editables. Vive dentro del formulario de edición del detalle. */
export function EditorDatosArea({
  campos,
  datos,
  onCambio,
  catalogos,
}: {
  campos: CampoArea[];
  datos: BorradorDatosArea;
  onCambio: (d: BorradorDatosArea) => void;
  catalogos: CatalogosCampos;
}) {
  const t = useIdioma().m.rolesPermisos.camposArea;
  const leer = (id: string) => datos[id];
  const poner = (id: string, v: string | string[] | null | undefined) => {
    const nuevo: BorradorDatosArea = { ...datos, [id]: v ?? '' };
    // Si cambian los estados, los territorios que ya no son de esos estados salen de lo elegido (H-041).
    for (const f of campos.filter((x) => x.filtradoPor === id)) {
      const validos = opcionesDe(f, catalogos, (k) => nuevo[k]).map((o) => o.codigo);
      const actual = nuevo[f.id];
      nuevo[f.id] = Array.isArray(actual) ? actual.filter((x) => validos.includes(x)) : actual && validos.includes(actual) ? actual : '';
    }
    onCambio(nuevo);
  };

  const control = (c: CampoArea) => {
    const actual = datos[c.id] ?? '';
    const v = Array.isArray(actual) ? '' : actual;
    const opciones = esLista(c.tipo) ? opcionesDe(c, catalogos, leer).map((o) => ({ value: o.codigo, label: o.nombre })) : [];
    const sinOpciones = c.filtradoPor && !opciones.length ? t.primeroEstados : undefined;
    switch (c.tipo) {
      case 'numero':
        return <InputNumber style={{ width: '100%' }} value={v === '' ? null : Number(v)} onChange={(n) => poner(c.id, n === null ? '' : String(n))} />;
      case 'fecha':
        return <FechaISO style={{ width: '100%' }} value={v} onChange={(iso) => poner(c.id, iso)} />;
      case 'si-no':
        return <Select allowClear value={v || undefined} onChange={(x) => poner(c.id, x)} options={[{ value: 'si', label: t.si }, { value: 'no', label: t.no }]} />;
      case 'lista':
        return <Select allowClear showSearch={{ optionFilterProp: 'label' }} value={v || undefined} onChange={(x) => poner(c.id, x)} options={opciones} />;
      case 'multi-lista':
        return <Select mode="multiple" allowClear showSearch={{ optionFilterProp: 'label' }} placeholder={sinOpciones} notFoundContent={sinOpciones} value={Array.isArray(actual) ? actual : []} onChange={(x) => poner(c.id, x)} options={opciones} />;
      default:
        return <Input maxLength={500} value={v} onChange={(e) => poner(c.id, e.target.value)} />;
    }
  };

  return (
    <>
      {campos.map((c) => (
        <Form.Item key={c.id} label={c.etiqueta} required={c.obligatorio}>
          {control(c)}
        </Form.Item>
      ))}
    </>
  );
}

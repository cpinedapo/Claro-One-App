'use client';
/**
 * Crear una agencia o editar su información. Un solo formulario para los dos casos, en un `Drawer`
 * (FRM-R30: de 6 a ~15 campos), según la ficha Form del Manual de uso del kit:
 * - `layout="vertical"`, asterisco + leyenda, validación al salir del campo y salto al primer error
 *   (6.1); una columna con dos secciones con título (FRM-R02, R05); sin Tabs (FRM-R07).
 * - Controles según 6.5: Radio vertical para 2–5 opciones, Checkbox group para la compañía, Select con
 *   búsqueda para listas largas, DatePicker con escritura `MM/DD/YYYY`.
 * - Errores bajo el campo, accionables (FRM-R20); el error del servidor (el contrato) en un `Alert`
 *   arriba (FRM-R25); el botón primario nunca se deshabilita, solo `loading` (FRM-R23).
 * - Botones al final, a la derecha, un solo primario que nombra la acción (FRM-R26, R27). Cancelar con
 *   cambios sin guardar pide confirmación (FRM-R29).
 *
 * Toda escritura pasa por el contrato `gestion-de-agencias` (`ejecutarAgencias`).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Alert, App, Button, Checkbox, DatePicker, Drawer, Form, Input, Radio, Select, Typography, theme } from 'antd';
import { COMPANIAS } from '@arc2-0/claro-one-kit/dominio';
import { Cap } from '@arc2-0/claro-one-kit';
import type { AgenciaDirectorio, DirectorioCompleto } from '@/dominio/directorio';
import { masterDe, nivelesDe, pagoDeAgencia } from '@/dominio/pagos';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarAgencias } from '../acciones';
import { COMUNICACIONES, ESTADOS, REPORTES } from '../contrato';

const { Text } = Typography;
const SIN = '__sin__';

interface Valores {
  nombre: string;
  parentId?: string;
  companias: string[];
  estado: string;
  npn?: string;
  taxId?: string;
  telefono?: string;
  inicio?: Dayjs | null;
  cobraAgenteId?: string;
  calle?: string;
  ciudad?: string;
  estadoUS?: string;
  zip?: string;
  portal: string;
  comunicaciones: string;
  reportes: string;
  web?: string;
  linkedin?: string;
  redes: string[];
  tipoComision?: string;
  comisionPagadaA: string;
  bonoPagadoA: string;
  codigoPagoClaro?: string;
  codigoPagoAtoz?: string;
  legacy: string;
}

const iniciales = (a?: AgenciaDirectorio): Valores =>
  a
    ? {
        nombre: a.nombre,
        companias: a.companias,
        estado: a.estado,
        npn: a.npn ?? undefined,
        taxId: a.taxId ?? undefined,
        telefono: a.telefono ?? undefined,
        inicio: a.inicio ? dayjs(a.inicio) : null,
        cobraAgenteId: a.cobraAgenteId ?? undefined,
        calle: a.calle ?? undefined,
        ciudad: a.ciudad ?? undefined,
        estadoUS: a.estadoUS ?? undefined,
        zip: a.zip ?? undefined,
        portal: a.agentesUsanPortal === null ? SIN : String(a.agentesUsanPortal),
        comunicaciones: a.alcanceComunicaciones ?? SIN,
        reportes: a.alcanceReportes ?? SIN,
        web: a.web ?? undefined,
        linkedin: a.linkedin ?? undefined,
        redes: a.redes,
        tipoComision: a.tipoComision ?? undefined,
        comisionPagadaA: a.comisionPagadaA ?? SIN,
        bonoPagadoA: a.bonoPagadoA ?? SIN,
        codigoPagoClaro: a.codigoPago.claro ?? undefined,
        codigoPagoAtoz: a.codigoPago.atoz ?? undefined,
        legacy: String(a.legacy),
      }
    : // Valores por defecto seguros (FRM-R16): una agencia nueva arranca con su contratación pendiente.
      { nombre: '', companias: [], estado: 'pending_contracting', portal: SIN, comunicaciones: SIN, reportes: SIN, redes: [], comisionPagadaA: SIN, bonoPagadoA: SIN, legacy: 'false' };

const marca = (cid: string) => (cid === 'atoz' ? 'AtoZ' : 'Claro');

export function FormularioAgencia({
  modo,
  agencia,
  madreId,
  directorio,
  abierto,
  onCerrar,
}: {
  modo: 'crear' | 'editar';
  agencia?: AgenciaDirectorio;
  /** Crear una sub-agencia: la agencia madre ya viene dada y no se elige. */
  madreId?: string;
  directorio: DirectorioCompleto;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const f = m.directorio.form;
  const d = m.directorio;
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<Valores>();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  /* FRM-R19: se valida al salir del campo; un campo que ya mostró un error revalida mientras se
     escribe, para que el error desaparezca apenas el valor es válido. */
  const [conError, setConError] = useState<Set<string>>(new Set());
  const companiasForm = Form.useWatch('companias', form) as string[] | undefined;
  const parentIdForm = Form.useWatch('parentId', form) as string | undefined;
  const comisionForm = Form.useWatch('comisionPagadaA', form) as string | undefined;
  const bonoForm = Form.useWatch('bonoPagadoA', form) as string | undefined;
  const companiasVigentes = modo === 'editar' && agencia ? agencia.companias : (companiasForm ?? []);
  const disparo = (campo: string) => (conError.has(campo) ? ['onBlur', 'onChange'] : 'onBlur');
  // Un estado que la agencia ya tenía y luego se desactivó en Baselines se sigue mostrando.
  const estadoActual = agencia?.estadoUS ?? null;
  const opcionesEstado = [
    ...directorio.baselines.estados,
    ...(estadoActual && !directorio.baselines.estados.some((e) => e.codigo === estadoActual) ? [{ codigo: estadoActual, nombre: estadoActual }] : []),
  ].map((e) => ({ value: e.codigo, label: `${e.codigo} · ${e.nombre}` }));

  function cerrar() {
    form.resetFields();
    setErrorServidor(null);
    onCerrar();
  }

  /** Con cambios sin guardar, cerrar pide confirmación (FRM-R29, R47). */
  function pedirCerrar() {
    if (!form.isFieldsTouched()) return cerrar();
    modal.confirm({ title: f.descartarTitulo, content: f.descartarTexto, okText: f.descartar, okButtonProps: { danger: true }, cancelText: f.seguir, onOk: cerrar });
  }

  async function enviar(v: Valores) {
    setEnviando(true);
    setErrorServidor(null);
    const valor = (x: string) => (x === SIN ? '' : x);
    const entrada = {
      ...(modo === 'editar' && agencia ? { agenciaId: agencia.id } : { parentId: madreId ?? v.parentId ?? '' }),
      nombre: v.nombre,
      // Al editar, las compañías se manejan en su propia sección de la ficha (H-017): no viajan aquí.
      ...(modo === 'crear' ? { companias: v.companias.join(',') } : {}),
      calle: v.calle ?? '',
      ciudad: v.ciudad ?? '',
      estadoUS: (v.estadoUS ?? '').toUpperCase(),
      zip: v.zip ?? '',
      estado: v.estado,
      npn: v.npn ?? '',
      taxId: v.taxId ?? '',
      telefono: v.telefono ?? '',
      inicio: v.inicio ? v.inicio.format('YYYY-MM-DD') : '',
      // Si en esta jerarquía la agencia no cobra, no lleva contact payee ni payment code (H-023).
      cobraAgenteId: pago.lleva ? (v.cobraAgenteId ?? '') : '',
      portal: valor(v.portal),
      comunicaciones: valor(v.comunicaciones),
      reportes: valor(v.reportes),
      web: v.web ?? '',
      linkedin: v.linkedin ?? '',
      redes: (v.redes ?? []).join(','),
      tipoComision: v.tipoComision ?? '',
      comisionPagadaA: valor(v.comisionPagadaA),
      bonoPagadoA: valor(v.bonoPagadoA),
      // Solo viaja el payment code de las compañías a las que pertenece (Payment Account · E-051).
      codigoPagoClaro: pago.lleva && companiasVigentes.includes('claro') ? (v.codigoPagoClaro ?? '') : '',
      codigoPagoAtoz: pago.lleva && companiasVigentes.includes('atoz') ? (v.codigoPagoAtoz ?? '') : '',
      legacy: v.legacy,
    };
    const r = await ejecutarAgencias(modo === 'crear' ? 'crear-agencia' : 'editar-agencia', entrada);
    setEnviando(false);
    if (!r.ok) {
      setErrorServidor(r.motivo);
      return;
    }
    message.success(modo === 'crear' ? f.creada(v.nombre) : f.guardada(v.nombre));
    cerrar();
    router.refresh();
  }

  const ancho = (n: number) => ({ maxWidth: token.controlHeightLG * n });
  const agentes = [...directorio.agentes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const agencias = [...directorio.agencias].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const madre = madreId ? directorio.agencias.find((a) => a.id === madreId) : undefined;
  // Una sub-agencia arranca con las compañías de su madre.
  const valoresIniciales = madre ? { ...iniciales(), companias: madre.companias } : iniciales(agencia);
  const enlace = { pattern: /^https?:\/\/\S+\.\S+$/i, message: f.errEnlace };
  const tiposComision = [
    ...directorio.baselines.tiposComision,
    // Uno que la agencia ya tenía y luego se desactivó en Datos base se sigue mostrando.
    ...(agencia?.tipoComision && !directorio.baselines.tiposComision.some((x) => x.codigo === agencia.tipoComision) ? [{ codigo: agencia.tipoComision, nombre: agencia.tipoComision }] : []),
  ];
  const pagadoA = [
    { value: 'agencia', label: f.aAgencia },
    { value: 'subagencia', label: f.aSubagencia },
    { value: 'agente', label: f.aAgente },
    { value: SIN, label: f.sinDefinir },
  ];
  // A quién se paga lo define la Master Agency; su jerarquía lo hereda (H-023).
  const padreId = modo === 'editar' ? (agencia?.parentId ?? null) : (madreId ?? parentIdForm ?? null);
  const esMaster = padreId === null;
  const master = esMaster ? undefined : masterDe(directorio.agencias, padreId!);
  const sinValor = (x: string | undefined) => (!x || x === SIN ? null : x);
  const niveles = esMaster ? nivelesDe({ comisionPagadaA: sinValor(comisionForm), bonoPagadoA: sinValor(bonoForm) }) : nivelesDe(master);
  const pago = pagoDeAgencia(esMaster, niveles);
  const etiquetaNivel = (x: string | null) => pagadoA.find((o) => o.value === x)?.label ?? f.sinDefinir;

  return (
    <Drawer
      open={abierto}
      title={modo === 'editar' ? f.tituloEditar(agencia?.nombre ?? '') : madre ? m.directorio.alta.tituloSubagencia(madre.nombre) : f.tituloCrear}
      size={token.controlHeightLG * 14}
      onClose={pedirCerrar}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', gap: token.marginXS, justifyContent: 'flex-end' }}>
          <Button onClick={pedirCerrar}>{m.comun.cancelar}</Button>
          <Button type="primary" loading={enviando} onClick={() => form.submit()}>
            {modo === 'crear' ? f.crear : f.guardar}
          </Button>
        </div>
      }
    >
      <Form<Valores>
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        validateTrigger="onBlur"
        scrollToFirstError={{ focus: true }}
        initialValues={valoresIniciales}
        onFinish={enviar}
        onFieldsChange={(_, todos) => setConError(new Set(todos.filter((c) => c.errors && c.errors.length > 0).map((c) => String(c.name))))}
        disabled={enviando}
      >
        {errorServidor && <Alert type="error" showIcon title={f.errServidor} description={errorServidor} style={{ marginBottom: token.margin }} />}
        <Cap style={{ display: 'block', marginBottom: token.margin }}>{f.leyenda}</Cap>

        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend style={{ fontWeight: token.fontWeightStrong, fontSize: token.fontSizeLG, marginBottom: token.margin }}>{f.identificacion}</legend>

          <Form.Item name="nombre" validateTrigger={disparo('nombre')} label={f.nombre} rules={[{ required: true, whitespace: true, message: f.errNombre }]}>
            <Input autoComplete="off" />
          </Form.Item>

          {modo === 'crear' && madre ? (
            <Form.Item label={f.madre} extra={m.directorio.alta.madreFija}>
              <Text>{madre.nombre}</Text>
            </Form.Item>
          ) : modo === 'crear' ? (
            <Form.Item name="parentId" label={f.madre} extra={f.madreAyuda}>
              <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={agencias.map((a) => ({ value: a.id, label: a.nombre }))} />
            </Form.Item>
          ) : (
            /* Al editar, la madre solo se muestra (no se cambia aquí). Una agencia de primer nivel no tiene: ni aparece. */
            agencia?.parentId && (
              <Form.Item label={f.madre}>
                <Text>{directorio.agencias.find((a) => a.id === agencia.parentId)?.nombre ?? '—'}</Text>
              </Form.Item>
            )
          )}

          {modo === 'crear' && (
          <Form.Item name="companias" validateTrigger={disparo('companias')} label={f.companias} rules={[{ required: true, type: 'array', min: 1, message: f.errCompanias }]}>
            <Checkbox.Group options={COMPANIAS.map((c) => ({ value: c.id, label: `${marca(c.id)} · ${c.nombre}` }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>
          )}

          <Form.Item name="estado" label={f.estado} rules={[{ required: true }]}>
            <Radio.Group options={ESTADOS.map((e) => ({ value: e, label: d.estadoAgencia[e] }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
          </Form.Item>

          <Form.Item name="npn" label={f.npn}>
            <Input style={ancho(5)} autoComplete="off" />
          </Form.Item>
          <Form.Item name="taxId" validateTrigger={disparo('taxId')} label={f.ein} extra={f.einAyuda} rules={[{ pattern: /^\d{9}$/, message: f.errEin }]}>
            <Input style={ancho(5)} inputMode="numeric" maxLength={9} placeholder="123456789" autoComplete="off" />
          </Form.Item>
          <Form.Item name="telefono" validateTrigger={disparo('telefono')} label={f.telefono} extra={f.telefonoAyuda} rules={[{ pattern: /^\d{10}$/, message: f.errTelefono }]}>
            <Input style={ancho(5)} inputMode="tel" maxLength={10} placeholder="3055550100" autoComplete="off" />
          </Form.Item>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: `${token.marginLG}px 0 0`, minWidth: 0 }}>
          <legend style={{ fontWeight: token.fontWeightStrong, fontSize: token.fontSizeLG, marginBottom: token.margin }}>{m.directorio.relaciones.direccion}</legend>
          <Form.Item name="calle" label={m.directorio.relaciones.calle}>
            <Input autoComplete="street-address" />
          </Form.Item>
          <Form.Item name="ciudad" label={m.directorio.relaciones.ciudad}>
            <Input style={ancho(8)} autoComplete="address-level2" />
          </Form.Item>
          {/* Estado y ZIP en la misma fila: cortos y relacionados (FRM-R02). */}
          <div style={{ display: 'flex', gap: token.margin }}>
            {/* Los estados salen de Configuración › Baselines (H-018). */}
            <Form.Item name="estadoUS" label={m.directorio.relaciones.estadoUS}>
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                style={{ width: token.controlHeightLG * 6 }}
                options={opcionesEstado}
              />
            </Form.Item>
            <Form.Item name="zip" label={m.directorio.relaciones.zip} validateTrigger={disparo('zip')} rules={[{ pattern: /^\d{5}$/, message: m.directorio.relaciones.errZip }]}>
              <Input style={{ width: token.controlHeightLG * 3 }} inputMode="numeric" maxLength={5} placeholder="33101" autoComplete="postal-code" />
            </Form.Item>
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: `${token.marginLG}px 0 0`, minWidth: 0 }}>
          <legend style={{ fontWeight: token.fontWeightStrong, fontSize: token.fontSizeLG, marginBottom: token.margin }}>{f.operacion}</legend>

          <Form.Item name="inicio" label={f.inicio}>
            <DatePicker format="MM/DD/YYYY" placeholder="MM/DD/YYYY" style={ancho(5)} />
          </Form.Item>

          <Form.Item name="portal" label={f.portal}>
            <Radio.Group
              options={[
                { value: 'true', label: m.comun.si },
                { value: 'false', label: m.comun.no },
                { value: SIN, label: f.sinDefinir },
              ]}
            />
          </Form.Item>

          <Form.Item name="comunicaciones" label={f.comunicaciones}>
            <Radio.Group
              options={[...COMUNICACIONES.map((c) => ({ value: c, label: d.comunicaciones[c] })), { value: SIN, label: f.sinDefinir }]}
              style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}
            />
          </Form.Item>

          <Form.Item name="reportes" label={f.reportes}>
            <Radio.Group
              options={[...REPORTES.map((r) => ({ value: r, label: d.reportes[r] })), { value: SIN, label: f.sinDefinir }]}
              style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}
            />
          </Form.Item>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: `${token.marginLG}px 0 0`, minWidth: 0 }}>
          <legend style={{ fontWeight: token.fontWeightStrong, fontSize: token.fontSizeLG, marginBottom: token.margin }}>{f.enLinea}</legend>
          <Form.Item name="web" label={f.web} validateTrigger={disparo('web')} rules={[enlace]}>
            <Input inputMode="url" placeholder="https://" autoComplete="url" />
          </Form.Item>
          <Form.Item name="linkedin" label={f.linkedin} validateTrigger={disparo('linkedin')} rules={[enlace]}>
            <Input inputMode="url" placeholder="https://www.linkedin.com/company/…" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="redes"
            label={f.redes}
            extra={f.redesAyuda}
            validateTrigger={disparo('redes')}
            rules={[{ validator: (_, v: string[] = []) => (v.every((x) => enlace.pattern.test(x)) ? Promise.resolve() : Promise.reject(new Error(f.errEnlace))) }]}
          >
            <Select mode="tags" open={false} suffixIcon={null} tokenSeparators={[',', ' ']} placeholder="https://www.instagram.com/…" />
          </Form.Item>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: `${token.marginLG}px 0 0`, minWidth: 0 }}>
          <legend style={{ fontWeight: token.fontWeightStrong, fontSize: token.fontSizeLG, marginBottom: token.margin }}>{f.pagos}</legend>
          {esMaster ? (
            <>
              <Form.Item name="comisionPagadaA" label={f.comisionPagadaA}>
                <Radio.Group options={pagadoA} />
              </Form.Item>
              <Form.Item name="bonoPagadoA" label={f.bonoPagadoA}>
                <Radio.Group options={pagadoA} />
              </Form.Item>
            </>
          ) : (
            <Form.Item label={`${f.comisionPagadaA} · ${f.bonoPagadoA}`} extra={f.heredaDe(master?.nombre ?? '')}>
              <Text>{`${etiquetaNivel(master?.comisionPagadaA ?? null)} · ${etiquetaNivel(master?.bonoPagadoA ?? null)}`}</Text>
            </Form.Item>
          )}
          {/* Contact payee y payment code: solo si en esta jerarquía la agencia cobra; obligatorios según el nivel (FRM-R44). */}
          {pago.lleva && (
            <>
              <Form.Item name="cobraAgenteId" label={f.cobra} rules={[{ required: pago.obligatorio, message: f.errPayee }]}>
                <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={agentes.map((a) => ({ value: a.id, label: `${a.nombre} · ${d.npn(a.npn)}` }))} />
              </Form.Item>
              {companiasVigentes.includes('claro') && (
                <Form.Item
                  name="codigoPagoClaro"
                  label={f.codigoPago('Claro')}
                  validateTrigger={disparo('codigoPagoClaro')}
                  rules={[{ required: pago.obligatorio, whitespace: true, message: f.errCodigoObligatorio }, { pattern: /^[A-Za-z0-9-]{1,30}$/, message: f.errCodigo }]}
                >
                  <Input style={ancho(5)} autoComplete="off" />
                </Form.Item>
              )}
              {companiasVigentes.includes('atoz') && (
                <Form.Item
                  name="codigoPagoAtoz"
                  label={f.codigoPago('AtoZ')}
                  validateTrigger={disparo('codigoPagoAtoz')}
                  rules={[{ required: pago.obligatorio, whitespace: true, message: f.errCodigoObligatorio }, { pattern: /^[A-Za-z0-9-]{1,30}$/, message: f.errCodigo }]}
                >
                  <Input style={ancho(5)} autoComplete="off" />
                </Form.Item>
              )}
            </>
          )}
          <Form.Item name="tipoComision" label={f.tipoComision} {...(tiposComision.length ? {} : { extra: f.tipoComisionVacio })}>
            <Select allowClear disabled={!tiposComision.length} options={tiposComision.map((x) => ({ value: x.codigo, label: x.nombre }))} />
          </Form.Item>
          <Form.Item name="legacy" label={f.legacy} extra={f.legacyAyuda}>
            <Radio.Group
              options={[
                { value: 'true', label: m.comun.si },
                { value: 'false', label: m.comun.no },
              ]}
            />
          </Form.Item>
        </fieldset>
      </Form>
    </Drawer>
  );
}

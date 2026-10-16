'use client';
/**
 * Agregar a alguien a una agencia: un agente (nuevo o que ya existe), alguien del equipo
 * (representante o staff) o un vendedor de productos de descuento. Con `edicion`, el mismo formulario
 * edita a alguien que ya existe (H-020): sin elegir modo ni papel, con sus datos cargados. Un formulario por tipo, en un
 * `Drawer` encima del detalle de la agencia (FRM-R30, GLB-R06: dos niveles como máximo).
 *
 * Mismas reglas que `FormularioAgencia` (ficha Form del Manual de uso): vertical, asterisco +
 * leyenda, validación al salir del campo y revalidación al escribir tras el primer error, campos
 * condicionales que aparecen solo cuando aplican (FRM-R44), errores del contrato en un `Alert`.
 * Toda escritura pasa por el contrato `gestion-de-agencias`.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Checkbox, Drawer, Form, Input, Radio, Select, theme } from 'antd';
import { COMPANIAS } from '@arc2-0/claro-one-kit/dominio';
import { Cap } from '@arc2-0/claro-one-kit';
import type { AgenciaDirectorio, DirectorioCompleto } from '@/dominio/directorio';
import { estaEnAgencia, vigentes } from '@/dominio/directorio';
import { exigeCodigoPersona } from '@/dominio/pagos';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarAgencias } from '../acciones';
import type { TipoMiembro } from '../contrato';

export type TipoAlta = 'agente' | 'equipo' | 'vendedor';

interface Valores {
  modo?: 'nuevo' | 'existente';
  agenteId?: string;
  papel?: 'representante' | 'staff';
  nombre?: string;
  npn?: string;
  email?: string;
  telefono?: string;
  puesto?: string;
  lobs?: string[];
  ffm?: string;
  companias?: string[];
  codigoPagoClaro?: string;
  codigoPagoAtoz?: string;
}

const marca = (cid: string) => (cid === 'atoz' ? 'AtoZ' : 'Claro');

export function FormularioPersona({
  tipo,
  agencia,
  directorio,
  onCerrar,
  edicion,
}: {
  tipo: TipoAlta;
  agencia: AgenciaDirectorio;
  directorio: DirectorioCompleto;
  onCerrar: () => void;
  /** Editar a esta persona en vez de agregar a alguien. */
  edicion?: { tipo: TipoMiembro; id: string };
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.alta;
  const f = m.directorio.form;
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<Valores>();
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [conError, setConError] = useState<Set<string>>(new Set());
  const disparo = (campo: string) => (conError.has(campo) ? ['onBlur', 'onChange'] : 'onBlur');

  const modo = Form.useWatch('modo', form);
  const papel = Form.useWatch('papel', form);
  const agenteElegido = Form.useWatch('agenteId', form);

  const agentes = [...directorio.agentes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const opcionesAgente = (soloFuera: boolean) =>
    agentes.filter((a) => !soloFuera || !estaEnAgencia(a, agencia.id)).map((a) => ({ value: a.id, label: `${a.nombre} · ${m.directorio.npn(a.npn)}` }));

  const editando = edicion ? valoresDe(directorio, edicion) : null;
  const titulo = editando
    ? t.tituloEditar(editando.nombre ?? '')
    : tipo === 'agente' ? t.tituloAgente(agencia.nombre) : tipo === 'equipo' ? t.tituloEquipo(agencia.nombre) : t.tituloVendedor(agencia.nombre);
  const accion = edicion ? 'editar-persona' : tipo === 'agente' ? 'agregar-agente' : tipo === 'equipo' ? 'agregar-equipo' : 'agregar-vendedor';
  const iniciales: Valores = editando ?? (tipo === 'agente' ? { modo: 'nuevo', ffm: 'false', companias: agencia.companias } : tipo === 'equipo' ? { papel: 'representante' } : { companias: agencia.companias });

  function cerrar() {
    form.resetFields();
    onCerrar();
  }
  function pedirCerrar() {
    if (!form.isFieldsTouched()) return cerrar();
    modal.confirm({ title: f.descartarTitulo, content: f.descartarTexto, okText: f.descartar, okButtonProps: { danger: true }, cancelText: f.seguir, onOk: cerrar });
  }

  async function enviar(v: Valores) {
    setEnviando(true);
    setErrorServidor(null);
    const r = await ejecutarAgencias(accion, {
      ...(edicion ? { tipo: edicion.tipo, personaId: edicion.id } : {}),
      agenciaId: agencia.id,
      modo: v.modo ?? '',
      papel: v.papel ?? '',
      agenteId: v.agenteId ?? '',
      nombre: v.nombre ?? '',
      npn: v.npn ?? '',
      email: v.email ?? '',
      telefono: v.telefono ?? '',
      puesto: v.puesto ?? '',
      lobs: (v.lobs ?? []).join(','),
      ffm: v.ffm ?? '',
      companias: (v.companias ?? []).join(','),
      // Solo los payment codes de las compañías en que produce (H-023).
      codigoPagoClaro: (v.companias ?? []).includes('claro') ? (v.codigoPagoClaro ?? '') : '',
      codigoPagoAtoz: (v.companias ?? []).includes('atoz') ? (v.codigoPagoAtoz ?? '') : '',
    });
    setEnviando(false);
    if (!r.ok) {
      setErrorServidor(r.motivo);
      return;
    }
    const nombre = v.nombre || directorio.agentes.find((a) => a.id === v.agenteId)?.nombre || '';
    message.success(edicion ? m.directorio.form.guardada(nombre) : t.listo(nombre));
    cerrar();
    router.refresh();
  }

  const corto = { maxWidth: token.controlHeightLG * 5 };
  const contacto = (
    <>
      <Form.Item name="email" label={t.correo} validateTrigger={disparo('email')} rules={[{ type: 'email', message: t.errCorreo }]}>
        <Input inputMode="email" placeholder="nombre@agencia.com" autoComplete="off" />
      </Form.Item>
      <Form.Item name="telefono" label={t.telefono} extra={t.telefonoAyuda} validateTrigger={disparo('telefono')} rules={[{ pattern: /^\d{10}$/, message: t.errTelefono }]}>
        <Input style={corto} inputMode="tel" maxLength={10} placeholder="3055550100" autoComplete="off" />
      </Form.Item>
    </>
  );
  const companias = (
    <Form.Item name="companias" label={t.companias} validateTrigger={disparo('companias')} rules={[{ required: true, type: 'array', min: 1, message: t.errCompanias }]}>
      <Checkbox.Group options={COMPANIAS.map((c) => ({ value: c.id, label: `${marca(c.id)} · ${c.nombre}` }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
    </Form.Item>
  );
  /** Payment codes de un agente o vendedor sin licencia: uno por compañía en que produce; obligatorios si su
   *  agencia le paga al agente (H-023). */
  const companiasElegidas = (Form.useWatch('companias', form) as string[] | undefined) ?? [];
  const agenciasDeLaPersona = edicion
    ? vigentes(
        (edicion.tipo === 'agente' ? directorio.agentes : edicion.tipo === 'vendedor' ? directorio.vendedores : []).find((p) => p.id === edicion.id)?.agencias ?? [],
      ).map((x) => x.agenciaId)
    : [agencia.id];
  // Un agente independiente cobra él mismo: su código es obligatorio (H-024).
  const exigeCodigo = exigeCodigoPersona(agenciasDeLaPersona, directorio.agencias, { esAgente: tipo === 'agente' });
  const codigos = companiasElegidas.map((c) => (
    <Form.Item
      key={c}
      name={c === 'atoz' ? 'codigoPagoAtoz' : 'codigoPagoClaro'}
      label={f.codigoPago(marca(c))}
      extra={f.codigoPagoPersonaAyuda}
      validateTrigger={disparo(c === 'atoz' ? 'codigoPagoAtoz' : 'codigoPagoClaro')}
      rules={[{ required: exigeCodigo, whitespace: true, message: f.errCodigoPersona }, { pattern: /^[A-Za-z0-9-]{1,30}$/, message: f.errCodigo }]}
    >
      <Input style={corto} autoComplete="off" />
    </Form.Item>
  ));

  /** El nombre es obligatorio salvo que se elija el agente que cumple el papel (de ahí sale). */
  const nombreObligatorio = !agenteElegido;

  return (
    <Drawer
      open
      title={titulo}
      size={token.controlHeightLG * 13}
      onClose={pedirCerrar}
      footer={
        <div style={{ display: 'flex', gap: token.marginXS, justifyContent: 'flex-end' }}>
          <Button onClick={pedirCerrar}>{m.comun.cancelar}</Button>
          <Button type="primary" loading={enviando} onClick={() => form.submit()}>
            {edicion ? m.directorio.form.guardar : tipo === 'agente' ? t.agregarAgente : tipo === 'equipo' ? t.agregarEquipo : t.agregarVendedor}
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
        initialValues={iniciales}
        onFinish={enviar}
        onFieldsChange={(_, todos) => setConError(new Set(todos.filter((c) => c.errors && c.errors.length > 0).map((c) => String(c.name))))}
        disabled={enviando}
      >
        {errorServidor && <Alert type="error" showIcon title={f.errServidor} description={errorServidor} style={{ marginBottom: token.margin }} />}
        <Cap style={{ display: 'block', marginBottom: token.margin }}>{f.leyenda}</Cap>

        {tipo === 'agente' && (
          <>
            {!edicion && (
              <Form.Item name="modo" label={t.modo} extra={t.modoAyuda}>
                <Radio.Group options={[{ value: 'nuevo', label: t.modoNuevo }, { value: 'existente', label: t.modoExistente }]} />
              </Form.Item>
            )}
            {modo === 'existente' ? (
              <Form.Item name="agenteId" label={t.agenteExistente} validateTrigger={disparo('agenteId')} rules={[{ required: true, message: t.errAgente }]}>
                <Select showSearch={{ optionFilterProp: 'label' }} options={opcionesAgente(true)} />
              </Form.Item>
            ) : (
              <>
                <Form.Item name="nombre" label={t.nombre} validateTrigger={disparo('nombre')} rules={[{ required: true, whitespace: true, message: t.errNombre }]}>
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item name="npn" label={t.npn} validateTrigger={disparo('npn')} rules={[{ required: true, whitespace: true, message: t.errNpn }]}>
                  <Input style={corto} autoComplete="off" />
                </Form.Item>
                {contacto}
                <Form.Item name="lobs" label={t.lobs}>
                  <Checkbox.Group options={directorio.baselines.lobs.map((l) => ({ value: l.codigo, label: l.nombre }))} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }} />
                </Form.Item>
                <Form.Item name="ffm" label={t.ffm}>
                  <Radio.Group options={[{ value: 'true', label: m.comun.si }, { value: 'false', label: m.comun.no }]} />
                </Form.Item>
                {companias}
                {codigos}
              </>
            )}
          </>
        )}

        {tipo === 'equipo' && (
          <>
            {/* El papel no se cambia al editar: un representante y un staff son registros distintos. */}
            <Form.Item name="papel" label={t.papel} rules={[{ required: true }]} hidden={!!edicion}>
              <Radio.Group options={[{ value: 'representante', label: t.representante }, { value: 'staff', label: t.staff }]} />
            </Form.Item>
            {papel === 'representante' && (
              <Form.Item name="agenteId" label={t.tambienAgente} extra={t.tambienAgenteAyuda}>
                <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={opcionesAgente(false)} />
              </Form.Item>
            )}
            <Form.Item
              name="nombre"
              label={t.nombre}
              validateTrigger={disparo('nombre')}
              rules={[{ required: papel === 'staff' || nombreObligatorio, whitespace: true, message: papel === 'staff' ? t.errNombre : t.errNombreOAgente }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
            {papel === 'staff' && (
              <Form.Item name="puesto" label={t.puesto}>
                <Input autoComplete="off" />
              </Form.Item>
            )}
            {contacto}
          </>
        )}

        {tipo === 'vendedor' && (
          <>
            <Form.Item name="agenteId" label={t.tambienAgente} extra={t.tambienAgenteAyuda}>
              <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={opcionesAgente(false)} />
            </Form.Item>
            <Form.Item name="nombre" label={t.nombre} validateTrigger={disparo('nombre')} rules={[{ required: nombreObligatorio, whitespace: true, message: t.errNombreOAgente }]}>
              <Input autoComplete="off" />
            </Form.Item>
            {contacto}
            {companias}
            {/* El vendedor que es agente usa su código de agente; el sin licencia lleva el suyo (H-023). */}
            {!agenteElegido && codigos}
          </>
        )}
      </Form>
    </Drawer>
  );
}

const codigosDe = (c: { claro: string | null; atoz: string | null }) => ({ ...(c.claro ? { codigoPagoClaro: c.claro } : {}), ...(c.atoz ? { codigoPagoAtoz: c.atoz } : {}) });

/** Los valores de una persona que ya existe, para editarla. */
function valoresDe(dir: DirectorioCompleto, e: { tipo: TipoMiembro; id: string }): Valores {
  const contacto = (p: { email: string | null; telefono: string | null }) => ({ ...(p.email ? { email: p.email } : {}), ...(p.telefono ? { telefono: p.telefono } : {}) });
  if (e.tipo === 'agente') {
    const a = dir.agentes.find((x) => x.id === e.id)!;
    return { modo: 'nuevo', nombre: a.nombre, npn: a.npn, ...contacto(a), lobs: a.lobs, ffm: String(a.certificacionFFM), companias: a.companias, ...codigosDe(a.codigoPago) };
  }
  if (e.tipo === 'representante') {
    const r = dir.representantes.find((x) => x.id === e.id)!;
    return { papel: 'representante', nombre: r.nombre, ...(r.agenteId ? { agenteId: r.agenteId } : {}), ...contacto(r) };
  }
  if (e.tipo === 'staff') {
    const st = dir.staff.find((x) => x.id === e.id)!;
    return { papel: 'staff', nombre: st.nombre, ...(st.puesto ? { puesto: st.puesto } : {}), ...contacto(st) };
  }
  const v = dir.vendedores.find((x) => x.id === e.id)!;
  return { nombre: v.nombre, ...(v.agenteId ? { agenteId: v.agenteId } : {}), ...contacto(v), companias: v.companias, ...codigosDe(v.codigoPago) };
}

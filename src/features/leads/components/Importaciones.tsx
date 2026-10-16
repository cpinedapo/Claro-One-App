'use client';
/**
 * Lead Management › Importaciones (H-025): carga masiva de leads desde la plantilla .xlsx de su tipo.
 *
 * - Arriba: cuántas importaciones hay, «Descargar plantilla» (menú con las 4) y «Subir archivo» (primaria).
 * - «Subir archivo» abre un `Drawer` (actuar con tablas, FRM-R30): tipo → archivo → vista previa validada por el
 *   servidor sin guardar nada → «Importar N leads», que pasa por el contrato `importar-leads` con su consecuencia.
 * - Historial de importaciones: una fila por archivo con su resultado global; al expandirla, los leads que
 *   entraron (y su asignación) y las filas que no entraron, con su motivo.
 * - Al expandirla también se resuelven, para los leads de ese archivo, el **territorio** por ZIP (y los ZIP sin
 *   territorio con Ask Claro) y la **asignación** a un Doer de New Business (H-043). A la pestaña Leads llegan asignados.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { Alert, App, Button, Checkbox, Dropdown, Flex, Modal, Segmented, Space, Spin, Tag, Tooltip, Typography, Upload, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { Bot, ChevronDown, CircleCheck, Download, FileSpreadsheet, Info, MapPin, Trash2, TriangleAlert, Upload as IconoSubir, UserCheck } from 'lucide-react';
import { AccionConConsecuencia, Cap, EstadoConMotivo, Ico, IcoTag, Pila, Tabla, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { actorPara } from '@/dominio/actor';
import { OBLIGATORIOS_DE, TIPOS_IMPORTACION, esStatusInicial } from '@/dominio/importacion';
import type { ErrorFila, FilaCruda, ImportacionHecha } from '@/dominio/importacion';
import type { Lead, TipoLead } from '@/dominio/leads';
import { actorVisible } from '@/dominio/roles';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { useIdioma } from '@/i18n/cliente';
import { ejecutarComercial, previsualizarImportacion } from '../acciones';
import type { VistaPrevia } from '../acciones';
import { CAPACIDAD_COMERCIAL } from '../contrato';
import { ResolverTerritorios } from './ResolverTerritorios';
import type { TerritorioEditable } from './ResolverTerritorios';
import { porAsignarTerritorio, territorioDeZip, tieneTerritorio, zipDeLead, zipsSinTerritorio } from '@/dominio/territorioLeads';
import type { EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';

const { Text, Title } = Typography;

export function PanelImportaciones({
  importaciones,
  leads,
  empleados,
  yo,
  puede,
  territorios,
  puedeTrabajar,
  puedeAsignar,
  puedeTerritorios,
  gestionarTerritorio,
}: {
  importaciones: ImportacionHecha[];
  /** Todos los leads: los de cada importación se muestran al expandirla. */
  leads: Lead[];
  empleados: EmpleadoConCorreo[];
  yo: EmpleadoConCorreo;
  puede: boolean;
  /** H-043: territorio y asignación de los leads de cada importación. */
  territorios: TerritorioEditable[];
  puedeTrabajar: boolean;
  puedeAsignar: boolean;
  puedeTerritorios: boolean;
  gestionarTerritorio: (accion: 'agregar-valor' | 'editar-valor', entrada: EntradaAccion) => Promise<{ ok: true } | { ok: false; motivo: string }>;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads.importar;
  const tl = m.leads;
  const [subiendo, setSubiendo] = useState(false);
  const [porEliminar, setPorEliminar] = useState<ImportacionHecha | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const { idioma } = useIdioma();
  const { message } = App.useApp();
  const router = useRouter();
  const accionEliminar = CAPACIDAD_COMERCIAL.acciones['eliminar-importacion'];
  const nombre = (id: string | null) => (id ? (empleados.find((e) => e.id === id)?.nombre ?? id) : null);
  /** Se elimina solo si todos sus leads siguen en «New» (H-026). El contrato también revisa las interacciones. */
  const eliminable = (i: ImportacionHecha) => !i.eliminada && leads.filter((l) => l.importacionId === i.id).every((l) => esStatusInicial(l.disposicion));

  async function eliminar() {
    if (!porEliminar) return;
    setEliminando(true);
    const r = await ejecutarComercial('eliminar-importacion', { importacionId: porEliminar.id });
    setEliminando(false);
    setPorEliminar(null);
    if (!r.ok) return message.error(r.motivo);
    message.success(r.evento.salida ?? m.calendario.listo);
    router.refresh();
  }

  const colErrores: TableColumnsType<ErrorFila> = [
    { key: 'fila', title: t.col.fila, align: 'right', width: token.controlHeightLG * 2, render: (_, e) => e.fila },
    { key: 'campo', title: t.col.campo, render: (_, e) => e.campo },
    { key: 'error', title: t.col.error, render: (_, e) => e.mensaje },
  ];

  const colHistorial: TableColumnsType<ImportacionHecha> = [
    { key: 'fecha', title: t.colI.fecha, render: (_, i) => <Text strong>{dayjs(i.cuando).format('YYYY-MM-DD')}</Text> },
    { key: 'hora', title: t.colI.hora, render: (_, i) => <Text type="secondary">{dayjs(i.cuando).format('HH:mm')}</Text> },
    {
      key: 'archivo',
      title: t.colI.archivo,
      render: (_, i) => (
        <div>
          <Text>{i.archivo}</Text>
          <div>
            <Cap>{tl.tipos[i.tipo]}</Cap>
          </div>
        </div>
      ),
    },
    { key: 'total', title: t.colI.total, align: 'right', render: (_, i) => i.total },
    { key: 'importados', title: t.colI.importados, align: 'right', render: (_, i) => i.importados },
    { key: 'errores', title: t.colI.errores, align: 'right', render: (_, i) => i.rechazados },
    { key: 'por', title: t.colI.por, render: (_, i) => i.por },
    {
      key: 'estado',
      title: t.colI.estado,
      render: (_, i) =>
        i.eliminada ? (
          <EstadoConMotivo compacto est="neutral" etiqueta={t.estados.eliminada} motivo={t.eliminadaPor(i.eliminada.por, dayjs(i.eliminada.cuando).format('YYYY-MM-DD HH:mm'))} />
        ) : i.rechazados ? (
          <EstadoConMotivo compacto est="at-risk" etiqueta={t.estados.conErrores} motivo={t.estadoMotivo.conErrores(i.rechazados)} />
        ) : (
          <EstadoConMotivo compacto est="ok" etiqueta={t.estados.completado} motivo={t.estadoMotivo.completado} />
        ),
    },
    ...(puede
      ? [
          {
            key: 'acciones',
            title: '',
            align: 'right' as const,
            render: (_: unknown, i: ImportacionHecha) =>
              i.eliminada ? null : eliminable(i) ? (
                <Button type="link" size="small" danger icon={<Ico de={Trash2} />} aria-label={`${t.eliminar} ${i.archivo}`} onClick={() => setPorEliminar(i)}>
                  {t.eliminar}
                </Button>
              ) : (
                <Tooltip title={t.noEliminable}>
                  <Text type="secondary">{t.eliminar}</Text>
                </Tooltip>
              ),
          },
        ]
      : []),
  ];

  return (
    <Pila>
      <Flex justify="space-between" align="flex-start" gap={token.margin} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t.titulo}
          </Title>
          <Text type="secondary">{t.conteo(importaciones.length)}</Text>
        </div>
        <Flex gap={token.marginXS} wrap>
          <Dropdown
            menu={{
              items: TIPOS_IMPORTACION.map((x) => ({ key: x, label: <a href={`/api/plantillas/${x}`}>{t.plantillaDe(tl.tipos[x])}</a> })),
            }}
          >
            <Button icon={<Ico de={Download} />}>
              <Flex gap={token.marginXXS} align="center">
                {t.plantilla}
                <Ico de={ChevronDown} />
              </Flex>
            </Button>
          </Dropdown>
          {puede && (
            <Button type="primary" icon={<Ico de={IconoSubir} />} onClick={() => setSubiendo(true)}>
              {t.subirArchivo}
            </Button>
          )}
        </Flex>
      </Flex>

      <div>
        <Title level={5} style={{ marginBottom: 0 }}>
          {t.historial}
        </Title>
        <Cap style={{ display: 'block', marginBottom: token.marginSM }}>{t.historialAyuda}</Cap>
        {importaciones.length === 0 ? (
          <VacioConMotivo titulo={t.historialVacio} motivo={t.subirAyuda} />
        ) : (
          <Tabla<ImportacionHecha>
            size="middle"
            rowKey="id"
            dataSource={importaciones}
            columns={colHistorial}
            pagination={importaciones.length > 20 ? { pageSize: 20 } : false}
            expandable={{
              expandedRowRender: (i) => (
                <DetalleImportacion
                  importacion={i}
                  leads={leads.filter((l) => l.importacionId === i.id)}
                  nombre={nombre}
                  colErrores={colErrores}
                  territorios={territorios}
                  puedeTrabajar={puedeTrabajar && !i.eliminada}
                  puedeAsignar={puedeAsignar && !i.eliminada}
                  puedeTerritorios={puedeTerritorios}
                  gestionarTerritorio={gestionarTerritorio}
                />
              ),
            }}
          />
        )}
      </div>

      {subiendo && <SubirArchivo onCerrar={() => setSubiendo(false)} />}
      <AccionConConsecuencia
        abierta={!!porEliminar}
        accion={accionEliminar}
        actor={accionEliminar ? actorVisible(actorPara(yo, accionEliminar), idioma) : null}
        impacto={porEliminar ? `${porEliminar.archivo} · ${t.detalle.importados(porEliminar.importados)}` : undefined}
        onConfirmar={eliminar}
        onCancelar={() => setPorEliminar(null)}
        okText={eliminando ? m.rolesPermisos.guardando : t.eliminar}
      />
    </Pila>
  );
}

/** Lo que trajo una importación: los leads que entraron y las filas que no. */
function DetalleImportacion({
  importacion: i,
  leads,
  nombre,
  colErrores,
  territorios,
  puedeTrabajar,
  puedeAsignar,
  puedeTerritorios,
  gestionarTerritorio,
}: {
  importacion: ImportacionHecha;
  leads: Lead[];
  nombre: (id: string | null) => string | null;
  colErrores: TableColumnsType<ErrorFila>;
  territorios: TerritorioEditable[];
  puedeTrabajar: boolean;
  puedeAsignar: boolean;
  puedeTerritorios: boolean;
  gestionarTerritorio: (accion: 'agregar-valor' | 'editar-valor', entrada: EntradaAccion) => Promise<{ ok: true } | { ok: false; motivo: string }>;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads.importar;
  const tt = m.leads.territorios;
  const { message } = App.useApp();
  const router = useRouter();
  const [vista, setVista] = useState<'importados' | 'errores'>(i.importados ? 'importados' : 'errores');
  const [resolviendo, setResolviendo] = useState<Evento | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const sinDato = <Text type="secondary">—</Text>;

  // Territorio y asignación de los leads de este archivo (H-043).
  const porAsignar = porAsignarTerritorio(leads, territorios);
  const sinTerritorio = zipsSinTerritorio(leads, territorios);
  const leadsSinTerritorio = sinTerritorio.reduce((n, g) => n + g.leads.length, 0);
  const abiertos = leads.filter((l) => l.fase === 'lead' && !l.cierre);
  const sinResponsable = abiertos.filter((l) => !l.responsableId).length;
  const conTerritorio = leads.filter((l) => tieneTerritorio(l, territorios)).length;
  const conZip = leads.filter((l) => zipDeLead(l)).length;
  const nombreT = (c: string) => territorios.find((x) => x.codigo === c)?.nombre ?? c;

  async function correr(accion: 'asignar-territorios' | 'sugerir-territorios' | 'asignar-leads', silencioso = false) {
    setOcupado(accion);
    const r = await ejecutarComercial(accion, { importacionId: i.id });
    setOcupado(null);
    if (!r.ok) {
      if (!silencioso) message.error(r.motivo);
      return r;
    }
    if (accion === 'sugerir-territorios') setResolviendo(r.evento);
    else {
      if (!silencioso) message.success(r.evento.salida ?? m.calendario.listo);
      router.refresh();
    }
    return r;
  }

  const colLeads: TableColumnsType<Lead> = [
    {
      key: 'lead',
      title: t.colD.lead,
      render: (_, l) => (
        <div>
          <Text>{l.nombre}</Text>
          {l.direccion?.calle && (
            <div>
              <Cap>{l.direccion.calle}</Cap>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'ciudad',
      title: t.colD.ciudad,
      render: (_, l) =>
        l.direccion?.ciudad || l.direccion?.zip ? (
          <div>
            <Text>{l.direccion?.ciudad}</Text>
            <div>
              <Cap>{[l.direccion?.estado, l.direccion?.zip].filter(Boolean).join(' ')}</Cap>
            </div>
          </div>
        ) : (
          sinDato
        ),
    },
    {
      key: 'territorio',
      title: t.colD.territorio,
      render: (_, l) => {
        const zip = zipDeLead(l);
        if (tieneTerritorio(l, territorios)) return <Tag>{nombreT(l.territorio!)}</Tag>;
        if (zip && territorioDeZip(zip, territorios)) return <Tag color="processing">{tt.porAsignarTag(territorioDeZip(zip, territorios)!.nombre)}</Tag>;
        if (zip) return <Tag color="warning">{tt.zipSinTerritorio(zip)}</Tag>;
        return <Text type="secondary">{tt.sinZip}</Text>;
      },
    },
    {
      key: 'lob',
      title: t.colD.lob,
      render: (_, l) =>
        l.lobs.length ? (
          <Flex gap={token.marginXXS} wrap>
            {l.lobs.map((x) => (
              <Tag key={x}>{x}</Tag>
            ))}
          </Flex>
        ) : (
          sinDato
        ),
    },
    { key: 'resp', title: t.colD.responsable, render: (_, l) => nombre(l.responsableId) ?? sinDato },
    { key: 'asig', title: t.colD.asignacion, render: (_, l) => (l.responsableId ? <Tag color="success">{t.asignado}</Tag> : <Tag color="warning">{t.sinAsignar}</Tag>) },
    { key: 'disp', title: t.colD.disposicion, render: (_, l) => (l.disposicion ? <Tag>{l.disposicion}</Tag> : sinDato) },
  ];

  return (
    <Pila gap="sm">
      <Flex justify="space-between" align="center" gap={token.marginSM} wrap>
        <Segmented
          value={vista}
          onChange={(v) => setVista(v as 'importados' | 'errores')}
          options={[
            { value: 'importados', label: t.detalle.importados(i.importados) },
            { value: 'errores', label: t.detalle.errores(i.rechazados) },
          ]}
        />
        {leads.length > 0 && (
          <Flex gap={token.marginXS} align="center" wrap>
            <Text type="secondary">{tt.resumen(conTerritorio, conZip, abiertos.length - sinResponsable, abiertos.length)}</Text>
            {puedeTrabajar && porAsignar.length > 0 && (
              <Button size="small" icon={<Ico de={MapPin} />} loading={ocupado === 'asignar-territorios'} onClick={() => correr('asignar-territorios')}>
                {tt.asignarPorZipN(porAsignar.length)}
              </Button>
            )}
            {puedeTrabajar && sinTerritorio.length > 0 && (
              <Button size="small" icon={<Ico de={Bot} />} loading={ocupado === 'sugerir-territorios'} onClick={() => correr('sugerir-territorios')}>
                {tt.resolverN(sinTerritorio.length)}
              </Button>
            )}
            {puedeAsignar && sinResponsable > 0 && (
              // Se habilita cuando todos sus leads con ZIP tienen territorio (H-042). Deshabilitado, dice por qué.
              <Tooltip title={leadsSinTerritorio || porAsignar.length ? tt.bloqueado : undefined}>
                <Button size="small" type="primary" icon={<Ico de={UserCheck} />} disabled={leadsSinTerritorio > 0 || porAsignar.length > 0} loading={ocupado === 'asignar-leads'} onClick={() => correr('asignar-leads')}>
                  {tt.asignarLeads(sinResponsable)}
                </Button>
              </Tooltip>
            )}
          </Flex>
        )}
      </Flex>
      {resolviendo && (
        <ResolverTerritorios
          propuesta={resolviendo}
          territorios={territorios}
          puedeAplicar={puedeTerritorios}
          gestionarTerritorio={gestionarTerritorio}
          asignarPorZip={async () => {
            const r = await correr('asignar-territorios', true);
            return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
          }}
          onCerrar={() => setResolviendo(null)}
        />
      )}
      {vista === 'importados' ? (
        leads.length ? (
          <Tabla<Lead> size="small" rowKey="id" dataSource={leads} columns={colLeads} pagination={leads.length > 20 ? { pageSize: 20 } : false} />
        ) : (
          <Cap>{i.importados ? t.sinLeads : t.historialVacio}</Cap>
        )
      ) : i.errores.length ? (
        <Tabla<ErrorFila> size="small" rowKey={(e) => `${e.fila}-${e.campo}-${e.mensaje}`} dataSource={i.errores} columns={colErrores} pagination={i.errores.length > 20 ? { pageSize: 20 } : false} />
      ) : (
        <Cap>{t.estadoMotivo.completado}</Cap>
      )}
    </Pila>
  );
}

/**
 * Subir un archivo (H-026). Primero el tipo y el archivo; después la **vista previa** de todas sus filas con todas
 * sus columnas: cada fila dice si está lista o qué error tiene, y la celda con error se marca. Solo se importa si el
 * 100 % de las filas está bien (regla del negocio): mientras tanto el botón queda deshabilitado y dice por qué.
 * La vista previa ya muestra qué va a entrar: «Importar» importa sin otra confirmación (decisión del negocio).
 */
function SubirArchivo({ onCerrar }: { onCerrar: () => void }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads.importar;
  const tl = m.leads;
  const { message } = App.useApp();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoLead>('agencia');
  const [leyendo, setLeyendo] = useState(false);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloErrores, setSoloErrores] = useState(false);
  const [importando, setImportando] = useState(false);

  const reiniciar = () => {
    setVista(null);
    setArchivo(null);
    setError(null);
    setSoloErrores(false);
  };

  async function leer(f: File) {
    setLeyendo(true);
    setError(null);
    setVista(null);
    const datos = new FormData();
    datos.set('tipo', tipo);
    datos.set('archivo', f);
    const r = await previsualizarImportacion(datos);
    setLeyendo(false);
    setArchivo(f.name);
    if (!r.ok) return setError(r.motivo);
    setVista(r);
  }

  async function importar() {
    if (!vista || !archivo) return;
    setImportando(true);
    const r = await ejecutarComercial('importar-leads', { tipo, archivo, filas: JSON.stringify(vista.filas) });
    setImportando(false);
    if (!r.ok) return message.error(r.motivo);
    message.success(r.evento.salida ?? m.calendario.listo);
    router.refresh();
    onCerrar();
  }

  // Los errores de cada fila, y de cada celda.
  const erroresDe = new Map<number, ErrorFila[]>();
  for (const e of vista?.errores ?? []) erroresDe.set(e.fila, [...(erroresDe.get(e.fila) ?? []), e]);
  const total = vista?.filas.length ?? 0;
  const conError = erroresDe.size;
  const listas = total - conError;
  const filas = (vista?.filas ?? []).filter((f) => !soloErrores || erroresDe.has(f.fila));

  const columnas: TableColumnsType<FilaCruda> = [
    { key: 'fila', title: t.colFila, fixed: 'left', align: 'right', width: token.controlHeightLG * 1.5, render: (_, f) => f.fila },
    {
      key: 'estado',
      title: t.colEstado,
      fixed: 'left',
      width: token.controlHeightLG * 3,
      render: (_, f) =>
        erroresDe.has(f.fila) ? (
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
      key: 'error',
      title: t.colError,
      width: token.controlHeightLG * 9,
      render: (_, f) =>
        erroresDe.has(f.fila) ? (
          <Pila gap="sm">
            {erroresDe.get(f.fila)!.map((e, i) => (
              <Text key={i} type="danger" style={{ fontSize: token.fontSizeSM }}>
                <Text strong type="danger" style={{ fontSize: token.fontSizeSM }}>
                  {e.campo}:
                </Text>{' '}
                {e.mensaje}
              </Text>
            ))}
          </Pila>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    // Todas las columnas de la plantilla, en su orden; la celda con error se marca.
    ...(vista?.encabezados ?? []).map((h) => ({
      key: h.clave,
      title: h.etiqueta,
      ellipsis: true,
      width: token.controlHeightLG * 4,
      onCell: (f: FilaCruda) => (erroresDe.get(f.fila)?.some((e) => e.clave === h.clave) ? { style: { background: token.colorErrorBg } } : {}),
      render: (_: unknown, f: FilaCruda) => f.valores[h.clave] || <Text type="secondary">—</Text>,
    })),
  ];

  return (
    <Modal
      open
      title={vista ? t.vistaPrevia : t.tituloSubir}
      width={vista ? '90vw' : token.controlHeightLG * 16}
      onCancel={onCerrar}
      destroyOnHidden
      footer={
        <Flex gap={token.marginXS} justify="flex-end" wrap>
          <Button onClick={vista || error ? reiniciar : onCerrar}>{vista || error ? t.otro : m.comun.cancelar}</Button>
          {vista && (
            // Decisión del negocio (H-026): solo con el 100 % de las filas bien. Deshabilitado, dice por qué.
            <Tooltip title={conError ? t.bloqueado : undefined}>
              <Button type="primary" icon={<Ico de={IconoSubir} />} disabled={conError > 0} loading={importando} onClick={importar}>
                {t.importarRegistros(listas)}
              </Button>
            </Tooltip>
          )}
        </Flex>
      }
    >
      {!vista && (
        <Pila>
          <Pila gap="sm">
            <Text strong>{t.tipo}</Text>
            <Segmented
              aria-label={t.tipo}
              value={tipo}
              onChange={(v) => {
                setTipo(v as TipoLead);
                reiniciar();
              }}
              options={TIPOS_IMPORTACION.map((x) => ({ value: x, label: tl.tipos[x] }))}
            />
            {/* Las reglas del archivo, a mano pero sin ocupar la pantalla. */}
            <Tooltip title={`${t.obligatorios(OBLIGATORIOS_DE[tipo])} ${t.reglas}`}>
              <Flex gap={token.marginXXS} align="center" style={{ width: 'fit-content', cursor: 'help' }} tabIndex={0}>
                <Ico de={Info} />
                <Text type="secondary">{t.reglasTitulo}</Text>
              </Flex>
            </Tooltip>
          </Pila>
          {!error ? (
            <Spin spinning={leyendo}>
              <Upload.Dragger
                accept=".xlsx"
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
            </Spin>
          ) : (
            <Alert type="error" showIcon title={archivo ?? undefined} description={error} />
          )}
        </Pila>
      )}

      {vista && archivo && (
        <Pila gap="sm">
          <Flex justify="space-between" align="center" gap={token.margin} wrap>
            <Space size={token.marginLG} wrap>
              <Text type="secondary">{archivo}</Text>
              <Text>
                {t.total}: <Text strong>{total}</Text>
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
          <Tabla<FilaCruda>
            size="small"
            rowKey={(f) => String(f.fila)}
            dataSource={filas}
            columns={columnas}
            scroll={{ x: 'max-content' }}
            pagination={filas.length > 20 ? { pageSize: 20 } : false}
          />
        </Pila>
      )}

    </Modal>
  );
}

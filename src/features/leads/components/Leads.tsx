'use client';
/**
 * Commercial › Lead Management: el pool «All Leads» del prototipo PB-002 v2.6 (H-021).
 *
 * - Tabs `line` de nivel 1 en la URL (`?vista=`, TAB-R08): Leads · Plan semanal · Ruta diaria. Las tres
 *   leen la misma cola de interacciones: no hay copias.
 * - El detalle del lead es un `Drawer` (mostrar) con Resumen · Negocio · Interacciones.
 * - Actuar: asignar y registrar resultado en `Modal`; una interacción nueva en `Drawer` (6 campos).
 * - La IA solo propone (IA-2, IA-3): su sugerencia se ve en una `ZonaIA` y una persona con permiso la
 *   revisa con su consecuencia (`AccionConConsecuencia`) antes de aplicarla.
 */
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Alert, App, Button, Card, Checkbox, DatePicker, Descriptions, Drawer, Empty, Flex, Form, Input, Modal, Radio, Select, Space, Steps, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { Bot, MapPin, Plus, Search } from 'lucide-react';
import { AccionConConsecuencia, Cap, EstadoConMotivo, Ico, Pila, SelloActor, Tabla, VacioConMotivo, ZonaIA } from '@arc2-0/claro-one-kit';
import type { EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';
import { actorPara } from '@/dominio/actor';
import { actorVisible } from '@/dominio/roles';
import {
  MOTIVOS_CIERRE, ORIGENES_LEAD, RESULTADOS, SECCIONES_INFO_NEGOCIO, TIPOS_INTERACCION, TIPOS_LEAD, faltaResultado, interaccionesDeFase, interaccionesDeLead,
  leadsDeFase, tieneValor,
} from '@/dominio/leads';
import type { FamiliaCierre, InteraccionComercial, Lead, Resultado, TipoInteraccionComercial, TipoLead } from '@/dominio/leads';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { useIdioma } from '@/i18n/cliente';
import type { Mensajes } from '@/i18n/mensajes';
import { ejecutarComercial } from '../acciones';
import type { AccionComercial } from '../acciones';
import { CAPACIDAD_COMERCIAL } from '../contrato';
import { PanelImportaciones } from './Importaciones';
import type { TerritorioEditable } from './ResolverTerritorios';
import { territorioDeZip, tieneTerritorio, zipDeLead } from '@/dominio/territorioLeads';
import type { ImportacionHecha } from '@/dominio/importacion';

const { Text, Title } = Typography;

export interface DatosLeads {
  hoy: string;
  leads: Lead[];
  interacciones: InteraccionComercial[];
  empleados: EmpleadoConCorreo[];
  /** Quien mira: para el sello de quién ejecuta. */
  yo: EmpleadoConCorreo;
  /** El historial de importaciones (H-025). */
  importaciones: ImportacionHecha[];
  /** Los territorios vigentes de Datos base, con sus ZIP (H-042). */
  territorios: TerritorioEditable[];
}
export interface PermisosLeads {
  /** Crear territorios o agregarles ZIP (Datos base, H-042): Administrador. */
  territorios: boolean;
  /** «Leads: ver» (H-032): las pestañas Leads, Plan semanal y Ruta diaria. */
  ver: boolean;
  /** «Leads: importar» (H-032): la pestaña Importaciones. */
  verImportaciones: boolean;
  asignar: boolean;
  trabajar: boolean;
  /** Importar leads desde una plantilla (H-025). */
  importar: boolean;
}

const VISTAS = ['importar', 'leads', 'plan', 'ruta'] as const;
type Vista = (typeof VISTAS)[number];
const COLOR_TIPO: Record<TipoInteraccionComercial, string> = { llamada: 'cyan', visita: 'geekblue', reunion: 'purple', evento: 'magenta' };

/** Ejecuta una acción del contrato y avisa. */
function useComercial() {
  const { message } = App.useApp();
  const router = useRouter();
  const { m } = useIdioma();
  return async (accion: AccionComercial, entrada: EntradaAccion, { silencioso = false } = {}) => {
    const r = await ejecutarComercial(accion, entrada);
    if (!r.ok) {
      if (!silencioso) message.error(r.motivo);
      return r;
    }
    if (r.modo === 'ejecuta' && r.evento.tipo === 'cambio') {
      message.success(r.evento.salida ?? m.calendario.listo);
      router.refresh();
    }
    return r;
  };
}

const etiquetaFuentes = (l: Lead, t: Mensajes['leads']) =>
  l.fuentes
    .map((f) => [t.origenes[f.origen as keyof typeof t.origenes] ?? f.origen, f.canal || null].filter(Boolean).join(' · ') + (f.campana ? ` (${f.campana})` : ''))
    .join(' + ');

function Estado({ est, motivo }: { est: string; motivo: string }) {
  const { m } = useIdioma();
  return <EstadoConMotivo compacto est={est} etiqueta={m.leads.estados[est as keyof typeof m.leads.estados] ?? est} motivo={motivo} />;
}

type ResultadoAccion = { ok: true } | { ok: false; motivo: string };

export function PantallaLeads({
  datos,
  permisos,
  gestionarTerritorio,
}: {
  datos: DatosLeads;
  permisos: PermisosLeads;
  /** Crear un territorio o agregarle ZIP: la acción de Datos base, que la página compone (H-042). */
  gestionarTerritorio: (accion: 'agregar-valor' | 'editar-valor', entrada: EntradaAccion) => Promise<ResultadoAccion>;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const t = m.leads;
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const v = params.get('vista');
  // Cada pestaña existe solo con su permiso (H-032).
  const visibles = VISTAS.filter((x) => (x === 'importar' ? permisos.verImportaciones : permisos.ver));
  const vista: Vista = (visibles as readonly string[]).includes(v ?? '') ? (v as Vista) : (visibles.includes('leads') ? 'leads' : visibles[0]!);
  const ejecutar = useComercial();

  const [filtro, setFiltro] = useState<{ texto: string; tipo: TipoLead | null; sinResponsable: boolean }>({ texto: '', tipo: null, sinResponsable: false });
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<Lead | null>(null);
  const [registrando, setRegistrando] = useState<InteraccionComercial | null>(null);
  const [nuevaPara, setNuevaPara] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<Evento | null>(null);
  const [pendiente, setPendiente] = useState<{ accionId: 'asignar-lead' | 'registrar-resultado-interaccion'; entrada: EntradaAccion } | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const nombre = (id: string | null) => (id ? (datos.empleados.find((e) => e.id === id)?.nombre ?? id) : t.sinAsignar);
  const leads = leadsDeFase(datos.leads, 'lead');
  const interacciones = interaccionesDeFase(datos.leads, datos.interacciones, 'lead').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const visitas = interacciones.filter((i) => i.tipo === 'visita').sort((a, b) => (a.ordenRuta ?? 99) - (b.ordenRuta ?? 99) || a.fecha.localeCompare(b.fecha));
  const leadDe = (id: string) => datos.leads.find((l) => l.id === id);
  // El territorio y la asignación se resuelven en Importaciones (H-043): aquí solo se ven.
  const nombreTerritorio = (c: string) => datos.territorios.find((x) => x.codigo === c)?.nombre ?? c;
  const abierto = abiertoId ? (leadDe(abiertoId) ?? null) : null;

  const q = filtro.texto.trim().toLowerCase();
  const filas = leads.filter(
    (l) =>
      (!q || l.nombre.toLowerCase().includes(q) || (l.contacto.nombre ?? '').toLowerCase().includes(q)) &&
      (!filtro.tipo || l.tipo === filtro.tipo) &&
      (!filtro.sinResponsable || !l.responsableId),
  );
  const activos = [
    ...(filtro.texto ? [{ key: 'texto', label: t.filtroBusqueda(filtro.texto), quitar: { texto: '' } }] : []),
    ...(filtro.tipo ? [{ key: 'tipo', label: t.filtroTipo(t.tipos[filtro.tipo]), quitar: { tipo: null } }] : []),
    ...(filtro.sinResponsable ? [{ key: 'sin', label: t.filtroSinResponsable, quitar: { sinResponsable: false } }] : []),
  ];
  const limpiar = () => setFiltro({ texto: '', tipo: null, sinResponsable: false });

  async function pedirIA(accion: 'sugerir-asignacion-lead' | 'sugerir-resultado-interaccion', entrada: EntradaAccion) {
    const r = await ejecutar(accion, entrada);
    if (r.ok) setPropuesta(r.evento);
  }
  function revisarPropuesta() {
    const s = (propuesta?.datos as { sugerencias?: { accionId: string; entrada: EntradaAccion }[] } | undefined)?.sugerencias?.[0];
    setPropuesta(null);
    if (s) setPendiente({ accionId: s.accionId as 'asignar-lead' | 'registrar-resultado-interaccion', entrada: s.entrada });
  }
  async function aplicar() {
    if (!pendiente) return;
    setAplicando(true);
    await ejecutar(pendiente.accionId, pendiente.entrada);
    setAplicando(false);
    setPendiente(null);
  }

  /* ---------------------------------------------------------------- columnas */
  const columnasLeads: TableColumnsType<Lead> = [
    {
      key: 'nombre',
      title: t.col.nombre,
      fixed: 'left',
      render: (_, l) => (
        <div>
          <Typography.Link onClick={() => setAbiertoId(l.id)}>{l.nombre}</Typography.Link>
          {l.demo && <Tag style={{ marginInlineStart: token.marginXS }}>{m.comun.demo}</Tag>}
          <div>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {[t.tipos[l.tipo], l.contacto.nombre !== l.nombre ? l.contacto.nombre : null].filter(Boolean).join(' · ')}
            </Text>
          </div>
        </div>
      ),
    },
    { key: 'lob', title: t.col.lob, render: (_, l) => l.lobs.join(', ') || <Text type="secondary">—</Text> },
    {
      key: 'territorio',
      title: t.col.territorio,
      render: (_, l) => {
        const zip = zipDeLead(l);
        if (tieneTerritorio(l, datos.territorios)) return <Tag icon={<Ico de={MapPin} />}>{nombreTerritorio(l.territorio!)}</Tag>;
        if (zip && territorioDeZip(zip, datos.territorios)) return <Tag color="processing">{t.territorios.porAsignarTag(nombreTerritorio(territorioDeZip(zip, datos.territorios)!.codigo))}</Tag>;
        if (zip) return <Tag color="warning">{t.territorios.zipSinTerritorio(zip)}</Tag>;
        return <Text type="secondary">{t.territorios.sinZip}</Text>;
      },
    },
    { key: 'fuente', title: t.col.fuente, render: (_, l) => <Text type="secondary">{etiquetaFuentes(l, t)}</Text> },
    { key: 'estado', title: t.col.estado, render: (_, l) => <Estado est={l.estado} motivo={l.motivo} /> },
    {
      key: 'resp',
      title: t.col.responsable,
      render: (_, l) =>
        l.responsableId ? (
          nombre(l.responsableId)
        ) : (
          <Flex gap={token.marginXXS} align="center" wrap>
            <Tag color="warning">{t.sinAsignar}</Tag>
            {permisos.asignar && (
              <Button size="small" type="link" icon={<Ico de={Bot} />} onClick={() => pedirIA('sugerir-asignacion-lead', { leadId: l.id })}>
                {t.sugerirIA}
              </Button>
            )}
          </Flex>
        ),
    },
    { key: 'fecha', title: t.col.fecha, render: (_, l) => l.fecha },
  ];

  const columnasInteraccion = (conOrden: boolean): TableColumnsType<InteraccionComercial> => [
    ...(conOrden ? [{ key: 'orden', title: t.col.orden, align: 'right' as const, render: (_: unknown, i: InteraccionComercial) => i.ordenRuta ?? '—' }] : []),
    {
      key: 'fecha',
      title: t.col.fecha,
      render: (_, i) => (i.fecha === datos.hoy ? <Text strong>{`${i.fecha} · ${t.hoyMarca}`}</Text> : i.fecha),
    },
    { key: 'tipo', title: t.col.tipo, render: (_, i) => <Tag color={COLOR_TIPO[i.tipo]}>{t.tiposInteraccion[i.tipo]}</Tag> },
    { key: 'lead', title: t.col.lead, render: (_, i) => <Typography.Link onClick={() => setAbiertoId(i.leadId)}>{leadDe(i.leadId)?.nombre ?? '—'}</Typography.Link> },
    { key: 'estado', title: t.col.estado, render: (_, i) => <Estado est={i.estado} motivo={i.motivo} /> },
    { key: 'resp', title: t.col.responsable, render: (_, i) => nombre(i.empleadoId) },
    { key: 'res', title: t.col.resultado, render: (_, i) => <CeldaResultado i={i} puede={permisos.trabajar} onRegistrar={setRegistrando} onIA={(id) => pedirIA('sugerir-resultado-interaccion', { interaccionId: id })} /> },
  ];

  const accionPendiente = pendiente ? CAPACIDAD_COMERCIAL.acciones[pendiente.accionId] : undefined;

  return (
    <Pila>
      {propuesta && (
        <ZonaIA superficie>
          <Alert
            type="info"
            showIcon
            icon={<Ico de={Bot} />}
            title={
              <span>
                <SelloActor actor={propuesta.actor} conNombre /> <Text strong>{t.ia.titulo}</Text>
              </span>
            }
            description={propuesta.salida}
            action={
              <Space orientation="vertical">
                {(propuesta.datos as { sugerencias?: unknown[] } | undefined)?.sugerencias?.length ? (
                  <Button size="small" type="primary" onClick={revisarPropuesta}>
                    {t.ia.revisar}
                  </Button>
                ) : null}
                <Button size="small" onClick={() => setPropuesta(null)}>
                  {t.ia.descartar}
                </Button>
              </Space>
            }
          />
        </ZonaIA>
      )}

      <Tabs
        activeKey={vista}
        onChange={(k) => router.replace(`${ruta}?vista=${k}`, { scroll: false })}
        items={[
          // Orden lógico: primero se importan los leads, después se trabajan.
          { key: 'importar', label: t.vistas.importar, children: (
            <PanelImportaciones
              importaciones={datos.importaciones}
              leads={datos.leads}
              empleados={datos.empleados}
              yo={datos.yo}
              puede={permisos.importar}
              territorios={datos.territorios}
              puedeTrabajar={permisos.trabajar}
              puedeAsignar={permisos.asignar}
              puedeTerritorios={permisos.territorios}
              gestionarTerritorio={gestionarTerritorio}
            />
          ) },
          {
            key: 'leads',
            label: t.vistas.leads,
            children:
              leads.length === 0 ? (
                <VacioConMotivo titulo={t.vacioTitulo} motivo={t.vacioMotivo} />
              ) : (
                <>
                  <div style={{ marginBottom: token.margin }}>
                    <Flex gap={token.margin} wrap align="center">
                      <Input
                        allowClear
                        aria-label={t.buscar}
                        placeholder={t.buscar}
                        prefix={<Ico de={Search} />}
                        value={filtro.texto}
                        onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
                        style={{ width: token.controlHeightLG * 8, maxWidth: '100%' }}
                      />
                      <Select
                        allowClear
                        aria-label={t.tipo}
                        placeholder={t.tipo}
                        value={filtro.tipo ?? undefined}
                        onChange={(x) => setFiltro({ ...filtro, tipo: (x as TipoLead | undefined) ?? null })}
                        style={{ width: token.controlHeightLG * 6 }}
                        options={TIPOS_LEAD.map((x) => ({ value: x, label: t.tipos[x] }))}
                      />
                      <Checkbox checked={filtro.sinResponsable} onChange={(e) => setFiltro({ ...filtro, sinResponsable: e.target.checked })}>
                        {t.soloSinResponsable}
                      </Checkbox>
                      <Text type="secondary" style={{ marginInlineStart: 'auto' }}>
                        {t.total(filas.length)}
                      </Text>
                    </Flex>
                    {activos.length > 0 && (
                      <Space size={token.marginXS} wrap style={{ marginTop: token.marginSM }}>
                        {activos.map((a) => (
                          <Tag
                            key={a.key}
                            closable
                            onClose={(e) => {
                              e.preventDefault();
                              setFiltro({ ...filtro, ...a.quitar });
                            }}
                          >
                            {a.label}
                          </Tag>
                        ))}
                        <Button type="link" size="small" onClick={limpiar}>
                          {m.comun.limpiarFiltros}
                        </Button>
                      </Space>
                    )}
                  </div>
                  <Tabla<Lead>
                    size="middle"
                    rowKey="id"
                    dataSource={filas}
                    columns={columnasLeads}
                    pagination={filas.length > 20 ? { pageSize: 20, showSizeChanger: true } : false}
                    locale={{
                      emptyText: (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.sinResultados}>
                          <Button size="small" onClick={limpiar}>
                            {m.comun.limpiarFiltros}
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </>
              ),
          },
          {
            key: 'plan',
            label: t.vistas.plan,
            children:
              interacciones.length === 0 ? (
                <VacioConMotivo titulo={t.planVacio[0]} motivo={t.planVacio[1]} />
              ) : (
                <Tabla<InteraccionComercial> size="middle" rowKey="id" dataSource={interacciones} columns={columnasInteraccion(false)} pagination={interacciones.length > 20 ? { pageSize: 20 } : false} />
              ),
          },
          {
            key: 'ruta',
            label: t.vistas.ruta,
            children:
              visitas.length === 0 ? (
                <VacioConMotivo titulo={t.rutaVacia[0]} motivo={t.rutaVacia[1]} />
              ) : (
                <Tabla<InteraccionComercial> size="middle" rowKey="id" dataSource={visitas} columns={columnasInteraccion(true)} pagination={false} />
              ),
          },
        ].filter((i) => (visibles as readonly string[]).includes(i.key))}
      />

      <Drawer
        open={!!abierto}
        size={token.controlHeightLG * 20}
        onClose={() => setAbiertoId(null)}
        title={
          abierto && (
            <Space>
              {abierto.nombre}
              <Tag>{t.tipos[abierto.tipo]}</Tag>
            </Space>
          )
        }
        extra={
          abierto && (
            <Space>
              {permisos.trabajar && (
                <Button icon={<Ico de={Plus} />} onClick={() => setNuevaPara(abierto.id)}>
                  {m.calendario.nuevaInteraccion}
                </Button>
              )}
              {permisos.asignar && <Button onClick={() => setAsignando(abierto)}>{abierto.responsableId ? t.reasignar : t.asignar}</Button>}
            </Space>
          )
        }
      >
        {abierto && (
          <DetalleLead
            key={abierto.id}
            lead={abierto}
            interacciones={interaccionesDeLead(datos.interacciones, abierto.id).sort((a, b) => b.fecha.localeCompare(a.fecha))}
            nombre={nombre}
            puede={permisos.trabajar}
            onRegistrar={setRegistrando}
            onIA={(id) => pedirIA('sugerir-resultado-interaccion', { interaccionId: id })}
          />
        )}
      </Drawer>

      {asignando && <ModalAsignar lead={asignando} empleados={datos.empleados} onCerrar={() => setAsignando(null)} />}
      {registrando && <ModalResultado interaccion={registrando} onCerrar={() => setRegistrando(null)} />}
      <FormularioInteraccion
        abierto={!!nuevaPara}
        leads={datos.leads.filter((l) => l.fase === 'lead')}
        leadFijo={nuevaPara ?? undefined}
        origen="Detalle de lead"
        hoy={datos.hoy}
        onCerrar={() => setNuevaPara(null)}
      />
      <AccionConConsecuencia
        abierta={!!pendiente}
        accion={accionPendiente}
        actor={pendiente && accionPendiente ? actorVisible(actorPara(datos.yo, accionPendiente), idioma) : null}
        onConfirmar={aplicar}
        onCancelar={() => setPendiente(null)}
        okText={aplicando ? m.rolesPermisos.guardando : undefined}
      />
    </Pila>
  );
}

/** El resultado de una interacción, o cómo registrarlo si falta. */
function CeldaResultado({
  i,
  puede,
  onRegistrar,
  onIA,
}: {
  i: InteraccionComercial;
  puede: boolean;
  onRegistrar: (i: InteraccionComercial) => void;
  onIA: (id: string) => void;
}) {
  const { m } = useIdioma();
  const t = m.leads;
  if (i.resultado) {
    return (
      <div>
        <Tag color={i.resultado === 'exitosa' ? 'success' : i.resultado === 'no-interesado' ? 'default' : 'warning'}>{t.resultados[i.resultado]}</Tag>
        {i.siguientePaso && (
          <div>
            <Cap>{i.siguientePaso}</Cap>
          </div>
        )}
      </div>
    );
  }
  if (!faltaResultado(i)) return <Text type="secondary">—</Text>;
  return puede ? (
    <Space size={0} wrap>
      <Button size="small" type="link" onClick={() => onRegistrar(i)}>
        {t.registrarResultado}
      </Button>
      <Button size="small" type="link" icon={<Ico de={Bot} />} onClick={() => onIA(i.id)}>
        {t.sugerirIA}
      </Button>
    </Space>
  ) : (
    <Tag color="warning">{t.faltaResultado}</Tag>
  );
}

/* ---------------------------------------------------------------- detalle */

function DetalleLead({
  lead: l,
  interacciones,
  nombre,
  puede,
  onRegistrar,
  onIA,
}: {
  lead: Lead;
  interacciones: InteraccionComercial[];
  nombre: (id: string | null) => string;
  puede: boolean;
  onRegistrar: (i: InteraccionComercial) => void;
  onIA: (id: string) => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads;
  const d = t.detalle;
  const sinDato = <Text type="secondary">—</Text>;
  const visitas = interacciones.filter((i) => i.tipo === 'visita');

  const resumen = (
    <Pila>
      <Descriptions
        title={d.informacion}
        column={{ xs: 1, md: 2 }}
        size="small"
        items={[
          { key: 'contacto', label: d.contacto, children: l.contacto.nombre ?? sinDato },
          { key: 'telefono', label: d.telefono, children: l.contacto.telefono ?? sinDato },
          { key: 'email', label: d.email, span: 'filled' as const, children: l.contacto.email ?? sinDato },
          { key: 'fuente', label: d.fuente, span: 'filled' as const, children: etiquetaFuentes(l, t) || sinDato },
          ...(l.referidoPor ? [{ key: 'ref', label: d.referidoPor, span: 'filled' as const, children: l.referidoPor }] : []),
          { key: 'estado', label: d.estado, span: 'filled' as const, children: <Estado est={l.estado} motivo={l.motivo} /> },
          ...(l.disposicion ? [{ key: 'disp', label: d.disposicion, children: l.disposicion }] : []),
          ...(l.cierre ? [{ key: 'cierre', label: d.cierre, children: `${t.familias[l.cierre.familia]} · ${l.cierre.motivo}` }] : []),
          { key: 'responsable', label: d.responsable, children: nombre(l.responsableId) },
          { key: 'prioridad', label: d.prioridad, children: l.prioridad ?? sinDato },
          { key: 'territorio', label: d.territorio, children: l.territorio ?? sinDato },
          // Un idioma (demo) o varios (importación): un solo dato.
          { key: 'idioma', label: d.idiomas, children: [...new Set([...(l.idioma ? [l.idioma] : []), ...l.idiomas])].join(', ') || sinDato },
          { key: 'lob', label: t.col.lob, children: l.lobs.join(', ') || sinDato },
          ...(l.centroMedico ? [{ key: 'centro', label: d.centroMedico, children: l.centroMedico }] : []),
          // Contacto ampliado de las plantillas de importación (H-025): solo lo que trae.
          ...(l.contactoTipo ? [{ key: 'ctipo', label: d.contactoTipo, children: l.contactoTipo }] : []),
          ...(l.telefonos.length > 1 ? [{ key: 'tels', label: d.otrosTelefonos, children: l.telefonos.slice(1).join(' · ') }] : []),
          ...(l.emails.length > 1 ? [{ key: 'mails', label: d.otrosCorreos, span: 'filled' as const, children: l.emails.slice(1).join(' · ') }] : []),
          ...(l.linkedin ? [{ key: 'li', label: d.linkedin, span: 'filled' as const, children: <Typography.Link href={l.linkedin} target="_blank" rel="noopener noreferrer">{l.linkedin}</Typography.Link> }] : []),
          ...(l.webs.length
            ? [{ key: 'webs', label: d.webs, span: 'filled' as const, children: <Space orientation="vertical" size={0}>{l.webs.map((w) => <Typography.Link key={w} href={w} target="_blank" rel="noopener noreferrer">{w}</Typography.Link>)}</Space> }]
            : []),
          ...(l.notas ? [{ key: 'notas', label: d.notas, span: 'filled' as const, children: l.notas }] : []),
        ]}
      />
      <Descriptions
        title={d.direccion}
        column={1}
        size="small"
        items={[
          {
            key: 'dir',
            label: d.direccion,
            children: l.direccion ? (
              <Space wrap>
                {[l.direccion.calle, l.direccion.ciudad, `${l.direccion.estado} ${l.direccion.zip}`].join(', ')}
                <Tag>{l.direccion.comercial ? d.comercial : d.residencial}</Tag>
              </Space>
            ) : (
              <Text type="secondary">{d.sinDireccion}</Text>
            ),
          },
        ]}
      />
      {l.cadencia && (
        <div>
          <Title level={5}>{d.cadencia}</Title>
          <Steps
            size="small"
            current={l.cadencia.every((c) => c.hecho) ? l.cadencia.length : l.cadencia.findIndex((c) => !c.hecho)}
            items={l.cadencia.map((c) => ({ title: c.paso, content: c.fecha ?? d.porAgendar, ...(c.hecho ? { status: 'finish' as const } : {}) }))}
          />
        </div>
      )}
      <div>
        <Title level={5}>{d.visitas(visitas.length)}</Title>
        {visitas.length === 0 ? (
          <Cap>{d.sinVisitas}</Cap>
        ) : (
          <Tabla<InteraccionComercial>
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={visitas}
            columns={[
              { key: 'fecha', title: t.col.fecha, render: (_, i) => i.fecha },
              { key: 'estado', title: t.col.estado, render: (_, i) => <Estado est={i.estado} motivo={i.motivo} /> },
              { key: 'notas', title: d.nota, render: (_, i) => i.notas ?? sinDato },
            ]}
          />
        )}
      </div>
    </Pila>
  );

  const info = l.infoNegocio;
  const negocio =
    l.tipo === 'benefit-coordinator' ? (
      <VacioConMotivo titulo={d.negocioNoAplica[0]} motivo={d.negocioNoAplica[1]} />
    ) : !info ? (
      <VacioConMotivo titulo={d.negocioVacio[0]} motivo={d.negocioVacio[1]} />
    ) : (
      <Pila>
        {SECCIONES_INFO_NEGOCIO.map((s) => {
          const campos = s.campos.filter((c) => tieneValor(info[c.key]));
          if (!campos.length) return null;
          return (
            <Card key={s.id} size="small" title={t.secciones[s.id as keyof typeof t.secciones]}>
              <Descriptions
                column={{ xs: 1, md: 2 }}
                size="small"
                items={campos.map((c) => {
                  const valor = info[c.key];
                  return {
                    key: c.key,
                    label: t.camposNegocio[c.key] ?? c.key,
                    span: c.tipo === 'lista' || c.key === 'objecionesClave' || c.key === 'proximosPasos' ? ('filled' as const) : 1,
                    children: Array.isArray(valor) ? (
                      <Space size={token.marginXXS} wrap>
                        {valor.map((x) => (
                          <Tag key={x}>{x}</Tag>
                        ))}
                      </Space>
                    ) : typeof valor === 'number' ? (
                      valor.toLocaleString()
                    ) : (
                      valor
                    ),
                  };
                })}
              />
            </Card>
          );
        })}
      </Pila>
    );

  const columnas: TableColumnsType<InteraccionComercial> = [
    {
      key: 'nombre',
      title: t.col.lead,
      render: (_, i) => (
        <div>
          <Text>{i.nombre}</Text>
          <div>
            <Space size={token.marginXXS} wrap>
              <Tag color={COLOR_TIPO[i.tipo]}>{t.tiposInteraccion[i.tipo]}</Tag>
              {i.primera && <Tag>{t.primera}</Tag>}
              {i.seguimiento && <Tag>{t.seguimiento}</Tag>}
            </Space>
          </div>
          {i.notas && (
            <div>
              <Cap>{i.notas}</Cap>
            </div>
          )}
        </div>
      ),
    },
    { key: 'fecha', title: t.col.fecha, render: (_, i) => i.fecha },
    { key: 'estado', title: t.col.estado, render: (_, i) => <Estado est={i.estado} motivo={i.motivo} /> },
    { key: 'contactado', title: d.contactado, render: (_, i) => i.personaContactada ?? i.contactoNombre ?? sinDato },
    { key: 'res', title: t.col.resultado, render: (_, i) => <CeldaResultado i={i} puede={puede} onRegistrar={onRegistrar} onIA={onIA} /> },
  ];

  return (
    <Tabs
      defaultActiveKey="resumen"
      items={[
        { key: 'resumen', label: d.tabs.resumen, children: resumen },
        { key: 'negocio', label: d.tabs.negocio, children: negocio },
        {
          key: 'interacciones',
          label: d.tabs.interacciones,
          children:
            interacciones.length === 0 ? (
              <VacioConMotivo titulo={d.interaccionesVacio[0]} motivo={d.interaccionesVacio[1]} />
            ) : (
              <Tabla<InteraccionComercial> size="small" rowKey="id" pagination={false} dataSource={interacciones} columns={columnas} />
            ),
        },
      ]}
    />
  );
}

/* ---------------------------------------------------------------- acciones */

/** Asignar: 1 campo, `Modal`. */
function ModalAsignar({ lead, empleados, onCerrar }: { lead: Lead; empleados: EmpleadoConCorreo[]; onCerrar: () => void }) {
  const { m } = useIdioma();
  const t = m.leads;
  const ejecutar = useComercial();
  const [form] = Form.useForm<{ empleadoId: string }>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal open title={t.asignarForm.titulo(lead.nombre)} okText={t.asignarForm.asignar} cancelText={m.comun.cancelar} confirmLoading={enviando} onOk={() => form.submit()} onCancel={onCerrar} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        initialValues={lead.responsableId ? { empleadoId: lead.responsableId } : {}}
        onFinish={async (v) => {
          setEnviando(true);
          const r = await ejecutar('asignar-lead', { leadId: lead.id, empleadoId: v.empleadoId }, { silencioso: true });
          setEnviando(false);
          if (!r.ok) return setError(r.motivo);
          onCerrar();
        }}
      >
        {error && <Alert type="error" showIcon title={error} />}
        <Form.Item name="empleadoId" label={t.asignarForm.persona} rules={[{ required: true, message: t.asignarForm.errPersona }]}>
          <Select showSearch={{ optionFilterProp: 'label' }} options={empleados.map((e) => ({ value: e.id, label: `${e.nombre} · ${e.puesto}` }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Registrar resultado: hasta 4 campos, `Modal`. Los campos de «por qué» solo si no fue exitosa (FRM-R44). */
function ModalResultado({ interaccion, onCerrar }: { interaccion: InteraccionComercial; onCerrar: () => void }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads;
  const f = t.resultadoForm;
  const ejecutar = useComercial();
  const [form] = Form.useForm<{ resultado: Resultado; familia?: FamiliaCierre; motivo?: string; siguientePaso?: string }>();
  const resultado = Form.useWatch('resultado', form);
  const familia = Form.useWatch('familia', form);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal open title={f.titulo} okText={f.registrar} cancelText={m.comun.cancelar} confirmLoading={enviando} onOk={() => form.submit()} onCancel={onCerrar} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        onFinish={async (v) => {
          setEnviando(true);
          const r = await ejecutar(
            'registrar-resultado-interaccion',
            { interaccionId: interaccion.id, resultado: v.resultado, familia: v.familia ?? '', motivo: v.motivo ?? '', siguientePaso: v.siguientePaso ?? '' },
            { silencioso: true },
          );
          setEnviando(false);
          if (!r.ok) return setError(r.motivo);
          onCerrar();
        }}
      >
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: token.margin }} />}
        <Text strong>{interaccion.nombre}</Text>
        {interaccion.notas && (
          <div>
            <Cap>{interaccion.notas}</Cap>
          </div>
        )}
        <Form.Item name="resultado" label={f.resultado} rules={[{ required: true, message: f.errResultado }]} style={{ marginTop: token.margin }}>
          <Radio.Group options={RESULTADOS.map((r) => ({ value: r, label: t.resultados[r] }))} />
        </Form.Item>
        {resultado && resultado !== 'exitosa' && (
          <>
            <Form.Item name="familia" label={f.familia} rules={[{ required: true, message: f.errFamilia }]}>
              <Radio.Group options={(Object.keys(MOTIVOS_CIERRE) as FamiliaCierre[]).map((x) => ({ value: x, label: t.familias[x] }))} />
            </Form.Item>
            {familia && (
              <Form.Item name="motivo" label={f.motivo}>
                <Select allowClear options={MOTIVOS_CIERRE[familia].map((x) => ({ value: x, label: x }))} />
              </Form.Item>
            )}
          </>
        )}
        <Form.Item name="siguientePaso" label={f.siguiente}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface ValoresInteraccion {
  leadId: string;
  tipo: TipoInteraccionComercial;
  fecha: Dayjs;
  hecha: boolean;
  estado?: string;
  motivo: string;
  notas?: string;
}

/**
 * Agendar o registrar una interacción con un lead: 6–7 campos, `Drawer`. Se exporta porque el
 * Calendario la ofrece también (la página la compone: una feature no importa de otra).
 */
export function FormularioInteraccion({
  abierto,
  leads,
  leadFijo,
  origen,
  hoy,
  onCerrar,
}: {
  abierto: boolean;
  leads: Pick<Lead, 'id' | 'nombre'>[];
  leadFijo?: string | undefined;
  origen: string;
  hoy: string;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads;
  const f = t.interaccionForm;
  const fo = m.directorio.form;
  const { modal } = App.useApp();
  const ejecutar = useComercial();
  const [form] = Form.useForm<ValoresInteraccion>();
  const hecha = Form.useWatch('hecha', form);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    form.resetFields();
    setError(null);
    onCerrar();
  };
  const pedirCerrar = () => {
    if (!form.isFieldsTouched()) return cerrar();
    modal.confirm({ title: fo.descartarTitulo, content: fo.descartarTexto, okText: fo.descartar, okButtonProps: { danger: true }, cancelText: fo.seguir, onOk: cerrar });
  };

  return (
    <Drawer
      open={abierto}
      title={f.titulo}
      size={token.controlHeightLG * 12}
      onClose={pedirCerrar}
      destroyOnHidden
      footer={
        <Flex gap={token.marginXS} justify="flex-end">
          <Button onClick={pedirCerrar}>{m.comun.cancelar}</Button>
          <Button type="primary" loading={enviando} onClick={() => form.submit()}>
            {f.guardar}
          </Button>
        </Flex>
      }
    >
      <Form<ValoresInteraccion>
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        validateTrigger="onBlur"
        scrollToFirstError={{ focus: true }}
        initialValues={{ leadId: leadFijo, tipo: 'llamada', fecha: dayjs(hoy), hecha: false, estado: 'ok' }}
        onFinish={async (v) => {
          setEnviando(true);
          setError(null);
          const r = await ejecutar(
            'crear-interaccion',
            { leadId: v.leadId, tipo: v.tipo, fecha: v.fecha.format('YYYY-MM-DD'), estado: v.hecha ? (v.estado ?? 'ok') : 'pending', motivo: v.motivo, notas: v.notas ?? '', origen },
            { silencioso: true },
          );
          setEnviando(false);
          if (!r.ok) return setError(r.motivo);
          cerrar();
        }}
        disabled={enviando}
      >
        {error && <Alert type="error" showIcon title={fo.errServidor} description={error} style={{ marginBottom: token.margin }} />}
        <Cap style={{ display: 'block', marginBottom: token.margin }}>{fo.leyenda}</Cap>
        <Form.Item name="leadId" label={f.lead} rules={[{ required: true, message: f.errLead }]} hidden={!!leadFijo}>
          <Select showSearch={{ optionFilterProp: 'label' }} options={leads.map((l) => ({ value: l.id, label: l.nombre }))} />
        </Form.Item>
        <Form.Item name="tipo" label={f.tipo} rules={[{ required: true }]}>
          <Radio.Group options={TIPOS_INTERACCION.map((x) => ({ value: x, label: t.tiposInteraccion[x] }))} />
        </Form.Item>
        <Form.Item name="fecha" label={f.fecha} rules={[{ required: true, message: f.errFecha }]}>
          <DatePicker allowClear={false} />
        </Form.Item>
        <Form.Item name="hecha" label={f.hecha}>
          <Radio.Group
            options={[
              { value: false, label: f.pendiente },
              { value: true, label: f.yaHecha },
            ]}
          />
        </Form.Item>
        {hecha && (
          <Form.Item name="estado" label={f.comoQuedo}>
            <Radio.Group options={(['ok', 'waiting', 'blocked', 'at-risk'] as const).map((x) => ({ value: x, label: t.estados[x] }))} />
          </Form.Item>
        )}
        <Form.Item name="motivo" label={f.motivo} rules={[{ required: true, whitespace: true, message: f.errMotivo }]}>
          <Input />
        </Form.Item>
        <Form.Item name="notas" label={f.notas}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

'use client';
/**
 * Mi espacio › Calendario: el Gestor de actividades del prototipo PB-002 v2.6 (H-021).
 *
 * Dos vistas sobre las mismas tareas (Task · E-063):
 * - Calendario: Mes con el `Calendar` de antd; Semana y Día compuestos con `Card` y `Tag`
 *   (PROVISIONAL: el kit no tiene vista semanal, hallazgo del prototipo §12).
 * - Tareas: pestañas Mías · Bandeja · Pedidas · Mi equipo (solo quien gestiona), agrupadas por estado.
 *
 * Mostrar va en `Drawer` y actuar en `Modal` o `Drawer` según los campos (FRM-R30). Toda escritura pasa
 * por el contrato `actividades`. Un Doer ve en su calendario solo lo suyo; quien gestiona puede sumar
 * lo de su equipo.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  Alert, App, Button, Calendar, Card, Collapse, DatePicker, Descriptions, Drawer, Empty, Flex, Form, Input, InputNumber, Modal, Radio, Segmented,
  Select, Space, Statistic, Tabs, Tag, Timeline, Tooltip, Typography, theme,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { CalendarDays, ChevronLeft, ChevronRight, Download, ListTodo, Play, Plus, Square, Timer } from 'lucide-react';
import { Cap, Cifras, EstadoConMotivo, Ico, Pila, Tabla, VacioConMotivo } from '@arc2-0/claro-one-kit';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import {
  ESTADOS_TAREA, ESTADO_NEGOCIO_DE_TAREA, PRIORIDADES, TIPOS_TAREA, bandejaDeEquipo, creadasParaOtros, delEquipo, duracion, enBandeja, esGestor,
  esMia, minutosDe, misTareas, ordenar, tocaDia, tocaRango, vencida,
} from '@/dominio/actividades';
import type { Cronometro, EstadoTarea, Prioridad, Tarea, TipoTarea } from '@/dominio/actividades';
import { nombreDe } from '@/dominio/baselines';
import type { OpcionBaseline } from '@/dominio/baselines';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { useIdioma } from '@/i18n/cliente';
import { useCalendario } from '../useCalendario';

const { Text, Title } = Typography;

/** Una interacción con un lead que es mía: entra a mi calendario (misma cola que Lead Management). */
export interface InteraccionDelCalendario {
  id: string;
  leadNombre: string;
  tipo: 'llamada' | 'visita' | 'reunion' | 'evento';
  fecha: string;
  estado: string;
  motivo: string;
  nombre: string;
  notas: string | null;
  contactoNombre: string | null;
}

export interface DatosCalendario {
  hoy: string;
  empleado: EmpleadoConCorreo;
  empleados: EmpleadoConCorreo[];
  tareas: Tarea[];
  cronometros: Cronometro[];
  interacciones: InteraccionDelCalendario[];
  /** Las áreas de Datos base: los equipos que reciben tareas. */
  areas: OpcionBaseline[];
  /** Agentes, agencias y leads, para relacionar una tarea con un cliente. */
  clientes: { tipo: 'agente' | 'agencia' | 'lead'; id: string; nombre: string }[];
}

type VistaCal = 'mes' | 'semana' | 'dia';
type Pestana = 'mias' | 'bandeja' | 'pedidas' | 'equipo';

/** Lo que entra al calendario: una tarea o una interacción con un lead. */
interface Item {
  id: string;
  titulo: string;
  tipo: TipoTarea;
  prioridad: Prioridad | null;
  fechaInicio: string;
  fechaFin: string;
  cerrada: boolean;
  persona: string | null;
  tarea: Tarea | null;
  interaccion: InteraccionDelCalendario | null;
}

/** Color por tipo de actividad: presets de antd, el mismo para el mismo tipo en toda la pantalla (GLB-R07). */
const COLOR_TIPO: Record<TipoTarea, string> = { tarea: 'blue', reunion: 'purple', llamada: 'cyan', visita: 'geekblue', evento: 'magenta' };
const COLOR_PRIORIDAD: Record<Prioridad, string | undefined> = { urgente: 'red', alta: 'orange', normal: 'blue', baja: undefined };

const aTexto = (d: Dayjs) => d.format('YYYY-MM-DD');

/** El reloj del cronómetro: hh:mm:ss desde el inicio. */
function useAhora(activo: boolean) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);
  return ahora;
}
const reloj = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

function descargar(csv: string, nombre: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function PantallaCalendario({
  datos,
  puede,
  renderNuevaInteraccion,
}: {
  datos: DatosCalendario;
  /** Escribir: falso en «Ver como». */
  puede: boolean;
  /** El alta de una interacción con un lead vive en Lead Management; la página la compone aquí. */
  renderNuevaInteraccion?: (abierto: boolean, cerrar: () => void) => ReactNode;
}) {
  const { token } = theme.useToken();
  const { m, idioma } = useIdioma();
  const t = m.calendario;
  const ejecutar = useCalendario();
  const { empleado: yo, empleados, tareas, cronometros, hoy } = datos;
  const gestor = esGestor(yo);
  const crono = cronometros.find((c) => c.empleadoId === yo.id) ?? null;
  const ahora = useAhora(!!crono);
  const nombre = (id: string | null) => (id ? (empleados.find((e) => e.id === id)?.nombre ?? id) : '—');
  const equipo = (codigo: string | null) => (codigo ? nombreDe(datos.areas, codigo) : t.propia);

  const [vista, setVista] = useState<'calendario' | 'tareas'>('calendario');
  const [calVista, setCalVista] = useState<VistaCal>('mes');
  const [fechaRef, setFechaRef] = useState(hoy);
  const [conEquipo, setConEquipo] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('mias');
  const [filtro, setFiltro] = useState<{ texto: string; prioridad: Prioridad | null; estado: EstadoTarea | null }>({ texto: '', prioridad: null, estado: null });
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [interaccionVista, setInteraccionVista] = useState<InteraccionDelCalendario | null>(null);
  const [modal, setModal] = useState<{ tipo: 'crear' | 'estado' | 'tiempo' | 'interaccion'; tarea?: Tarea } | null>(null);

  /* ---------------------------------------------------------------- listas */
  const mias = misTareas(tareas, yo.id);
  const bandeja = bandejaDeEquipo(tareas, yo);
  const pedidas = creadasParaOtros(tareas, yo.id);
  const deMiEquipo = gestor ? delEquipo(tareas, yo, empleados) : [];
  const tareaDetalle = detalleId ? (tareas.find((x) => x.id === detalleId) ?? null) : null;
  const tareaCrono = crono ? tareas.find((x) => x.id === crono.tareaId) : undefined;

  const items: Item[] = useMemo(() => {
    const deTarea = (x: Tarea, persona: string | null): Item => ({
      id: x.id, titulo: x.titulo, tipo: x.tipo, prioridad: x.prioridad, fechaInicio: x.fechaInicio, fechaFin: x.fechaFin, cerrada: x.estado === 'cerrada', persona, tarea: x, interaccion: null,
    });
    return [
      ...mias.map((x) => deTarea(x, null)),
      ...datos.interacciones.map<Item>((i) => ({
        id: `i-${i.id}`, titulo: `${i.nombre} · ${i.leadNombre}`, tipo: i.tipo, prioridad: null, fechaInicio: i.fecha, fechaFin: i.fecha, cerrada: i.estado === 'ok', persona: null, tarea: null, interaccion: i,
      })),
      ...(gestor && conEquipo ? deMiEquipo.map((x) => deTarea(x, nombre(x.responsableId))) : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, datos.interacciones, conEquipo, yo.id]);
  const itemsDe = (fecha: string) =>
    items
      .filter((it) => tocaDia(it, fecha))
      .sort((a, b) => Number(a.cerrada) - Number(b.cerrada) || PRIORIDADES.indexOf(a.prioridad ?? 'normal') - PRIORIDADES.indexOf(b.prioridad ?? 'normal'));
  const abrir = (it: Item) => (it.tarea ? setDetalleId(it.tarea.id) : setInteraccionVista(it.interaccion));

  /* ---------------------------------------------------------------- navegación */
  const ref = dayjs(fechaRef);
  const unidad = calVista === 'mes' ? 'month' : calVista === 'semana' ? 'week' : 'day';
  const mover = (n: number) => setFechaRef(aTexto(ref.add(n, unidad)));
  const inicioSemana = ref.startOf('week');
  const diasSemana = Array.from({ length: 7 }, (_, i) => aTexto(inicioSemana.add(i, 'day')));
  const rango: [string, string] =
    calVista === 'mes' ? [aTexto(ref.startOf('month')), aTexto(ref.endOf('month'))] : calVista === 'semana' ? [diasSemana[0]!, diasSemana[6]!] : [fechaRef, fechaRef];
  const tituloPeriodo =
    calVista === 'mes'
      ? ref.format('MMMM YYYY')
      : calVista === 'semana'
        ? `${dayjs(diasSemana[0]).format('D MMM')} – ${dayjs(diasSemana[6]).format('D MMM YYYY')}`
        : ref.format(idioma === 'en' ? 'dddd, MMMM D, YYYY' : 'dddd D [de] MMMM [de] YYYY');
  const tareasDelPeriodo = [...mias, ...(gestor && conEquipo ? deMiEquipo : [])].filter((x) => tocaRango(x, rango[0], rango[1]));

  /* ---------------------------------------------------------------- tareas */
  const pestanas: { key: Pestana; lista: Tarea[] }[] = [
    { key: 'mias', lista: mias },
    { key: 'bandeja', lista: bandeja },
    { key: 'pedidas', lista: pedidas },
    ...(gestor ? [{ key: 'equipo' as const, lista: deMiEquipo }] : []),
  ];
  const actual = pestanas.find((p) => p.key === pestana) ?? pestanas[0]!;
  const q = filtro.texto.trim().toLowerCase();
  const filtradas = ordenar(
    actual.lista.filter(
      (x) =>
        (!q || x.titulo.toLowerCase().includes(q) || (x.cliente?.nombre.toLowerCase().includes(q) ?? false)) &&
        (!filtro.prioridad || x.prioridad === filtro.prioridad) &&
        (!filtro.estado || x.estado === filtro.estado),
    ),
  );
  const activos = [
    ...(filtro.texto ? [{ key: 'texto', label: t.filtroBusqueda(filtro.texto), quitar: { texto: '' } }] : []),
    ...(filtro.prioridad ? [{ key: 'prioridad', label: t.filtroPrioridad(t.prioridades[filtro.prioridad]), quitar: { prioridad: null } }] : []),
    ...(filtro.estado ? [{ key: 'estado', label: t.filtroEstado(t.estados[filtro.estado]), quitar: { estado: null } }] : []),
  ];

  async function exportar(lista: Tarea[], sufijo: string) {
    const r = await ejecutar('exportar-tareas', { tareaIds: lista.map((x) => x.id).join(',') });
    if (!r.ok) return;
    const ids = new Set((r.evento.datos as { tareaIds: string[] } | undefined)?.tareaIds ?? []);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const filas = lista
      .filter((x) => ids.has(x.id))
      .map((x) => [
        x.id, x.titulo, t.tipos[x.tipo], t.prioridades[x.prioridad], x.fechaInicio, x.fechaFin, t.estados[x.estado], x.motivo,
        vencida(x, hoy) ? m.comun.si : m.comun.no, x.responsableId ? nombre(x.responsableId) : t.csv.sinTomar, equipo(x.equipoId), nombre(x.creadaPor),
        x.cliente?.nombre ?? '', duracion(minutosDe(x)), minutosDe(x),
      ]);
    descargar([esc(t.csv.titulo(hoy)), '', t.csv.cabecera.map(esc).join(','), ...filas.map((f) => f.map(esc).join(','))].join('\n'), `${t.csv.archivo}-${sufijo}-${hoy}.csv`);
  }

  /* ---------------------------------------------------------------- piezas */
  const tagTipo = (tipo: TipoTarea) => <Tag color={COLOR_TIPO[tipo]}>{t.tipos[tipo]}</Tag>;
  const tagPrioridad = (p: Prioridad) => <Tag color={COLOR_PRIORIDAD[p]}>{t.prioridades[p]}</Tag>;
  const estadoDe = (x: Tarea) => <EstadoConMotivo compacto est={ESTADO_NEGOCIO_DE_TAREA[x.estado]} etiqueta={t.estados[x.estado]} motivo={x.motivo} />;

  function botonCrono(x: Tarea) {
    if (!puede || !esMia(x, yo.id) || x.estado === 'cerrada') return null;
    const corriendo = crono?.tareaId === x.id;
    if (corriendo) {
      return (
        <Tooltip title={t.cronometro.detener}>
          <Button size="small" danger icon={<Ico de={Square} />} onClick={() => ejecutar('detener-cronometro', {})}>
            {reloj(ahora - Date.parse(crono!.inicio))}
          </Button>
        </Tooltip>
      );
    }
    return (
      <Tooltip title={crono ? t.cronometro.otro : t.cronometro.arrancar}>
        <Button size="small" icon={<Ico de={Play} />} disabled={!!crono} aria-label={t.cronometro.arrancar} onClick={() => ejecutar('iniciar-cronometro', { tareaId: x.id })} />
      </Tooltip>
    );
  }

  function accionesDe(x: Tarea) {
    if (!puede) return null;
    const mia = esMia(x, yo.id);
    return (
      <Space size={0} wrap>
        {mia && (
          <Button type="link" size="small" onClick={() => setModal({ tipo: 'estado', tarea: x })}>
            {t.acciones.cambiarEstado}
          </Button>
        )}
        {mia && (
          <Button type="link" size="small" onClick={() => setModal({ tipo: 'tiempo', tarea: x })}>
            {t.acciones.registrarTiempo}
          </Button>
        )}
        {enBandeja(x, yo) && (
          <Button type="link" size="small" onClick={() => ejecutar('tomar-tarea', { tareaId: x.id })}>
            {t.acciones.tomar}
          </Button>
        )}
      </Space>
    );
  }

  const quien = (x: Tarea) => {
    if (pestana === 'pedidas') {
      return (
        <div>
          <Text>{equipo(x.equipoId)}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {x.responsableId ? t.laTrabaja(nombre(x.responsableId)) : t.nadieLaTomo}
            </Text>
          </div>
        </div>
      );
    }
    if (pestana === 'equipo') return nombre(x.responsableId);
    if (x.creadaPor === yo.id) return <Text type="secondary">{t.propia}</Text>;
    return <Text type="secondary">{t.pedidaPor(nombre(x.creadaPor))}</Text>;
  };
  const tituloQuien = pestana === 'pedidas' ? t.col.equipoAsignado : pestana === 'equipo' ? t.col.responsable : t.col.origen;

  const columnas: TableColumnsType<Tarea> = [
    {
      key: 'tarea',
      title: t.col.tarea,
      render: (_, x) => (
        <div>
          <Typography.Link onClick={() => setDetalleId(x.id)} delete={x.estado === 'cerrada'}>
            {x.titulo}
          </Typography.Link>
          <div>
            <Space size={token.marginXXS} wrap>
              {tagTipo(x.tipo)}
              {x.cliente && (
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {x.cliente.nombre}
                </Text>
              )}
            </Space>
          </div>
        </div>
      ),
    },
    { key: 'prioridad', title: t.col.prioridad, render: (_, x) => tagPrioridad(x.prioridad) },
    {
      key: 'fechas',
      title: t.col.fechas,
      render: (_, x) => (
        <div>
          <Text>{x.fechaInicio === x.fechaFin ? x.fechaInicio : `${x.fechaInicio} → ${x.fechaFin}`}</Text>
          {vencida(x, hoy) && (
            <div>
              <Tag color="error">{t.vencida}</Tag>
            </div>
          )}
        </div>
      ),
    },
    { key: 'estado', title: t.col.estado, render: (_, x) => estadoDe(x) },
    { key: 'quien', title: tituloQuien, render: (_, x) => quien(x) },
    {
      key: 'tiempo',
      title: t.col.tiempo,
      align: 'right',
      render: (_, x) => (
        <Flex gap={token.marginXS} align="center" justify="flex-end">
          <Text>{duracion(minutosDe(x))}</Text>
          {botonCrono(x)}
        </Flex>
      ),
    },
    ...(puede ? [{ key: 'acciones', title: '', align: 'right' as const, render: (_: unknown, x: Tarea) => accionesDe(x) }] : []),
  ];

  const vacios: Record<Pestana, [string, string]> = {
    mias: t.vacios.mias,
    bandeja: t.vacios.bandeja(equipo(yo.areaId)),
    pedidas: t.vacios.pedidas,
    equipo: t.vacios.equipo,
  };

  /* ---------------------------------------------------------------- chip */
  function Chip({ it }: { it: Item }) {
    const texto = (it.persona ? `${it.persona.split(' ')[0]} · ` : '') + it.titulo;
    return (
      <Tooltip title={`${t.tipos[it.tipo]} · ${it.titulo}${it.prioridad ? ` · ${t.prioridades[it.prioridad]}` : ''}`}>
        <Tag
          color={COLOR_TIPO[it.tipo]}
          onClick={(ev) => {
            ev.stopPropagation();
            abrir(it);
          }}
          style={{
            display: 'block', width: '100%', margin: `0 0 ${token.marginXXS}px`, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: it.cerrada ? 'line-through' : 'none', opacity: it.cerrada ? token.opacityLoading + 0.3 : 1,
          }}
        >
          {texto}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Pila>
      {crono && tareaCrono && (
        <Alert
          type="info"
          showIcon
          icon={<Ico de={Timer} />}
          title={
            <Flex gap={token.marginSM} align="center" wrap>
              <Text>{t.cronometro.corriendo(tareaCrono.titulo)}</Text>
              <Text strong>{reloj(ahora - Date.parse(crono.inicio))}</Text>
            </Flex>
          }
          action={
            puede ? (
              <Button size="small" danger icon={<Ico de={Square} />} onClick={() => ejecutar('detener-cronometro', {})}>
                {t.cronometro.detener}
              </Button>
            ) : undefined
          }
        />
      )}

      <Flex gap={token.marginSM} wrap align="center" justify="space-between">
        <Segmented
          value={vista}
          onChange={(v) => setVista(v as 'calendario' | 'tareas')}
          options={[
            { value: 'calendario', label: t.vistas.calendario, icon: <Ico de={CalendarDays} /> },
            { value: 'tareas', label: t.vistas.tareas, icon: <Ico de={ListTodo} /> },
          ]}
        />
        {puede && (
          <Flex gap={token.marginXS} wrap>
            {renderNuevaInteraccion && (
              <Button icon={<Ico de={Plus} />} onClick={() => setModal({ tipo: 'interaccion' })}>
                {t.nuevaInteraccion}
              </Button>
            )}
            <Button type="primary" icon={<Ico de={Plus} />} onClick={() => setModal({ tipo: 'crear' })}>
              {t.nuevaTarea}
            </Button>
          </Flex>
        )}
      </Flex>

      <Card size="small">
        <Cifras>
          <Statistic title={t.cifras.pendientes} value={mias.filter((x) => x.estado === 'pendiente').length} />
          <Statistic title={t.cifras.enCurso} value={mias.filter((x) => x.estado === 'en-curso').length} />
          <Statistic title={t.cifras.vencidas} value={mias.filter((x) => vencida(x, hoy)).length} styles={{ content: { color: token.colorErrorText } }} />
          <Statistic title={t.cifras.bandeja} value={bandeja.length} />
          <Statistic title={t.cifras.pedidas} value={pedidas.filter((x) => x.estado !== 'cerrada').length} />
        </Cifras>
      </Card>

      {vista === 'calendario' && (
        <Pila gap="sm">
          <Flex gap={token.marginSM} wrap align="center" justify="space-between">
            <Flex gap={token.marginXS} align="center" wrap>
              <Button onClick={() => setFechaRef(hoy)}>{t.hoy}</Button>
              <Button icon={<Ico de={ChevronLeft} />} aria-label={t.anterior} onClick={() => mover(-1)} />
              <Button icon={<Ico de={ChevronRight} />} aria-label={t.siguiente} onClick={() => mover(1)} />
              <DatePicker allowClear={false} value={ref} aria-label={t.irAFecha} onChange={(d) => d && setFechaRef(aTexto(d))} />
              <Title level={4} style={{ margin: 0, textTransform: 'capitalize' }}>
                {tituloPeriodo}
              </Title>
            </Flex>
            <Flex gap={token.marginXS} align="center" wrap>
              {gestor && (
                <Segmented
                  aria-label={t.alcance}
                  value={conEquipo ? 'equipo' : 'mio'}
                  onChange={(v) => setConEquipo(v === 'equipo')}
                  options={[
                    { value: 'mio', label: t.soloMio },
                    { value: 'equipo', label: t.conEquipo },
                  ]}
                />
              )}
              <Segmented
                aria-label={t.periodo}
                value={calVista}
                onChange={(v) => setCalVista(v as VistaCal)}
                options={[
                  { value: 'mes', label: t.mes },
                  { value: 'semana', label: t.semana },
                  { value: 'dia', label: t.dia },
                ]}
              />
              <Button icon={<Ico de={Download} />} disabled={!tareasDelPeriodo.length} onClick={() => exportar(tareasDelPeriodo, rango[0])}>
                {t.exportar}
              </Button>
            </Flex>
          </Flex>

          {calVista === 'mes' && (
            <Card size="small">
              <Calendar
                value={ref}
                headerRender={() => null}
                onSelect={(d, info) => {
                  if (!info || info.source === 'date') setFechaRef(aTexto(d));
                }}
                cellRender={(d, info) => {
                  if (info.type !== 'date') return info.originNode;
                  const del = itemsDe(aTexto(d));
                  return (
                    <div>
                      {del.slice(0, 2).map((it) => (
                        <Chip key={it.id} it={it} />
                      ))}
                      {del.length > 2 && (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setFechaRef(aTexto(d));
                            setCalVista('dia');
                          }}
                        >
                          {t.masItems(del.length - 2)}
                        </Button>
                      )}
                    </div>
                  );
                }}
              />
            </Card>
          )}

          {calVista === 'semana' && (
            <Flex gap={token.marginXS} align="stretch" style={{ overflowX: 'auto' }}>
              {diasSemana.map((d) => {
                const del = itemsDe(d);
                const esHoy = d === hoy;
                return (
                  <Card
                    key={d}
                    size="small"
                    style={{ flex: '1 1 0', minWidth: token.controlHeightLG * 4, borderColor: esHoy ? token.colorPrimary : undefined }}
                    title={
                      <Typography.Link
                        strong={esHoy}
                        onClick={() => {
                          setFechaRef(d);
                          setCalVista('dia');
                        }}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {dayjs(d).format('ddd D')}
                      </Typography.Link>
                    }
                  >
                    <div style={{ minHeight: token.controlHeightLG * 6 }}>
                      {del.length === 0 ? <Cap>{t.sinActividades}</Cap> : del.map((it) => <Chip key={it.id} it={it} />)}
                    </div>
                  </Card>
                );
              })}
            </Flex>
          )}

          {calVista === 'dia' &&
            (itemsDe(fechaRef).length === 0 ? (
              <VacioConMotivo titulo={t.diaVacioTitulo} motivo={t.diaVacioMotivo(yo.nombre, fechaRef)} />
            ) : (
              <Pila gap="sm">
                {itemsDe(fechaRef).map((it) => (
                  <Card key={it.id} size="small">
                    <Flex justify="space-between" align="center" wrap gap={token.marginSM}>
                      <Flex vertical gap={token.marginXXS}>
                        <Space wrap>
                          {tagTipo(it.tipo)}
                          {it.tarea && tagPrioridad(it.tarea.prioridad)}
                          {it.persona && <Text type="secondary">{it.persona}</Text>}
                          {it.interaccion && <Text type="secondary">{t.interaccionDeLead}</Text>}
                        </Space>
                        <Typography.Link strong delete={it.cerrada} onClick={() => abrir(it)}>
                          {it.titulo}
                        </Typography.Link>
                        {it.tarea ? (
                          estadoDe(it.tarea)
                        ) : (
                          <EstadoConMotivo compacto est={it.interaccion!.estado} etiqueta={m.leads.estados[it.interaccion!.estado as keyof typeof m.leads.estados] ?? it.interaccion!.estado} motivo={it.interaccion!.motivo} />
                        )}
                      </Flex>
                      {it.tarea && (
                        <Flex gap={token.marginXS} align="center" wrap>
                          <Text type="secondary">{duracion(minutosDe(it.tarea))}</Text>
                          {botonCrono(it.tarea)}
                          {accionesDe(it.tarea)}
                        </Flex>
                      )}
                    </Flex>
                  </Card>
                ))}
              </Pila>
            ))}
        </Pila>
      )}

      {vista === 'tareas' && (
        <div>
          <Tabs activeKey={actual.key} onChange={(k) => setPestana(k as Pestana)} items={pestanas.map((p) => ({ key: p.key, label: t.pestanas[p.key] }))} />
          {actual.key === 'bandeja' && <Cap style={{ display: 'block', marginBottom: token.marginSM }}>{t.ayudaBandeja(equipo(yo.areaId))}</Cap>}
          {actual.key === 'pedidas' && <Cap style={{ display: 'block', marginBottom: token.marginSM }}>{t.ayudaPedidas}</Cap>}

          <div style={{ marginBottom: token.margin }}>
            <Flex gap={token.margin} wrap align="center">
              <Input
                allowClear
                aria-label={t.buscar}
                placeholder={t.buscar}
                value={filtro.texto}
                onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
                style={{ width: token.controlHeightLG * 8, maxWidth: '100%' }}
              />
              <Select
                allowClear
                aria-label={t.prioridad}
                placeholder={t.prioridad}
                value={filtro.prioridad ?? undefined}
                onChange={(v) => setFiltro({ ...filtro, prioridad: (v as Prioridad | undefined) ?? null })}
                style={{ width: token.controlHeightLG * 4 }}
                options={PRIORIDADES.map((p) => ({ value: p, label: t.prioridades[p] }))}
              />
              <Select
                allowClear
                aria-label={t.estado}
                placeholder={t.estado}
                value={filtro.estado ?? undefined}
                onChange={(v) => setFiltro({ ...filtro, estado: (v as EstadoTarea | undefined) ?? null })}
                style={{ width: token.controlHeightLG * 4 }}
                options={ESTADOS_TAREA.map((e) => ({ value: e, label: t.estados[e] }))}
              />
              <Button icon={<Ico de={Download} />} disabled={!filtradas.length} onClick={() => exportar(filtradas, actual.key)} style={{ marginInlineStart: 'auto' }}>
                {t.exportarExcel}
              </Button>
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
                <Button type="link" size="small" onClick={() => setFiltro({ texto: '', prioridad: null, estado: null })}>
                  {m.comun.limpiarFiltros}
                </Button>
              </Space>
            )}
          </div>

          {actual.lista.length === 0 ? (
            <VacioConMotivo titulo={vacios[actual.key][0]} motivo={vacios[actual.key][1]} />
          ) : filtradas.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.sinResultados}>
              <Button size="small" onClick={() => setFiltro({ texto: '', prioridad: null, estado: null })}>
                {m.comun.limpiarFiltros}
              </Button>
            </Empty>
          ) : (
            <Collapse
              defaultActiveKey={[...ESTADOS_TAREA]}
              // Solo los estados que tienen tareas: un grupo vacío no dice nada (GLB, vacío con motivo).
              items={ESTADOS_TAREA.filter((e) => filtradas.some((x) => x.estado === e)).map((e) => {
                const grupo = filtradas.filter((x) => x.estado === e);
                return {
                  key: e,
                  label: (
                    <Space>
                      <Text strong>{t.estados[e]}</Text>
                      <Text type="secondary">{grupo.length}</Text>
                    </Space>
                  ),
                  children: <Tabla<Tarea> size="small" rowKey="id" dataSource={grupo} columns={columnas} pagination={grupo.length > 20 ? { pageSize: 20 } : false} />,
                };
              })}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------ detalle (Drawer: mostrar) */}
      <Drawer
        open={!!tareaDetalle}
        size={token.controlHeightLG * 14}
        onClose={() => setDetalleId(null)}
        title={tareaDetalle?.titulo}
        extra={tareaDetalle ? botonCrono(tareaDetalle) : null}
      >
        {tareaDetalle && <DetalleTarea tarea={tareaDetalle} nombre={nombre} equipo={equipo} hoy={hoy} acciones={accionesDe(tareaDetalle)} />}
      </Drawer>

      <Drawer open={!!interaccionVista} size={token.controlHeightLG * 11} onClose={() => setInteraccionVista(null)} title={interaccionVista?.nombre}>
        {interaccionVista && (
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'lead', label: m.leads.col.lead, children: interaccionVista.leadNombre },
              { key: 'tipo', label: t.detalle.tipo, children: t.tipos[interaccionVista.tipo] },
              { key: 'fecha', label: t.detalle.fecha, children: interaccionVista.fecha },
              { key: 'contacto', label: m.leads.detalle.contacto, children: interaccionVista.contactoNombre ?? '—' },
              {
                key: 'estado',
                label: t.detalle.estado,
                children: (
                  <EstadoConMotivo compacto est={interaccionVista.estado} etiqueta={m.leads.estados[interaccionVista.estado as keyof typeof m.leads.estados] ?? interaccionVista.estado} motivo={interaccionVista.motivo} />
                ),
              },
              ...(interaccionVista.notas ? [{ key: 'notas', label: m.leads.detalle.nota, children: interaccionVista.notas }] : []),
            ]}
          />
        )}
      </Drawer>

      {/* ------------------------------------------------------ acciones */}
      {modal?.tipo === 'crear' && <FormularioTarea yo={yo} areas={datos.areas} clientes={datos.clientes} hoy={hoy} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'estado' && modal.tarea && <ModalEstado tarea={modal.tarea} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'tiempo' && modal.tarea && <ModalTiempo tarea={modal.tarea} hoy={hoy} onCerrar={() => setModal(null)} />}
      {renderNuevaInteraccion?.(modal?.tipo === 'interaccion', () => setModal(null))}
    </Pila>
  );
}

/* ---------------------------------------------------------------- detalle */

function DetalleTarea({
  tarea: x,
  nombre,
  equipo,
  hoy,
  acciones,
}: {
  tarea: Tarea;
  nombre: (id: string | null) => string;
  equipo: (c: string | null) => string;
  hoy: string;
  acciones: ReactNode;
}) {
  const { m } = useIdioma();
  const t = m.calendario;
  const d = t.detalle;
  return (
    <Pila>
      <Descriptions
        column={1}
        size="small"
        items={[
          { key: 'tipo', label: d.tipo, children: <Tag color={COLOR_TIPO[x.tipo]}>{t.tipos[x.tipo]}</Tag> },
          { key: 'prio', label: d.prioridad, children: <Tag color={COLOR_PRIORIDAD[x.prioridad]}>{t.prioridades[x.prioridad]}</Tag> },
          {
            key: 'fechas',
            label: d.fechas,
            children: (
              <Space>
                {`${x.fechaInicio} · ${x.fechaFin}`}
                {vencida(x, hoy) && <Tag color="error">{t.vencida}</Tag>}
              </Space>
            ),
          },
          { key: 'estado', label: d.estado, children: <EstadoConMotivo compacto est={ESTADO_NEGOCIO_DE_TAREA[x.estado]} etiqueta={t.estados[x.estado]} motivo={x.motivo} /> },
          { key: 'creada', label: d.creadaPor, children: nombre(x.creadaPor) },
          { key: 'equipo', label: d.equipoAsignado, children: equipo(x.equipoId) },
          { key: 'resp', label: d.responsable, children: x.responsableId ? nombre(x.responsableId) : t.nadieLaTomo },
          ...(x.cliente ? [{ key: 'cli', label: d.cliente, children: x.cliente.nombre }] : []),
          ...(x.descripcion ? [{ key: 'desc', label: d.descripcion, children: x.descripcion }] : []),
          { key: 'tiempo', label: d.tiempo, children: duracion(minutosDe(x)) },
        ]}
      />
      {acciones && <Flex justify="flex-end">{acciones}</Flex>}
      <div>
        <Title level={5}>{d.registros}</Title>
        {x.tiempo.length === 0 ? (
          <Cap>{d.sinTiempo}</Cap>
        ) : (
          <Tabla
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={x.tiempo}
            columns={[
              { key: 'fecha', title: d.fecha, render: (_, r) => r.fecha },
              { key: 'quien', title: d.persona, render: (_, r) => nombre(r.empleadoId) },
              { key: 'dur', title: d.tiempo, align: 'right', render: (_, r) => duracion(r.minutos) },
              { key: 'como', title: d.como, render: (_, r) => (r.origen === 'cronometro' ? <Tag icon={<Ico de={Timer} />}>{d.crono}</Tag> : <Tag>{d.manual}</Tag>) },
              { key: 'nota', title: d.nota, render: (_, r) => r.nota ?? <Text type="secondary">—</Text> },
            ]}
          />
        )}
      </div>
      <div>
        <Title level={5}>{d.historial}</Title>
        <Timeline
          items={[...x.historial].reverse().map((h, i) => ({
            key: i,
            color: h.estado === 'cerrada' ? 'green' : 'blue',
            title: `${h.cuando.slice(0, 10)} · ${t.estados[h.estado]} · ${nombre(h.quien)}`,
            content: <Text type="secondary">{h.motivo}</Text>,
          }))}
        />
      </div>
    </Pila>
  );
}

/* ---------------------------------------------------------------- formularios */

interface ValoresTarea {
  titulo: string;
  tipo: TipoTarea;
  prioridad: Prioridad;
  fechas: [Dayjs, Dayjs];
  asignarA: 'mi' | 'equipo';
  equipoId?: string;
  cliente?: string;
  descripcion?: string;
}

/** Crear una tarea: 8 campos, `Drawer` (FRM-R30). */
function FormularioTarea({
  yo,
  areas,
  clientes,
  hoy,
  onCerrar,
}: {
  yo: EmpleadoConCorreo;
  areas: OpcionBaseline[];
  clientes: DatosCalendario['clientes'];
  hoy: string;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.calendario;
  const f = m.directorio.form;
  const { modal } = App.useApp();
  const ejecutar = useCalendario();
  const [form] = Form.useForm<ValoresTarea>();
  const asignarA = Form.useWatch('asignarA', form);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedirCerrar = () => {
    if (!form.isFieldsTouched()) return onCerrar();
    modal.confirm({ title: f.descartarTitulo, content: f.descartarTexto, okText: f.descartar, okButtonProps: { danger: true }, cancelText: f.seguir, onOk: onCerrar });
  };

  async function enviar(v: ValoresTarea) {
    setEnviando(true);
    setError(null);
    const cliente = v.cliente ? clientes.find((c) => `${c.tipo}:${c.id}` === v.cliente) : undefined;
    const entrada: EntradaAccion = {
      titulo: v.titulo, tipo: v.tipo, prioridad: v.prioridad, fechaInicio: v.fechas[0].format('YYYY-MM-DD'), fechaFin: v.fechas[1].format('YYYY-MM-DD'),
      asignarA: v.asignarA, equipoId: v.equipoId ?? '', clienteTipo: cliente?.tipo ?? '', clienteId: cliente?.id ?? '', clienteNombre: cliente?.nombre ?? '', descripcion: v.descripcion ?? '',
    };
    const r = await ejecutar('crear-tarea', entrada, { silencioso: true });
    setEnviando(false);
    if (!r.ok) return setError(r.motivo);
    onCerrar();
  }

  return (
    <Drawer
      open
      title={t.nuevaTarea}
      size={token.controlHeightLG * 13}
      onClose={pedirCerrar}
      footer={
        <Flex gap={token.marginXS} justify="flex-end">
          <Button onClick={pedirCerrar}>{m.comun.cancelar}</Button>
          <Button type="primary" loading={enviando} onClick={() => form.submit()}>
            {t.form.crear}
          </Button>
        </Flex>
      }
    >
      <Form<ValoresTarea>
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        validateTrigger="onBlur"
        scrollToFirstError={{ focus: true }}
        initialValues={{ tipo: 'tarea', prioridad: 'normal', asignarA: 'mi', fechas: [dayjs(hoy), dayjs(hoy)] }}
        onFinish={enviar}
        disabled={enviando}
      >
        {error && <Alert type="error" showIcon title={f.errServidor} description={error} style={{ marginBottom: token.margin }} />}
        <Cap style={{ display: 'block', marginBottom: token.margin }}>{f.leyenda}</Cap>
        <Form.Item name="titulo" label={t.form.nombre} rules={[{ required: true, whitespace: true, message: t.form.errNombre }, { max: 140 }]}>
          <Input placeholder={t.form.nombrePlaceholder} autoComplete="off" />
        </Form.Item>
        <Form.Item name="tipo" label={t.form.tipo} rules={[{ required: true }]}>
          <Radio.Group options={TIPOS_TAREA.map((x) => ({ value: x, label: t.tipos[x] }))} />
        </Form.Item>
        <Form.Item name="prioridad" label={t.form.prioridad} rules={[{ required: true }]}>
          <Radio.Group options={PRIORIDADES.map((p) => ({ value: p, label: t.prioridades[p] }))} />
        </Form.Item>
        <Form.Item name="fechas" label={t.form.fechas} rules={[{ required: true, message: t.form.errFechas }]}>
          <DatePicker.RangePicker allowClear={false} />
        </Form.Item>
        <Form.Item name="asignarA" label={t.form.asignarA} rules={[{ required: true }]}>
          <Radio.Group
            options={[
              { value: 'mi', label: t.form.aMi },
              { value: 'equipo', label: t.form.aEquipo },
            ]}
          />
        </Form.Item>
        {asignarA === 'equipo' && (
          <Form.Item name="equipoId" label={t.form.equipo} extra={t.form.equipoAyuda} rules={[{ required: true, message: t.form.errEquipo }]}>
            <Select showSearch={{ optionFilterProp: 'label' }} options={areas.filter((a) => a.codigo !== yo.areaId).map((a) => ({ value: a.codigo, label: a.nombre }))} />
          </Form.Item>
        )}
        <Form.Item name="cliente" label={t.form.cliente}>
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            options={(['agente', 'agencia', 'lead'] as const).map((tipo) => ({
              label: tipo === 'agente' ? m.papeles.agente.varios : tipo === 'agencia' ? m.directorio.vistas.agencias : m.paginas.leads,
              title: tipo,
              options: clientes.filter((c) => c.tipo === tipo).map((c) => ({ value: `${c.tipo}:${c.id}`, label: c.nombre })),
            }))}
          />
        </Form.Item>
        <Form.Item name="descripcion" label={t.form.descripcion}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

/** Cambiar estado: 2 campos, `Modal`. */
function ModalEstado({ tarea, onCerrar }: { tarea: Tarea; onCerrar: () => void }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.calendario;
  const ejecutar = useCalendario();
  const [form] = Form.useForm<{ estado: EstadoTarea; motivo: string }>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sugerido: EstadoTarea = tarea.estado === 'pendiente' ? 'en-curso' : tarea.estado === 'en-curso' ? 'cerrada' : 'en-curso';
  return (
    <Modal open title={t.estadoForm.titulo} okText={t.estadoForm.guardar} cancelText={m.comun.cancelar} confirmLoading={enviando} onOk={() => form.submit()} onCancel={onCerrar} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        colon={false}
        initialValues={{ estado: sugerido }}
        onFinish={async (v) => {
          setEnviando(true);
          const r = await ejecutar('cambiar-estado-tarea', { tareaId: tarea.id, estado: v.estado, motivo: v.motivo }, { silencioso: true });
          setEnviando(false);
          if (!r.ok) return setError(r.motivo);
          onCerrar();
        }}
      >
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: token.margin }} />}
        <Text strong>{tarea.titulo}</Text>
        <Form.Item name="estado" label={t.estadoForm.nuevo} rules={[{ required: true }]} style={{ marginTop: token.margin }}>
          <Radio.Group options={ESTADOS_TAREA.map((e) => ({ value: e, label: t.estados[e], disabled: e === tarea.estado }))} />
        </Form.Item>
        <Form.Item name="motivo" label={t.estadoForm.motivo} rules={[{ required: true, whitespace: true, message: t.estadoForm.errMotivo }]}>
          <Input placeholder={t.estadoForm.motivoPlaceholder} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Registrar tiempo: 4 campos, `Modal`. */
function ModalTiempo({ tarea, hoy, onCerrar }: { tarea: Tarea; hoy: string; onCerrar: () => void }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.calendario;
  const ejecutar = useCalendario();
  const [form] = Form.useForm<{ horas: number; minutos: number; fecha: Dayjs; nota?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal open title={t.tiempoForm.titulo} okText={t.tiempoForm.registrar} cancelText={m.comun.cancelar} confirmLoading={enviando} onOk={() => form.submit()} onCancel={onCerrar} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        colon={false}
        initialValues={{ horas: 0, minutos: 30, fecha: dayjs(hoy) }}
        onFinish={async (v) => {
          const minutos = (v.horas || 0) * 60 + (v.minutos || 0);
          if (minutos <= 0) return setError(t.tiempoForm.errTiempo);
          setEnviando(true);
          const r = await ejecutar('registrar-tiempo', { tareaId: tarea.id, minutos: String(minutos), fecha: v.fecha.format('YYYY-MM-DD'), nota: v.nota ?? '' }, { silencioso: true });
          setEnviando(false);
          if (!r.ok) return setError(r.motivo);
          onCerrar();
        }}
      >
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: token.margin }} />}
        <Text strong>{tarea.titulo}</Text>
        <div>
          <Cap>{t.tiempoForm.llevas(duracion(minutosDe(tarea)))}</Cap>
        </div>
        <Flex gap={token.margin} wrap style={{ marginTop: token.margin }}>
          <Form.Item name="horas" label={t.tiempoForm.horas}>
            <InputNumber min={0} max={24} />
          </Form.Item>
          <Form.Item name="minutos" label={t.tiempoForm.minutos}>
            <InputNumber min={0} max={59} />
          </Form.Item>
          <Form.Item name="fecha" label={t.tiempoForm.dia}>
            <DatePicker allowClear={false} disabledDate={(d) => aTexto(d) > hoy} />
          </Form.Item>
        </Flex>
        <Form.Item name="nota" label={t.tiempoForm.nota}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

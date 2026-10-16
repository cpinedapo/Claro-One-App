'use client';
/**
 * Directorio, perspectiva Internal, sobre el modelo de agencias del negocio (H-013): `agencies`,
 * `agency_tree` y una relación fechada por tipo de persona.
 *
 * Estructura según el Manual de uso y buenas prácticas del kit (fichas Table · TBL y Tabs · TAB):
 * - Tabs `line` de nivel 1, una vista de trabajo por tipo, con columnas propias (excepción de 4.2).
 *   Representantes y staff no tienen pestaña: viven dentro de su agencia (pedido del negocio).
 *   El tab activo vive en la URL, `?vista=` (TAB-R08); cada tab conserva sus filtros (TAB-R07).
 * - Agencias: Table en árbol que nace plegado (H-011). Nivel, sub-agencias y downline salen de
 *   `agency_tree`, no se recorren a mano.
 * - 5–7 columnas (TBL-R01), primaria con link al detalle y fija (TBL-R03, R05, R26), estado con el
 *   color del kit (GLB-R07), cantidades a la derecha (3.7), «—» sin valor, orden visible (TBL-R44),
 *   `middle` en página y `small` en Drawer (3.8, TBL-R50), paginación desde 20 (TBL-R52).
 * - De solo lectura: sin contrato de capability no hay acciones (regla dura 5 del kit).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Descriptions, Drawer, Empty, Flex, Input, Popover, Popconfirm, Segmented, Space, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import { Pencil, Plus, Search } from 'lucide-react';
import { COMPANIAS, estadoDe, nombreAgencia, nombreCompania } from '@arc2-0/claro-one-kit/dominio';
import { Cap, EstadoConMotivo, Ico, IcoTag, Pila, Tabla, VacioConMotivo } from '@arc2-0/claro-one-kit';
import {
  ESTADO_NEGOCIO_DE_AGENCIA, agenciaYDescendientes, downline, esIndependiente, estaEnAgencia, membresiaEn, nivelEnArbol,
  otrosPapelesDeAgente, vigentes,
} from '@/dominio/directorio';
import type {
  AgenciaDirectorio, AgenteDirectorio, BenefitCoordinatorDirectorio, DirectorioCompleto, EstadoAgencia, Membresia,
  VendedorDescuentosDirectorio,
} from '@/dominio/directorio';
import type { Interaccion } from '@/dominio/interacciones';
import { useIdioma } from '@/i18n/cliente';
import type { Mensajes } from '@/i18n/mensajes';
import { FormularioAgencia } from './FormularioAgencia';
import { FormularioPersona } from './FormularioPersona';
import { PanelInteracciones } from './Interacciones';
import { nombreDe } from '@/dominio/baselines';
import { ESTADO_NEGOCIO_DE_DOCUMENTO, codigosFaltantes, documentosAprobados, documentosDe, exigeCodigoPersona, masterDe, nivelesDe, pagoDeAgencia } from '@/dominio/pagos';
import type { DocumentoPagoRegistro, TitularPago } from '@/dominio/pagos';
import { CompaniasAgencia, EtiquetasAgencia, LobsAgencia, NegociacionesLegacy, PanelEquipoClaro, useEjecutar } from './RelacionesAgencia';
import type { TipoMiembro } from '../contrato';

const { Text } = Typography;

/* ----------------------------------------------------------- vistas y filtros */

type Vista = 'agencias' | 'agente' | 'vendedor-descuentos' | 'benefit-coordinator';
/** Las vistas, en orden. Sus etiquetas (1–2 palabras, TAB-R10) vienen del diccionario. */
const VISTAS: Vista[] = ['agencias', 'agente', 'vendedor-descuentos', 'benefit-coordinator'];
const esVista = (v: string | null): v is Vista => !!v && VISTAS.includes(v as Vista);

type Afiliacion = 'todas' | 'agencia' | 'independiente';
interface Filtros {
  texto: string;
  compania: string | null;
  afiliacion: Afiliacion;
}
const SIN_FILTROS: Filtros = { texto: '', compania: null, afiliacion: 'todas' };

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const marca = (cid: string) => (cid === 'atoz' ? 'AtoZ' : cid === 'claro' ? 'Claro' : cid);
const porNombre = <T extends { nombre: string }>(a: T, b: T) => a.nombre.localeCompare(b.nombre);
const deCompania = (f: Filtros) => (x: { companias: string[] }) => !f.compania || x.companias.includes(f.compania);
const coincide = (f: Filtros) => (x: { nombre: string; npn?: string | null }) => {
  const q = sinTildes(f.texto.trim());
  return !q || sinTildes(x.nombre).includes(q) || (x.npn ?? '').includes(q);
};
const deAfiliacion = (f: Filtros) => (x: { agencias: Membresia[] }) =>
  f.afiliacion === 'todas' || (f.afiliacion === 'independiente') === esIndependiente(x);

/** Paginación desde 20 registros, siempre abajo, con total (TBL-R52, R53). */
function paginacion(total: number, m: Mensajes): TablePaginationConfig | false {
  if (total <= 20) return false;
  return {
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    showSizeChanger: true,
    showTotal: (t, [desde, hasta]) => m.directorio.paginacion(desde, hasta, t),
  };
}

type TipoPersona = 'agente' | 'representante' | 'staff' | 'vendedor' | 'bc';
type Detalle = { tipo: 'agencia'; id: string } | { tipo: TipoPersona; id: string } | null;

interface Navegacion {
  onAgencia: (id: string) => void;
  onPersona: (tipo: TipoPersona, id: string) => void;
}

/* ------------------------------------------------------------------ pantalla */

/** Lo que el contrato `gestion-de-agencias` le concede a quien mira; lo calcula el servidor. */
export interface PermisosDirectorio {
  crearAgencia: boolean;
  editarAgencia: boolean;
  /** Agregar agentes, equipo y vendedores a una agencia. */
  agregarPersonas: boolean;
  /** Equipo de trabajo, líneas de negocio, compañías y labels de una agencia. */
  relaciones: boolean;
  /** Editar a un miembro de la agencia o quitarlo de ella (H-020). */
  editarPersonas: boolean;
}

type Formulario =
  | { modo: 'crear'; madreId?: string }
  | { modo: 'editar'; agenciaId: string }
  | { modo: 'alta'; tipo: 'agente' | 'equipo' | 'vendedor'; agenciaId: string }
  | { modo: 'editar-persona'; tipo: TipoMiembro; id: string; agenciaId: string }
  | null;

export function PantallaDirectorio({
  directorio,
  interacciones,
  permisos,
}: {
  directorio: DirectorioCompleto;
  interacciones: Interaccion[];
  permisos: PermisosDirectorio;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const vistaUrl = params.get('vista');
  const vista: Vista = esVista(vistaUrl) ? vistaUrl : 'agencias';

  const [filtros, setFiltros] = useState<Record<Vista, Filtros>>(
    () => Object.fromEntries(VISTAS.map((v) => [v, SIN_FILTROS])) as Record<Vista, Filtros>,
  );
  const [detalle, setDetalle] = useState<Detalle>(null);
  const [formulario, setFormulario] = useState<Formulario>(null);

  const nav: Navegacion = {
    onAgencia: (id) => setDetalle({ tipo: 'agencia', id }),
    onPersona: (tipo, id) => setDetalle({ tipo, id }),
  };
  const cambiarVista = (v: string) => router.replace(`${ruta}?vista=${v}`, { scroll: false });
  const actualizar = (v: Vista, cambios: Partial<Filtros>) => setFiltros((f) => ({ ...f, [v]: { ...f[v], ...cambios } }));

  if (directorio.agencias.length === 0 && directorio.agentes.length === 0) {
    return <VacioConMotivo titulo={m.directorio.vacioTitulo} motivo={m.directorio.vacioMotivo} pie="Agency · E-003 · Agent · E-002" />;
  }

  const panel = (v: Vista) => {
    const props = { filtros: filtros[v], onCambio: (c: Partial<Filtros>) => actualizar(v, c), directorio, nav };
    if (v === 'agencias') return <PanelAgencias {...props} {...(permisos.crearAgencia ? { onCrear: () => setFormulario({ modo: 'crear' }) } : {})} />;
    if (v === 'agente') return <PanelAgentes {...props} />;
    if (v === 'vendedor-descuentos') return <PanelVendedores {...props} />;
    return <PanelBenefitCoordinators {...props} />;
  };

  const agenciaAbierta = detalle?.tipo === 'agencia' ? directorio.agencias.find((a) => a.id === detalle.id) : undefined;
  const personaAbierta = detalle && detalle.tipo !== 'agencia' ? detalle : null;
  const nombrePersona = personaAbierta ? nombreDePersona(directorio, personaAbierta.tipo, personaAbierta.id) : '';

  return (
    <div>
      <Tabs activeKey={vista} onChange={cambiarVista} items={VISTAS.map((v) => ({ key: v, label: m.directorio.vistas[v], children: panel(v) }))} />

      <Drawer
        open={!!agenciaAbierta}
        title={agenciaAbierta?.nombre}
        size={token.controlHeightLG * 18}
        onClose={() => setDetalle(null)}
        extra={
          permisos.editarAgencia && agenciaAbierta ? (
            <Button icon={<Ico de={Pencil} />} onClick={() => setFormulario({ modo: 'editar', agenciaId: agenciaAbierta.id })}>
              {m.directorio.form.editar}
            </Button>
          ) : undefined
        }
      >
        {agenciaAbierta && <DetalleAgencia
            key={agenciaAbierta.id}
            agencia={agenciaAbierta}
            directorio={directorio}
            interacciones={interacciones}
            nav={nav}
            puedeRelaciones={permisos.relaciones}
            {...(permisos.editarPersonas ? { onEditarPersona: (tipo: TipoMiembro, id: string) => setFormulario({ modo: 'editar-persona', tipo, id, agenciaId: agenciaAbierta.id }) } : {})}
            onAlta={
              permisos.agregarPersonas || permisos.crearAgencia
                ? (tipo) => {
                    if (tipo === 'subagencia') {
                      if (permisos.crearAgencia) setFormulario({ modo: 'crear', madreId: agenciaAbierta.id });
                    } else if (permisos.agregarPersonas) setFormulario({ modo: 'alta', tipo, agenciaId: agenciaAbierta.id });
                  }
                : undefined
            }
          />}
      </Drawer>

      <Drawer open={!!personaAbierta} title={nombrePersona} size={token.controlHeightLG * 16} onClose={() => setDetalle(null)}>
        {personaAbierta && <DetallePersona tipo={personaAbierta.tipo} id={personaAbierta.id} directorio={directorio} nav={nav} />}
      </Drawer>

      {formulario && (formulario.modo === 'crear' || formulario.modo === 'editar') && (
        <FormularioAgencia
          key={formulario.modo === 'editar' ? formulario.agenciaId : `nueva-${formulario.madreId ?? ''}`}
          modo={formulario.modo}
          {...(formulario.modo === 'editar' ? { agencia: directorio.agencias.find((a) => a.id === formulario.agenciaId)! } : {})}
          {...(formulario.modo === 'crear' && formulario.madreId ? { madreId: formulario.madreId } : {})}
          directorio={directorio}
          abierto
          onCerrar={() => setFormulario(null)}
        />
      )}
      {formulario && formulario.modo === 'alta' && (
        <FormularioPersona
          key={`${formulario.tipo}-${formulario.agenciaId}`}
          tipo={formulario.tipo}
          agencia={directorio.agencias.find((a) => a.id === formulario.agenciaId)!}
          directorio={directorio}
          onCerrar={() => setFormulario(null)}
        />
      )}
      {formulario && formulario.modo === 'editar-persona' && (
        <FormularioPersona
          key={`editar-${formulario.tipo}-${formulario.id}`}
          tipo={formulario.tipo === 'agente' ? 'agente' : formulario.tipo === 'vendedor' ? 'vendedor' : 'equipo'}
          edicion={{ tipo: formulario.tipo, id: formulario.id }}
          agencia={directorio.agencias.find((a) => a.id === formulario.agenciaId)!}
          directorio={directorio}
          onCerrar={() => setFormulario(null)}
        />
      )}
    </div>
  );
}

function nombreDePersona(dir: DirectorioCompleto, tipo: TipoPersona, id: string): string {
  const lista: { id: string; nombre: string }[] = {
    agente: dir.agentes,
    representante: dir.representantes,
    staff: dir.staff,
    vendedor: dir.vendedores,
    bc: dir.benefitCoordinators,
  }[tipo];
  return lista.find((p) => p.id === id)?.nombre ?? '';
}

/* -------------------------------------------------- barra de filtros (TBL 3.6) */

/**
 * Búsqueda a la izquierda, filtros a continuación y el total a la derecha (TBL-R37, R53). Los filtros
 * activos se repiten como `Tag` cerrable con «Limpiar filtros» (TBL-R40). Filtrado en vivo (TBL-R42).
 */
function BarraFiltros({
  filtros,
  onCambio,
  conAfiliacion,
  placeholder,
  total,
  unidad,
}: {
  filtros: Filtros;
  onCambio: (c: Partial<Filtros>) => void;
  conAfiliacion: boolean;
  placeholder: string;
  total: number;
  unidad: [string, string];
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const d = m.directorio;
  const activos: { key: string; label: string; quitar: Partial<Filtros> }[] = [
    ...(filtros.texto ? [{ key: 'texto', label: d.filtroBusqueda(filtros.texto), quitar: { texto: '' } }] : []),
    ...(filtros.compania ? [{ key: 'compania', label: d.filtroCompania(marca(filtros.compania)), quitar: { compania: null } }] : []),
    ...(filtros.afiliacion !== 'todas'
      ? [{ key: 'afiliacion', label: d.filtroAfiliacion(filtros.afiliacion === 'agencia' ? d.deAgencia : d.independiente), quitar: { afiliacion: 'todas' as const } }]
      : []),
  ];

  return (
    <div style={{ marginBottom: token.margin }}>
      <div style={{ display: 'flex', gap: token.margin, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          allowClear
          aria-label={placeholder}
          placeholder={placeholder}
          prefix={<Ico de={Search} />}
          value={filtros.texto}
          onChange={(e) => onCambio({ texto: e.target.value })}
          style={{ width: token.controlHeightLG * 8, maxWidth: '100%' }}
        />
        <Segmented
          aria-label={d.companiaInterna}
          value={filtros.compania ?? 'todas'}
          onChange={(v) => onCambio({ compania: v === 'todas' ? null : String(v) })}
          options={[{ label: d.todasCompanias, value: 'todas' }, ...COMPANIAS.map((c) => ({ label: marca(c.id), value: c.id }))]}
        />
        {conAfiliacion && (
          <Segmented
            aria-label={d.afiliacionLabel}
            value={filtros.afiliacion}
            onChange={(v) => onCambio({ afiliacion: v as Afiliacion })}
            options={[
              { label: d.todaAfiliacion, value: 'todas' },
              { label: d.deAgencia, value: 'agencia' },
              { label: d.independiente, value: 'independiente' },
            ]}
          />
        )}
        <Text type="secondary" style={{ marginInlineStart: 'auto' }}>
          {d.total(total, unidad[0], unidad[1])}
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
  );
}

/** Sin resultados por filtro: `Empty` simple + «Limpiar filtros», nunca la acción de crear (3.9). */
function SinResultados({ onLimpiar }: { onLimpiar: () => void }) {
  const { m } = useIdioma();
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.directorio.sinResultados}>
      <Button size="small" onClick={onLimpiar}>
        {m.comun.limpiarFiltros}
      </Button>
    </Empty>
  );
}

/** El estado de la agencia: siempre el mismo color e icono del kit para el mismo significado (GLB-R07). */
function TagEstado({ estado }: { estado: EstadoAgencia }) {
  const { m } = useIdioma();
  const e = estadoDe(ESTADO_NEGOCIO_DE_AGENCIA[estado]);
  return (
    <Tooltip title={m.directorio.estadoAgenciaAyuda[estado]}>
      <Tag color={e.color} icon={<IcoTag de={e.icono} />}>
        {m.directorio.estadoAgencia[estado]}
      </Tag>
    </Tooltip>
  );
}

/** El primero + «+N» con Popover para el resto (TBL-R17). */
function PrimeroYMas<T>({ items, render, titulo }: { items: T[]; render: (x: T) => ReactNode; titulo: string }) {
  const { token } = theme.useToken();
  if (!items.length) return <Text type="secondary">—</Text>;
  const [primero, ...resto] = items;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: token.marginXS }}>
      {render(primero!)}
      {resto.length > 0 && (
        <Popover title={titulo} content={<Pila gap="sm">{resto.map((x, i) => <div key={i}>{render(x)}</div>)}</Pila>}>
          <Tag style={{ cursor: 'pointer' }} tabIndex={0}>
            +{resto.length}
          </Tag>
        </Popover>
      )}
    </div>
  );
}

/** Dónde opera: sus agencias vigentes (links), o «Independiente». */
function CeldaAgencias({ x, agencias, onAgencia }: { x: { agencias: Membresia[] }; agencias: AgenciaDirectorio[]; onAgencia: (id: string) => void }) {
  const { m } = useIdioma();
  const vs = vigentes(x.agencias);
  if (!vs.length) return <Text>{m.directorio.independiente}</Text>;
  return (
    <PrimeroYMas
      titulo={m.directorio.todasAgencias}
      items={vs}
      render={(v) => <Typography.Link onClick={() => onAgencia(v.agenciaId)}>{nombreAgencia(agencias, v.agenciaId)}</Typography.Link>}
    />
  );
}

/* ------------------------------------------------------------------- agencias */

type FilaAgencia = AgenciaDirectorio & { nivel: number; children?: FilaAgencia[] };

interface PropsPanel {
  /** Solo si el contrato le concede `crear-agencia` a quien mira. */
  onCrear?: () => void;
  filtros: Filtros;
  onCambio: (c: Partial<Filtros>) => void;
  directorio: DirectorioCompleto;
  nav: Navegacion;
}

function PanelAgencias({ filtros, onCambio, directorio, nav, onCrear }: PropsPanel) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const c = m.directorio.col;
  const { agencias, arbol } = directorio;
  const q = sinTildes(filtros.texto.trim());
  const visibles = agencias.filter(deCompania(filtros)).filter((a) => !q || sinTildes(a.nombre).includes(q));

  /* Árbol: cada agencia cuelga de su padre si el padre también es visible; si no, queda como raíz.
     Con una búsqueda activa la lista va plana, porque el árbol escondería coincidencias plegadas. */
  const filas: FilaAgencia[] = (() => {
    const nodos = new Map<string, FilaAgencia>(visibles.map((a) => [a.id, { ...a, nivel: nivelEnArbol(arbol, a.id) }]));
    if (q) return [...nodos.values()];
    const raices: FilaAgencia[] = [];
    for (const n of nodos.values()) {
      const padre = n.parentId ? nodos.get(n.parentId) : undefined;
      if (padre) (padre.children ??= []).push(n);
      else raices.push(n);
    }
    return raices;
  })();

  const cuenta = (lista: { agencias: Membresia[]; companias?: string[] }[], agenciaId: string) =>
    lista.filter((x) => estaEnAgencia(x, agenciaId) && (!filtros.compania || !x.companias || x.companias.includes(filtros.compania))).length;
  const equipo = (id: string) => cuenta(directorio.representantes, id) + cuenta(directorio.staff, id);
  const enDownline = (id: string) => downline(directorio, id, filtros.compania).length;

  const columnas: TableColumnsType<FilaAgencia> = [
    {
      key: 'nombre',
      title: c.agencia,
      fixed: 'left',
      sorter: porNombre,
      defaultSortOrder: 'ascend',
      render: (_, a) => (
        /* inline-block: la línea secundaria queda alineada con el nombre, a la derecha de la sangría del árbol. */
        <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
          <Typography.Link onClick={() => nav.onAgencia(a.id)}>{a.nombre}</Typography.Link>
          <div>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {m.directorio.niveles[Math.min(a.nivel, 2)]}
            </Text>
          </div>
        </div>
      ),
    },
    { key: 'estado', title: c.estado, render: (_, a) => <TagEstado estado={a.estado} /> },
    // TBL-R07: con una compañía filtrada, la columna tendría el mismo valor en todas las filas.
    ...(filtros.compania
      ? []
      : [{ key: 'compania', title: m.comun.compania, render: (_: unknown, a: FilaAgencia) => a.companias.map((x) => <Tag key={x}>{marca(x)}</Tag>) }]),
    {
      key: 'agentes',
      title: c.agentes,
      align: 'right',
      sorter: (a, b) => cuenta(directorio.agentes, a.id) - cuenta(directorio.agentes, b.id),
      render: (_, a) => cuenta(directorio.agentes, a.id),
    },
    {
      key: 'downline',
      title: <Tooltip title={c.downlineAyuda}>{c.downline}</Tooltip>,
      align: 'right',
      sorter: (a, b) => enDownline(a.id) - enDownline(b.id),
      render: (_, a) => enDownline(a.id),
    },
    { key: 'equipo', title: <Tooltip title={c.equipoAyuda}>{c.equipo}</Tooltip>, align: 'right', render: (_, a) => equipo(a.id) },
    { key: 'vendedores', title: <Tooltip title={c.vendedoresAyuda}>{c.vendedores}</Tooltip>, align: 'right', render: (_, a) => cuenta(directorio.vendedores, a.id) },
  ];

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        onCambio={onCambio}
        conAfiliacion={false}
        placeholder={m.directorio.buscarAgencia}
        total={visibles.length}
        unidad={[m.directorio.agenciaUna, m.directorio.agenciaVarias]}
      />
      <Tabla<FilaAgencia>
        /* La acción de la vista va en el encabezado de la tabla, a la derecha (TBL 3.4). */
        toolbar={
          onCrear ? (
            <Button type="primary" icon={<Ico de={Plus} />} onClick={onCrear}>
              {m.directorio.form.crear}
            </Button>
          ) : undefined
        }
        /* El árbol nace plegado. Remontar al cambiar filtros vuelve a plegarlo y regresa a la página 1 (TBL-R56). */
        key={`${filtros.compania}-${q}`}
        size="middle"
        rowKey="id"
        dataSource={filas}
        columns={columnas}
        pagination={paginacion(filas.length, m)}
        locale={{ emptyText: <SinResultados onLimpiar={() => onCambio(SIN_FILTROS)} /> }}
      />
    </>
  );
}

/* --------------------------------------------------------------------- agentes */

function PanelAgentes({ filtros, onCambio, directorio, nav }: PropsPanel) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const d = m.directorio;
  const filas = directorio.agentes.filter(deCompania(filtros)).filter(coincide(filtros)).filter(deAfiliacion(filtros));

  const columnas: TableColumnsType<AgenteDirectorio> = [
    {
      key: 'nombre',
      title: m.comun.nombre,
      fixed: 'left',
      sorter: porNombre,
      defaultSortOrder: 'ascend',
      render: (_, a) => (
        <div>
          <Typography.Link onClick={() => nav.onPersona('agente', a.id)}>{a.nombre}</Typography.Link>
          {a.demo && <Tag style={{ marginInlineStart: token.marginXS }}>{m.comun.demo}</Tag>}
          {/* Lo que le falta para cobrar (H-023, H-024). */}
          {faltanCodigos(a, directorio.agencias, true).map((c) => (
            <Tag key={c} color="warning" style={{ marginInlineStart: token.marginXS }}>
              {d.form.faltaCodigo(marca(c))}
            </Tag>
          ))}
          {exigePago(a, directorio.agencias, true) && !documentosAprobados(directorio.documentosPago, 'agente', a.id) && (
            <Tag color="warning" style={{ marginInlineStart: token.marginXS }}>
              {d.documentosPago.sinAprobar}
            </Tag>
          )}
          <div>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {[d.npn(a.npn), ...otrosPapelesDeAgente(directorio, a.id).map((t) => m.papeles[t].uno)].join(' · ')}
            </Text>
          </div>
        </div>
      ),
    },
    { key: 'agencias', title: d.col.agencia, render: (_, a) => <CeldaAgencias x={a} agencias={directorio.agencias} onAgencia={nav.onAgencia} /> },
    { key: 'lob', title: d.col.lob, render: (_, a) => a.lobs.map((l) => nombreDe(directorio.baselines.lobs, l)).join(', ') || <Text type="secondary">—</Text> },
    { key: 'ffm', title: d.col.ffm, render: (_, a) => (a.certificacionFFM ? m.comun.si : m.comun.no) },
    ...(filtros.compania
      ? []
      : [{ key: 'compania', title: m.comun.compania, render: (_: unknown, a: AgenteDirectorio) => a.companias.map((x) => <Tag key={x}>{marca(x)}</Tag>) }]),
  ];

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        onCambio={onCambio}
        conAfiliacion
        placeholder={d.buscarPersona}
        total={filas.length}
        unidad={[m.papeles.agente.uno.toLowerCase(), m.papeles.agente.varios.toLowerCase()]}
      />
      <Tabla<AgenteDirectorio>
        key={`${filtros.compania}-${filtros.afiliacion}-${filtros.texto}`}
        size="middle"
        rowKey="id"
        dataSource={filas}
        columns={columnas}
        pagination={paginacion(filas.length, m)}
        locale={{ emptyText: <SinResultados onLimpiar={() => onCambio(SIN_FILTROS)} /> }}
      />
    </>
  );
}

/* ------------------------------------------------- vendedores de descuento */

function PanelVendedores({ filtros, onCambio, directorio, nav }: PropsPanel) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const d = m.directorio;
  const filas = directorio.vendedores.filter(deCompania(filtros)).filter(coincide(filtros)).filter(deAfiliacion(filtros));

  const columnas: TableColumnsType<VendedorDescuentosDirectorio> = [
    {
      key: 'nombre',
      title: m.comun.nombre,
      fixed: 'left',
      sorter: porNombre,
      defaultSortOrder: 'ascend',
      render: (_, v) => (
        <span>
          <Typography.Link onClick={() => nav.onPersona('vendedor', v.id)}>{v.nombre}</Typography.Link>
          {v.demo && <Tag style={{ marginInlineStart: token.marginXS }}>{m.comun.demo}</Tag>}
          {v.agenteId && (
            <div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {[m.papeles.agente.uno, d.npn(directorio.agentes.find((a) => a.id === v.agenteId)?.npn ?? '')].join(' · ')}
              </Text>
            </div>
          )}
        </span>
      ),
    },
    { key: 'agencias', title: d.col.agencia, render: (_, v) => <CeldaAgencias x={v} agencias={directorio.agencias} onAgencia={nav.onAgencia} /> },
    ...(filtros.compania
      ? []
      : [{ key: 'compania', title: m.comun.compania, render: (_: unknown, v: VendedorDescuentosDirectorio) => v.companias.map((x) => <Tag key={x}>{marca(x)}</Tag>) }]),
  ];

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        onCambio={onCambio}
        conAfiliacion
        placeholder={d.buscarPersona}
        total={filas.length}
        unidad={[m.papeles['vendedor-descuentos'].uno.toLowerCase(), m.papeles['vendedor-descuentos'].varios.toLowerCase()]}
      />
      <Tabla<VendedorDescuentosDirectorio>
        key={`${filtros.compania}-${filtros.afiliacion}-${filtros.texto}`}
        size="middle"
        rowKey="id"
        dataSource={filas}
        columns={columnas}
        pagination={paginacion(filas.length, m)}
        locale={{ emptyText: <SinResultados onLimpiar={() => onCambio(SIN_FILTROS)} /> }}
      />
    </>
  );
}

/* ------------------------------------------------------- benefit coordinators */

function PanelBenefitCoordinators({ filtros, onCambio, directorio, nav }: PropsPanel) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const d = m.directorio;
  const filas = directorio.benefitCoordinators.filter(deCompania(filtros)).filter(coincide(filtros));

  const columnas: TableColumnsType<BenefitCoordinatorDirectorio> = [
    {
      key: 'nombre',
      title: m.comun.nombre,
      fixed: 'left',
      sorter: porNombre,
      defaultSortOrder: 'ascend',
      render: (_, b) => (
        <span>
          <Typography.Link onClick={() => nav.onPersona('bc', b.id)}>{b.nombre}</Typography.Link>
          {b.demo && <Tag style={{ marginInlineStart: token.marginXS }}>{m.comun.demo}</Tag>}
        </span>
      ),
    },
    { key: 'centro', title: d.centroMedico, render: (_, b) => b.centroMedico ?? <Text type="secondary">—</Text> },
    ...(filtros.compania
      ? []
      : [{ key: 'compania', title: m.comun.compania, render: (_: unknown, b: BenefitCoordinatorDirectorio) => b.companias.map((x) => <Tag key={x}>{marca(x)}</Tag>) }]),
  ];

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        onCambio={onCambio}
        conAfiliacion={false}
        placeholder={d.buscarPersona}
        total={filas.length}
        unidad={[m.papeles['benefit-coordinator'].uno, m.papeles['benefit-coordinator'].varios]}
      />
      <Tabla<BenefitCoordinatorDirectorio>
        key={`${filtros.compania}-${filtros.texto}`}
        size="middle"
        rowKey="id"
        dataSource={filas}
        columns={columnas}
        pagination={paginacion(filas.length, m)}
        locale={{ emptyText: <SinResultados onLimpiar={() => onCambio(SIN_FILTROS)} /> }}
      />
    </>
  );
}

/* --------------------------------------------------- detalle de agencia (Drawer) */

export type TipoAltaAgencia = 'agente' | 'equipo' | 'vendedor' | 'subagencia';

/** Una sección de la agencia: título con su cantidad y su acción de alta a la derecha (TBL 3.4). */
function Seccion({ titulo, total, accion, children }: { titulo: string; total: number; accion?: { texto: string; onClick: () => void } | undefined; children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <section>
      <Flex justify="space-between" align="center" gap={token.marginXS} wrap style={{ marginBottom: token.marginXS }}>
        <Text strong>
          {titulo} ({total})
        </Text>
        {accion && (
          <Button size="small" icon={<Ico de={Plus} />} onClick={accion.onClick}>
            {accion.texto}
          </Button>
        )}
      </Flex>
      {children}
    </section>
  );
}

interface FilaGente {
  tipo: TipoPersona;
  id: string;
  nombre: string;
  sub: string | null;
  papel: string;
  m: Membresia;
  /** Compañías a las que les falta el payment code exigido (H-023). */
  falta?: string[];
  /** Le faltan documentos de pago aprobados (H-024). */
  docs?: boolean;
}

type PersonaPago = { agencias: Membresia[]; companias: string[]; codigoPago: { claro: string | null; atoz: string | null } };
/** ¿Se le exige payment code (y documentos de pago) a esta persona? (H-023, H-024) */
const exigePago = (p: PersonaPago, agencias: AgenciaDirectorio[], esAgente: boolean) =>
  exigeCodigoPersona(vigentes(p.agencias).map((x) => x.agenciaId), agencias, { esAgente });
/** Las compañías a las que le falta el payment code exigido a un agente o vendedor sin licencia (H-023). */
function faltanCodigos(p: PersonaPago, agencias: AgenciaDirectorio[], esAgente: boolean) {
  return exigePago(p, agencias, esAgente) ? codigosFaltantes(p.companias, p.codigoPago) : [];
}

/** El estado de los tres documentos de pago de un titular (H-024). Se aprueban en el Onboarding: aquí solo se ven. */
function DocumentosPago({ docs, titular, id, exigidos }: { docs: DocumentoPagoRegistro[]; titular: TitularPago; id: string; exigidos: boolean }) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.directorio.documentosPago;
  const lista = documentosDe(docs, titular, id);
  return (
    <Pila gap="sm">
      {exigidos && !lista.every((x) => x.estado === 'aprobado') && (
        <span>
          <Tag color="warning">{t.sinAprobar}</Tag>
        </span>
      )}
      {lista.map((x) => (
        <Flex key={x.documento} gap={token.marginXS} align="center" wrap>
          <Text style={{ minWidth: token.controlHeightLG * 3 }}>{t.nombres[x.documento]}</Text>
          <EstadoConMotivo compacto est={ESTADO_NEGOCIO_DE_DOCUMENTO[x.estado]} etiqueta={t.estados[x.estado]} motivo={x.nota ?? (x.revisado ? t.revisadoEl(x.revisado) : t.enOnboarding)} />
        </Flex>
      ))}
    </Pila>
  );
}

/**
 * La ficha de la agencia (Descriptions, en dos bloques) arriba y un solo nivel de Tabs `line` small
 * (TAB-R12, R15): «Organización» (equipo, agentes, vendedores y sub-agencias, cada sección con su alta)
 * e «Interacciones», aparte. Las tablas del Drawer son `small`, de hasta 5 columnas y sin selección
 * (TBL-R50, 3.10).
 */
function DetalleAgencia({
  agencia,
  directorio,
  interacciones,
  nav,
  onAlta,
  puedeRelaciones,
  onEditarPersona,
}: {
  agencia: AgenciaDirectorio;
  directorio: DirectorioCompleto;
  interacciones: Interaccion[];
  nav: Navegacion;
  puedeRelaciones: boolean;
  /** Solo si el contrato le concede las altas a quien mira. */
  onAlta?: ((tipo: TipoAltaAgencia) => void) | undefined;
  /** Editar o quitar a un miembro (H-020). Sin permiso no llega y no hay acciones por fila. */
  onEditarPersona?: (tipo: TipoMiembro, id: string) => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const d = m.directorio;
  const da = d.datosAgencia;
  const { agencias, arbol } = directorio;
  const nivel = nivelEnArbol(arbol, agencia.id);
  const hijas = agencias.filter((a) => a.parentId === agencia.id).sort(porNombre);
  const cobra = agencia.cobraAgenteId ? directorio.agentes.find((a) => a.id === agencia.cobraAgenteId) : undefined;
  const masterAgencia = masterDe(directorio.agencias, agencia.id);
  const pagoAgencia = pagoDeAgencia(!agencia.parentId, nivelesDe(masterAgencia));
  const nivelPago = (x: string | null) => (x === 'agencia' ? d.form.aAgencia : x === 'subagencia' ? d.form.aSubagencia : x === 'agente' ? d.form.aAgente : null);
  const npnDe = (agenteId: string | null) => (agenteId ? (directorio.agentes.find((a) => a.id === agenteId)?.npn ?? null) : null);

  const representantes: FilaGente[] = directorio.representantes
    .filter((r) => estaEnAgencia(r, agencia.id))
    .map((r) => {
      const npn = npnDe(r.agenteId);
      return { tipo: 'representante', id: r.id, nombre: r.nombre, sub: npn ? d.npn(npn) : null, papel: m.papeles.representante.uno, m: membresiaEn(r, agencia.id)! };
    });
  const staff: FilaGente[] = directorio.staff
    .filter((s) => estaEnAgencia(s, agencia.id))
    .map((s) => ({ tipo: 'staff', id: s.id, nombre: s.nombre, sub: s.puesto, papel: m.papeles.staff.uno, m: membresiaEn(s, agencia.id)! }));
  const agentes: FilaGente[] = directorio.agentes
    .filter((a) => estaEnAgencia(a, agencia.id))
    .map((a) => ({ tipo: 'agente', id: a.id, nombre: a.nombre, sub: d.npn(a.npn), papel: m.papeles.agente.uno, m: membresiaEn(a, agencia.id)!, falta: faltanCodigos(a, directorio.agencias, true), docs: exigePago(a, directorio.agencias, true) && !documentosAprobados(directorio.documentosPago, 'agente', a.id) }));
  const vendedores: FilaGente[] = directorio.vendedores
    .filter((v) => estaEnAgencia(v, agencia.id))
    .map((v) => ({ tipo: 'vendedor', id: v.id, nombre: v.nombre, sub: null, papel: m.papeles['vendedor-descuentos'].uno, m: membresiaEn(v, agencia.id)!, falta: v.agenteId ? [] : faltanCodigos(v, directorio.agencias, false), docs: !v.agenteId && exigePago(v, directorio.agencias, false) && !documentosAprobados(directorio.documentosPago, 'vendedor', v.id) }));

  const ejecutar = useEjecutar();
  const columnasGente = (conPapel: boolean): TableColumnsType<FilaGente> => [
    {
      key: 'nombre',
      title: m.comun.nombre,
      render: (_, g) => (
        <div>
          <Typography.Link onClick={() => nav.onPersona(g.tipo, g.id)}>{g.nombre}</Typography.Link>
          {g.falta?.map((c) => (
            <Tag key={c} color="warning" style={{ marginInlineStart: token.marginXS }}>
              {d.form.faltaCodigo(marca(c))}
            </Tag>
          ))}
          {g.docs && (
            <Tag color="warning" style={{ marginInlineStart: token.marginXS }}>
              {d.documentosPago.sinAprobar}
            </Tag>
          )}
          {g.sub && (
            <div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {g.sub}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    ...(conPapel ? [{ key: 'papel', title: d.col.papel, render: (_: unknown, g: FilaGente) => g.papel }] : []),
    { key: 'desde', title: m.comun.desde, render: (_, g) => g.m.desde },
    ...(onEditarPersona
      ? [
          {
            key: 'acciones',
            title: '',
            align: 'right' as const,
            render: (_: unknown, g: FilaGente) => {
              const tipo = g.tipo as TipoMiembro;
              return (
                <Space size={0}>
                  <Button type="link" size="small" aria-label={`${d.miembros.editar} ${g.nombre}`} onClick={() => onEditarPersona(tipo, g.id)}>
                    {d.miembros.editar}
                  </Button>
                  <Popconfirm
                    title={d.miembros.quitarPregunta(g.nombre, agencia.nombre)}
                    description={d.miembros.quitarNota}
                    okText={d.miembros.quitar}
                    cancelText={m.comun.cancelar}
                    onConfirm={() => ejecutar('quitar-de-agencia', { tipo, personaId: g.id, agenciaId: agencia.id })}
                  >
                    <Button type="link" size="small" danger aria-label={`${d.miembros.quitar} ${g.nombre}`}>
                      {d.miembros.quitar}
                    </Button>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]
      : []),
  ];

  const tablaGente = (filas: FilaGente[], vacio: string, conPapel = false) => (
    <Tabla<FilaGente>
      size="small"
      rowKey={(g) => `${g.tipo}-${g.id}`}
      dataSource={[...filas].sort(porNombre)}
      columns={columnasGente(conPapel)}
      pagination={filas.length > 5 ? { simple: true, pageSize: 5 } : false}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={vacio} /> }}
    />
  );

  const sinDato = <Text type="secondary">—</Text>;

  const r = d.relaciones;
  const direccion = [agencia.calle, agencia.ciudad, [agencia.estadoUS, agencia.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <Pila>
      <EtiquetasAgencia agencia={agencia} puede={puedeRelaciones} />
      <Descriptions
        title={da.identificacion}
        column={1}
        size="small"
        items={[
          { key: 'estado', label: da.estado, children: <TagEstado estado={agencia.estado} /> },
          { key: 'nivel', label: d.ficha.nivel, children: m.directorio.niveles[Math.min(nivel, 2)] },
          // Una agencia raíz (Master Agency) no reporta a nadie: el campo ni aparece.
          ...(agencia.parentId
            ? [
                {
                  key: 'reporta',
                  label: d.ficha.reportaA,
                  children: (
                    <Typography.Link onClick={() => nav.onAgencia(agencia.parentId!)}>{nombreAgencia(agencias, agencia.parentId)}</Typography.Link>
                  ),
                },
              ]
            : []),
          {
            key: 'representante',
            label: representantes.length > 1 ? d.ficha.representantes : d.ficha.representante,
            children: representantes.length ? (
              <Space size={token.marginXS} wrap>
                {representantes.map((r) => (
                  <Typography.Link key={r.id} onClick={() => nav.onPersona('representante', r.id)}>
                    {r.nombre}
                  </Typography.Link>
                ))}
              </Space>
            ) : (
              <Text type="secondary">{d.ficha.sinRepresentante}</Text>
            ),
          },
          { key: 'npn', label: da.npn, children: agencia.npn ?? sinDato },
          { key: 'ein', label: da.ein, children: agencia.taxId ?? sinDato },
          { key: 'telefono', label: da.telefono, children: agencia.telefono ?? sinDato },
          { key: 'direccion', label: r.direccion, children: direccion || sinDato },
          { key: 'compania', label: r.companias, children: <CompaniasAgencia agencia={agencia} puede={puedeRelaciones} /> },
        ]}
      />
      <Descriptions
        title={da.operacion}
        column={1}
        size="small"
        items={[
          { key: 'inicio', label: da.inicio, children: agencia.inicio ?? sinDato },
          { key: 'lobs', label: r.lobs, children: <LobsAgencia agencia={agencia} opciones={directorio.baselines.lobs} puede={puedeRelaciones} /> },
          {
            key: 'portal',
            label: da.portal,
            children: agencia.agentesUsanPortal === null ? sinDato : agencia.agentesUsanPortal ? m.comun.si : m.comun.no,
          },
          { key: 'comunicaciones', label: da.comunicaciones, children: agencia.alcanceComunicaciones ? d.comunicaciones[agencia.alcanceComunicaciones] : sinDato },
          { key: 'reportes', label: da.reportes, children: agencia.alcanceReportes ? d.reportes[agencia.alcanceReportes] : sinDato },
          { key: 'downline', label: d.ficha.downline, children: downline(directorio, agencia.id).length },
        ]}
      />
      <Descriptions
        title={d.form.enLinea}
        column={1}
        size="small"
        items={[
          { key: 'web', label: d.form.web, children: agencia.web ? <Typography.Link href={agencia.web} target="_blank" rel="noopener noreferrer">{agencia.web}</Typography.Link> : sinDato },
          { key: 'linkedin', label: d.form.linkedin, children: agencia.linkedin ? <Typography.Link href={agencia.linkedin} target="_blank" rel="noopener noreferrer">{agencia.linkedin}</Typography.Link> : sinDato },
          {
            key: 'redes',
            label: d.form.redes,
            children: agencia.redes.length ? (
              <Space orientation="vertical" size={0}>
                {agencia.redes.map((r) => (
                  <Typography.Link key={r} href={r} target="_blank" rel="noopener noreferrer">
                    {r}
                  </Typography.Link>
                ))}
              </Space>
            ) : (
              sinDato
            ),
          },
        ]}
      />
      <Descriptions
        title={d.form.pagos}
        column={1}
        size="small"
        items={[
          // A quién se paga: lo define la Master Agency y su jerarquía lo hereda (H-023).
          {
            key: 'comision',
            label: d.form.comisionPagadaA,
            children: (
              <span>
                {nivelPago(masterAgencia?.comisionPagadaA ?? null) ?? sinDato}
                {agencia.parentId && <Cap style={{ display: 'block' }}>{d.form.heredaDe(masterAgencia?.nombre ?? '')}</Cap>}
              </span>
            ),
          },
          { key: 'bono', label: d.form.bonoPagadoA, children: nivelPago(masterAgencia?.bonoPagadoA ?? null) ?? sinDato },
          // Contact payee y payment codes: solo si en esta jerarquía la agencia cobra.
          ...(pagoAgencia.lleva
            ? [
                {
                  key: 'cobra',
                  label: da.cobra,
                  children: cobra ? (
                    <Typography.Link onClick={() => nav.onPersona('agente', cobra.id)}>
                      {cobra.nombre} · {d.npn(cobra.npn)}
                    </Typography.Link>
                  ) : pagoAgencia.obligatorio ? (
                    <Tag color="warning">{d.form.faltaPayee}</Tag>
                  ) : (
                    sinDato
                  ),
                },
                ...agencia.companias.map((c) => {
                  const codigo = c === 'atoz' ? agencia.codigoPago.atoz : agencia.codigoPago.claro;
                  return {
                    key: `pago-${c}`,
                    label: d.form.codigoPago(marca(c)),
                    children: codigo ?? (pagoAgencia.obligatorio ? <Tag color="warning">{d.form.faltaCodigo(marca(c))}</Tag> : sinDato),
                  };
                }),
                {
                  key: 'documentos',
                  label: d.documentosPago.titulo,
                  children: <DocumentosPago docs={directorio.documentosPago} titular="agencia" id={agencia.id} exigidos={pagoAgencia.obligatorio} />,
                },
              ]
            : []),
          { key: 'tipo', label: d.form.tipoComision, children: agencia.tipoComision ? nombreDe(directorio.baselines.tiposComision, agencia.tipoComision) : sinDato },
          { key: 'legacy', label: d.form.legacy, children: agencia.legacy ? m.comun.si : m.comun.no },
        ]}
      />
      {agencia.legacy && <NegociacionesLegacy agencia={agencia} opcionesLob={directorio.baselines.lobs} puede={puedeRelaciones} />}
      {/* Un solo nivel de pestañas en el Drawer (TAB-R15): la gente de la agencia y sus interacciones,
          separadas. La ficha de arriba es común a las dos (TAB-R12). */}
      <Tabs
        size="small"
        defaultActiveKey="organizacion"
        items={[
          {
            key: 'organizacion',
            label: d.alta.organizacion,
            children: (
              <Pila>
                <Seccion titulo={d.tabsAgencia.equipo} total={representantes.length + staff.length} accion={onAlta && { texto: d.alta.agregarEquipo, onClick: () => onAlta('equipo') }}>
                  {tablaGente([...representantes, ...staff], d.vacios.equipo, true)}
                </Seccion>
                <Seccion titulo={d.tabsAgencia.agentes} total={agentes.length} accion={onAlta && { texto: d.alta.agregarAgente, onClick: () => onAlta('agente') }}>
                  {tablaGente(agentes, d.vacios.agentes)}
                </Seccion>
                <Seccion titulo={d.tabsAgencia.vendedores} total={vendedores.length} accion={onAlta && { texto: d.alta.agregarVendedor, onClick: () => onAlta('vendedor') }}>
                  {tablaGente(vendedores, d.vacios.vendedores)}
                </Seccion>
                <Seccion titulo={d.tabsAgencia.sub} total={hijas.length} accion={onAlta && { texto: d.alta.crearSubagencia, onClick: () => onAlta('subagencia') }}>
                  <Tabla<AgenciaDirectorio>
                    size="small"
                    rowKey="id"
                    dataSource={hijas}
                    pagination={false}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={d.vacios.sub} /> }}
                    columns={[
                      { key: 'nombre', title: d.col.agencia, render: (_, a) => <Typography.Link onClick={() => nav.onAgencia(a.id)}>{a.nombre}</Typography.Link> },
                      { key: 'estado', title: d.col.estado, render: (_, a) => <TagEstado estado={a.estado} /> },
                      { key: 'downline', title: d.col.downline, align: 'right', render: (_, a) => downline(directorio, a.id).length },
                      { key: 'sub', title: d.tabsAgencia.sub, align: 'right', render: (_, a) => agenciaYDescendientes(arbol, a.id).size - 1 },
                    ]}
                  />
                </Seccion>
              </Pila>
            ),
          },
          { key: 'equipo-claro', label: r.equipoClaro, children: <PanelEquipoClaro agencia={agencia} directorio={directorio} puede={puedeRelaciones} /> },
          {
            key: 'interacciones',
            label: d.interacciones.tab,
            children: (
              <PanelInteracciones
                agencia={agencia}
                directorio={directorio}
                interacciones={interacciones}
                onAgencia={nav.onAgencia}
                onAgente={(id) => nav.onPersona('agente', id)}
              />
            ),
          },
        ]}
      />
    </Pila>
  );
}

/* --------------------------------------------------- detalle de persona (Drawer) */

function DetallePersona({ tipo, id, directorio, nav }: { tipo: TipoPersona; id: string; directorio: DirectorioCompleto; nav: Navegacion }) {
  const { m } = useIdioma();
  const d = m.directorio;
  const sinDato = <Text type="secondary">—</Text>;
  const agenteDe = (agenteId: string | null) => (agenteId ? directorio.agentes.find((a) => a.id === agenteId) : undefined);

  let items: { key: string; label: string; children: ReactNode }[] = [];
  /** Sus payment codes, uno por compañía en que produce; si alguno es exigido y falta, se avisa (H-023). */
  const codigosDe = (p: PersonaPago & { id: string }, titular: TitularPago) => {
    const esAgente = titular === 'agente';
    const falta = faltanCodigos(p, directorio.agencias, esAgente);
    return [
      ...p.companias.map((c) => ({
        key: `pago-${c}`,
        label: d.form.codigoPago(marca(c)),
        children: (c === 'atoz' ? p.codigoPago.atoz : p.codigoPago.claro) ?? (falta.includes(c) ? <Tag color="warning">{d.form.faltaCodigo(marca(c))}</Tag> : sinDato),
      })),
      {
        key: 'documentos',
        label: d.documentosPago.titulo,
        children: <DocumentosPago docs={directorio.documentosPago} titular={titular} id={p.id} exigidos={exigePago(p, directorio.agencias, esAgente)} />,
      },
    ];
  };
  let membresias: Membresia[] | null = null;

  if (tipo === 'agente') {
    const a = directorio.agentes.find((x) => x.id === id);
    if (!a) return null;
    const otros = otrosPapelesDeAgente(directorio, a.id);
    items = [
      { key: 'npn', label: d.persona.npn, children: a.npn },
      { key: 'papeles', label: d.persona.papeles, children: [m.papeles.agente.uno, ...otros.map((t) => m.papeles[t].uno)].join(' · ') },
      { key: 'lob', label: d.persona.lobs, children: a.lobs.map((l) => nombreDe(directorio.baselines.lobs, l)).join(', ') || sinDato },
      { key: 'ffm', label: d.persona.ffm, children: a.certificacionFFM ? m.comun.si : m.comun.no },
      { key: 'compania', label: m.comun.compania, children: a.companias.map(nombreCompania).join(' · ') },
      ...codigosDe(a, 'agente'),
      { key: 'correo', label: d.correo, children: a.email ?? sinDato },
      { key: 'telefono', label: d.telefono, children: a.telefono ?? sinDato },
      ...(a.nota ? [{ key: 'nota', label: d.persona.nota, children: a.nota }] : []),
    ];
    membresias = a.agencias;
  } else if (tipo === 'representante' || tipo === 'vendedor') {
    const lista: { id: string; agenteId: string | null; email: string | null; telefono: string | null; agencias: Membresia[] }[] =
      tipo === 'representante' ? directorio.representantes : directorio.vendedores;
    const p = lista.find((x) => x.id === id);
    if (!p) return null;
    const agente = agenteDe(p.agenteId);
    const propio = tipo === 'representante' ? m.papeles.representante.uno : m.papeles['vendedor-descuentos'].uno;
    items = [
      { key: 'papel', label: d.persona.papeles, children: [propio, ...(agente ? [m.papeles.agente.uno] : [])].join(' · ') },
      {
        key: 'npn',
        label: d.persona.npn,
        children: agente ? (
          <Typography.Link onClick={() => nav.onPersona('agente', agente.id)}>{agente.npn}</Typography.Link>
        ) : (
          <Text type="secondary">{d.persona.noLicenciada}</Text>
        ),
      },
      // El vendedor sin licencia lleva su payment code; el representante no (H-023).
      ...(tipo === 'vendedor' && !agente ? codigosDe(directorio.vendedores.find((v) => v.id === id)!, 'vendedor') : []),
      { key: 'correo', label: d.correo, children: p.email ?? sinDato },
      { key: 'telefono', label: d.telefono, children: p.telefono ?? sinDato },
    ];
    membresias = p.agencias;
  } else if (tipo === 'staff') {
    const s = directorio.staff.find((x) => x.id === id);
    if (!s) return null;
    items = [
      { key: 'papel', label: d.persona.papeles, children: m.papeles.staff.uno },
      { key: 'puesto', label: d.puesto, children: s.puesto ?? sinDato },
      { key: 'correo', label: d.correo, children: s.email ?? sinDato },
      { key: 'telefono', label: d.telefono, children: s.telefono ?? sinDato },
    ];
    membresias = s.agencias;
  } else {
    const b = directorio.benefitCoordinators.find((x) => x.id === id);
    if (!b) return null;
    items = [
      { key: 'papel', label: d.persona.papeles, children: m.papeles['benefit-coordinator'].uno },
      { key: 'centro', label: d.centroMedico, children: b.centroMedico ?? sinDato },
      { key: 'correo', label: d.correo, children: b.email ?? sinDato },
      { key: 'telefono', label: d.telefono, children: b.telefono ?? sinDato },
      { key: 'compania', label: m.comun.compania, children: b.companias.map(nombreCompania).join(' · ') },
    ];
  }

  const columnas: TableColumnsType<Membresia> = [
    {
      key: 'agencia',
      title: d.col.agencia,
      render: (_, x) => <Typography.Link onClick={() => nav.onAgencia(x.agenciaId)}>{nombreAgencia(directorio.agencias, x.agenciaId)}</Typography.Link>,
    },
    { key: 'desde', title: m.comun.desde, render: (_, x) => x.desde },
    { key: 'hasta', title: m.comun.hasta, render: (_, x) => x.hasta ?? sinDato },
  ];

  return (
    <Pila>
      <Descriptions column={1} size="small" items={items} />
      {membresias && (
        <>
          <Text strong>{d.agenciasTitulo}</Text>
          {membresias.length === 0 ? (
            <Cap>{d.independienteNota}</Cap>
          ) : (
            <Tabla<Membresia>
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={[...membresias].sort((a, b) => Number(a.hasta !== null) - Number(b.hasta !== null) || b.desde.localeCompare(a.desde))}
              columns={columnas}
            />
          )}
        </>
      )}
    </Pila>
  );
}

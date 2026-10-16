'use client';
/**
 * Gestión de Roles y Permisos. Portada de PB-002 (`vistas/roles.tsx`).
 *
 * Es el único módulo con contrato ejecutable (`../contrato.ts`): toda escritura pasa por
 * `CAPACIDAD.ejecutar` —ahora en el servidor— y deja evento con actor, canal, regla y procedencia.
 *
 * Cambios contra el prototipo, y por qué:
 * - `ejecutar` es asíncrono: el contrato corre en el servidor y persiste en PostgreSQL.
 * - «Crear usuario» pide el correo corporativo (H-001): sin él la persona no puede iniciar sesión.
 * - Las medidas salen de `theme.useToken()` (regla dura 1 del kit).
 * - El detalle de cada persona tiene un solo punto de edición (`DetalleUsuario`, H-034).
 */
import type { AreaOpcion, CargoOpcion } from '@/dominio/baselines';
import { areasPrincipales, perfilDeCargos } from '@/dominio/areas';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { App, Button, Card, Drawer, Input, Statistic, Tabs, Tag, Typography, theme } from 'antd';
import { SlidersHorizontal, Trash2, UserPlus } from 'lucide-react';
import { aplica, camposDeArea, valorDe } from '@/dominio/camposArea';
import type { CampoArea, CatalogosCampos, ValorCampoArea } from '@/dominio/camposArea';
import type { EjecutarCamposArea } from '../useCamposArea';
import { ConfigurarCamposArea, EstadoDatosArea, valorVisible } from './CamposArea';
import { DetalleUsuario, ListaPermisos, ResumenCargos, SelectorCargos, areaDe, nombresDeRoles } from './DetalleUsuario';
import { permisosDe } from '@/dominio/permisos';
import { asignacionesActivas, rolPorId } from '@arc2-0/claro-one-kit/dominio';
import type { EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';
import { AccionConConsecuencia, Cap } from '@arc2-0/claro-one-kit';
import { Campo, Cifras, Ico, Pila, Tabla } from '@arc2-0/claro-one-kit';
import { actorPara } from '@/dominio/actor';
import { actorVisible, nombreRol, rolesProducto } from '@/dominio/roles';
import { useIdioma } from '@/i18n/cliente';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { CAPACIDAD_BAJA } from '../contrato-baja';

const { Text } = Typography;

export interface EstadoRolesConCorreo {
  empleados: EmpleadoConCorreo[];
  eventos: Evento[];
}

type Ejecutar = (accionId: string, entrada: EntradaAccion) => Promise<{ ok: true; evento: Evento } | { ok: false; motivo: string }>;

/* --------------------------------------------------------------- pantalla */

const NUEVO_INICIAL = { nombre: '', email: '', cargos: [] as string[] };


export function PantallaRolesPermisos({
  estado,
  ejecutar,
  eliminar,
  empleadoActual,
  dominioCorreo,
  cargos,
  areas,
  puedeEliminar,
  campos,
  valores,
  puedeCampos,
  ejecutarCampos,
  catalogos,
  editar,
  definirPermisos,
}: {
  estado: EstadoRolesConCorreo;
  ejecutar: Ejecutar;
  eliminar: (empleadoId: string) => Promise<{ ok: true } | { ok: false; motivo: string }>;
  empleadoActual: EmpleadoConCorreo;
  dominioCorreo: string;
  /** Los cargos y las áreas vigentes de Configuración › Datos base (H-018). */
  cargos: CargoOpcion[];
  areas: AreaOpcion[];
  /** Solo un Administrador ve «Eliminar» (lo decide el contrato `baja-de-usuarios`). */
  puedeEliminar: boolean;
  /** Campos por área (H-027): los vigentes de todas las áreas y los valores vigentes de los usuarios. */
  campos: CampoArea[];
  valores: ValorCampoArea[];
  /** Configurar campos y llenar datos: Administrador, nunca en «Ver como». */
  puedeCampos: boolean;
  ejecutarCampos: EjecutarCamposArea;
  /** Las opciones de Datos base que usan las listas de los campos por área. */
  catalogos: CatalogosCampos;
  /** «Editar usuario» (H-030): mismo permiso que los campos por área. */
  editar: (entrada: EntradaAccion) => Promise<{ ok: true } | { ok: false; motivo: string }>;
  /** «Definir permisos» (H-032): los de Leads, por persona. */
  definirPermisos: (empleadoId: string, permisos: string[]) => Promise<{ ok: boolean; motivo?: string }>;
}) {
  const { token } = theme.useToken();
  const { idioma, m } = useIdioma();
  const t = m.rolesPermisos;
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const { message } = App.useApp();
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_INICIAL);
  /** Sus cargos deciden su área y los roles con los que nace (H-038). */
  const perfilNuevo = perfilDeCargos(nuevo.cargos, cargos, areas);
  const [directosNuevos, setDirectosNuevos] = useState<string[]>([]);
  const permisosNuevos = permisosDe(directosNuevos);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [porEliminar, setPorEliminar] = useState<EmpleadoConCorreo | null>(null);
  const accionEliminar = CAPACIDAD_BAJA.acciones['eliminar-usuario'];
  const [configurando, setConfigurando] = useState(false);
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  // Un subgrupo por área principal (H-038): las de Datos base y, si alguien tiene otra (Plataforma), esa también. Quien
  // tiene cargos en dos áreas sale en las dos. El activo vive en la URL.
  const raices = new Map(estado.empleados.map((e) => [e.id, areasPrincipales(e, { cargos, areas })]));
  const raicesDe = (e: EmpleadoConCorreo) => raices.get(e.id) ?? [];
  const codigosArea = [...new Set([...areas.filter((a) => !a.padre).map((a) => a.codigo), ...estado.empleados.flatMap(raicesDe)])];
  const areaUrl = params.get('area');
  const area = areaUrl && codigosArea.includes(areaUrl) ? areaUrl : null;
  const filas = area ? estado.empleados.filter((e) => raicesDe(e).includes(area)) : estado.empleados;
  const camposActivos = area ? camposDeArea(campos, area) : [];
  const conCampos = (e: EmpleadoConCorreo) => raicesDe(e).some((r) => camposDeArea(campos, r).length > 0);
  const nombreCargo = (c: string) => cargos.find((x) => x.codigo === c)?.nombre ?? c;
  /** «Commercial › Growth»: el área principal y, si la hay, la sub-área de sus cargos. */
  const ubicacion = (e: EmpleadoConCorreo) => {
    const p = perfilDeCargos(e.cargos, cargos, areas);
    if (!p.unidades.length) return areaDe(areas, e.areaId);
    return p.unidades.map((u) => {
      const padre = areas.find((a) => a.codigo === u)?.padre;
      return padre ? `${areaDe(areas, padre)} › ${areaDe(areas, u)}` : areaDe(areas, u);
    }).join(', ');
  };

  /** «Doer, Coordinator»: lo dan sus cargos; si no tiene cargos del catálogo, sus asignaciones vigentes. */
  const rolesDe = (e: EmpleadoConCorreo) => {
    const p = perfilDeCargos(e.cargos, cargos, areas);
    return nombresDeRoles(p.roles.length ? p.roles.map((r) => r.rolId) : asignacionesActivas(e).map((a) => a.rolId), idioma);
  };

  async function confirmarEliminar() {
    if (!porEliminar) return;
    setConfirmando(true);
    const r = await eliminar(porEliminar.id);
    setConfirmando(false);
    setPorEliminar(null);
    if (!r.ok) message.error(r.motivo);
    else if (seleccionadoId === porEliminar.id) setSeleccionadoId(null);
  }

  const emp = estado.empleados.find((e) => e.id === seleccionadoId);

  /** Crea a la persona y le asigna sus roles: cada paso pasa por su acción del contrato y deja su evento. */
  async function crearConRoles() {
    setGuardando(true);
    // El servidor deriva el cargo y el área de los cargos; el navegador solo los manda.
    const r = await ejecutar('crear-usuario', { nombre: nuevo.nombre, email: nuevo.email, cargos: nuevo.cargos.join('|'), puesto: nuevo.cargos[0] ?? '', areaId: perfilNuevo.principal ?? '' });
    if (r.ok) {
      const id = r.evento.cambios[0]?.id;
      for (const a of id ? perfilNuevo.asignaciones : []) await ejecutar('asignar-rol', { empleadoId: id, ...a });
      if (id && directosNuevos.length) await definirPermisos(id, directosNuevos);
      setNuevo(NUEVO_INICIAL);
      setDirectosNuevos([]);
      setCreando(false);
    } else message.error(r.motivo);
    setGuardando(false);
  }

  const nuevoCompleto = !!(nuevo.nombre && nuevo.email && nuevo.cargos.length);

  return (
    <div>
      <Card>
        <Cifras>
          <Statistic title={t.usuarios} value={estado.empleados.length} />
          <Statistic title={t.asignacionesActivas} value={estado.empleados.reduce((n, e) => n + asignacionesActivas(e).length, 0)} />
          <Statistic title={t.rolesFijo} value={rolesProducto(idioma).length} />
        </Cifras>
      </Card>


      <div style={{ marginTop: token.marginLG }}>
        <Tabs
          activeKey={area ?? 'todas'}
          onChange={(k) => router.replace(k === 'todas' ? ruta : `${ruta}?area=${encodeURIComponent(k)}`, { scroll: false })}
          items={[
            { key: 'todas', label: `${t.todas} (${estado.empleados.length})` },
            ...codigosArea.map((c) => ({ key: c, label: `${areaDe(areas, c)} (${estado.empleados.filter((e) => raicesDe(e).includes(c)).length})` })),
          ]}
        />
        <Tabla<EmpleadoConCorreo>
          titulo={area ? areaDe(areas, area) : t.usuariosPlataforma}
          toolbar={
            <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap' }}>
              {area && (
                <Button icon={<Ico de={SlidersHorizontal} />} onClick={() => setConfigurando(true)}>
                  {t.camposArea.boton(camposActivos.length)}
                </Button>
              )}
              <Button
                type="primary"
                icon={<Ico de={UserPlus} />}
                onClick={() => {
                  setCreando(true);
                }}
              >
                {t.crearUsuario}
              </Button>
            </div>
          }
          rowKey="id"
          scroll={{ x: 'max-content' }}
          dataSource={filas}
          onRow={(e) => ({ onClick: () => setSeleccionadoId(e.id), style: { cursor: 'pointer' } })}
          columns={[
            {
              key: 'nombre',
              dataIndex: 'nombre',
              title: m.comun.nombre,
              // Click en la persona = su detalle (sin botón «Ver perfil»).
              render: (v: string, e: EmpleadoConCorreo) => (
                <span>
                  <Typography.Link strong onClick={() => setSeleccionadoId(e.id)}>
                    {v}
                  </Typography.Link>
                  {e.ficticio && <Tag style={{ marginInlineStart: token.marginXS }}>{m.comun.demo}</Tag>}
                </span>
              ),
            },
            { key: 'email', title: t.correo, render: (_: unknown, e: EmpleadoConCorreo) => e.email ?? <Text type="secondary">—</Text> },
            { key: 'cargo', title: t.cargos, render: (_: unknown, e: EmpleadoConCorreo) => (e.cargos.length ? e.cargos : [e.puesto]).map(nombreCargo).join(', ') },
            { key: 'rol', title: t.rol, render: (_: unknown, e: EmpleadoConCorreo) => rolesDe(e).join(', ') || <Text type="secondary">—</Text> },
            { key: 'area', title: t.area, render: (_: unknown, e: EmpleadoConCorreo) => ubicacion(e) },
            ...camposActivos.map((c) => ({
              key: `campo-${c.id}`,
              title: c.etiqueta,
              // A quien no se le pide el campo (H-040), una raya.
              render: (_: unknown, e: EmpleadoConCorreo) =>
                aplica(c, perfilDeCargos(e.cargos, cargos, areas).roles, (id) => valorDe(valores, e.id, id)) ? valorVisible(c, valorDe(valores, e.id, c.id), t.camposArea, catalogos) : <Text type="secondary">—</Text>,
            })),
            ...(campos.length
              ? [
                  {
                    key: 'datos-area',
                    title: t.camposArea.columna,
                    render: (_: unknown, e: EmpleadoConCorreo) =>
                      conCampos(e) ? <EstadoDatosArea campos={campos} valores={valores} empleadoId={e.id} areas={raicesDe(e)} roles={perfilDeCargos(e.cargos, cargos, areas).roles} /> : null,
                  },
                ]
              : []),
            {
              key: 'roles',
              title: t.rolesActivos,
              render: (_: unknown, e: EmpleadoConCorreo) =>
                asignacionesActivas(e).length ? (
                  asignacionesActivas(e).map((a) => (
                    <Tag key={a.id} color={rolPorId(a.rolId)?.color}>
                      {nombreRol(a.rolId, idioma)}
                    </Tag>
                  ))
                ) : (
                  <Tag>{t.sinAsignar}</Tag>
                ),
            },
            {
              key: 'acc',
              title: '',
              align: 'right' as const,
              render: (_: unknown, e: EmpleadoConCorreo) => (
                <>
                  {/* Nadie se elimina a sí mismo: ni siquiera se ofrece (el contrato también lo rechaza). */}
                  {puedeEliminar && e.id !== empleadoActual.id && (
                    <Button
                      type="link"
                      danger
                      icon={<Ico de={Trash2} />}
                      aria-label={`${t.eliminar} ${e.nombre}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setPorEliminar(e);
                      }}
                    >
                      {t.eliminar}
                    </Button>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>

      {emp && (
        <DetalleUsuario
          key={emp.id}
          empleado={emp}
          eventos={estado.eventos}
          cargos={cargos}
          areas={areas}
          campos={campos}
          valores={valores}
          catalogos={catalogos}
          dominioCorreo={dominioCorreo}
          puede={puedeCampos}
          ejecutar={ejecutar}
          editar={editar}
          ejecutarCampos={ejecutarCampos}
          definirPermisos={definirPermisos}
          onCerrar={() => setSeleccionadoId(null)}
        />
      )}

      <Drawer
        open={creando}
        title={t.crearUsuario}
        size={token.controlHeightLG * 16}
        onClose={() => setCreando(false)}
        footer={
          <div style={{ display: 'flex', gap: token.marginXS, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreando(false)}>{m.comun.cancelar}</Button>
            <Button
              type="primary"
              disabled={!nuevoCompleto}
              loading={guardando}
              onClick={crearConRoles}
            >
              {t.crearUsuario}
            </Button>
          </div>
        }
      >
        <Pila>
          <Campo label={m.comun.nombre}>
            <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          </Campo>
          <Campo label={t.correoCorporativo}>
            <Input
              type="email"
              value={nuevo.email}
              placeholder={t.placeholderCorreo(dominioCorreo)}
              onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
            />
          </Campo>
          <Campo label={t.cargos}>
            <SelectorCargos cargos={cargos} valor={nuevo.cargos} onCambio={(v) => setNuevo({ ...nuevo, cargos: v })} />
          </Campo>
          <Cap>{t.cargosAyuda}</Cap>
          <ResumenCargos perfil={perfilNuevo} areas={areas} />
          <ListaPermisos permisos={permisosNuevos} directos={directosNuevos} onDirectos={setDirectosNuevos} />
        </Pila>
      </Drawer>

      {area && (
        <ConfigurarCamposArea
          abierto={configurando}
          area={area}
          areaNombre={areaDe(areas, area)}
          campos={campos}
          subareas={areas.filter((a) => a.padre === area)}
          puede={puedeCampos && areas.some((a) => a.codigo === area)}
          ejecutar={ejecutarCampos}
          onCerrar={() => setConfigurando(false)}
        />
      )}

      <AccionConConsecuencia
        abierta={!!porEliminar}
        accion={accionEliminar}
        actor={porEliminar ? actorVisible(actorPara(empleadoActual, accionEliminar), idioma) : null}
        impacto={porEliminar ? t.eliminarImpacto(porEliminar.nombre) : undefined}
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
        okText={confirmando ? t.guardando : t.eliminar}
      />
    </div>
  );
}

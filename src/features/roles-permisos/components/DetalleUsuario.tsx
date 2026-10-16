'use client';
/**
 * El detalle de un usuario de la plataforma (Drawer) y las piezas que comparte con «Crear usuario»: el selector de
 * cargos, lo que dan los cargos (área, sub-área y roles) y la lista de permisos.
 *
 * Los cargos mandan (H-038): de ellos salen el área, la sub-área y los roles de la persona, cada rol con su alcance.
 * Nada de eso se elige a mano.
 */
import { useState } from 'react';
import { Alert, Button, Checkbox, Descriptions, Drawer, Form, Input, Select, Space, Tag, Typography, theme } from 'antd';
import { Check, Pencil } from 'lucide-react';
import { asignacionesActivas, nombreArea, rolPorId } from '@arc2-0/claro-one-kit/dominio';
import type { EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';
import { Cap, Ico } from '@arc2-0/claro-one-kit';
import { RastroDeEventos } from '@/components/RastroDeEventos';
import { areasPrincipales, perfilDeCargos } from '@/dominio/areas';
import type { PerfilDeCargos } from '@/dominio/areas';
import { nombreDe } from '@/dominio/baselines';
import type { AreaOpcion, CargoOpcion, OpcionBaseline } from '@/dominio/baselines';
import { camposDeArea, camposDePersona } from '@/dominio/camposArea';
import type { CampoArea, CatalogosCampos, ValorCampoArea } from '@/dominio/camposArea';
import { PERMISOS, permisosDe } from '@/dominio/permisos';
import { etiquetaRol, nombreRol, rolesProducto } from '@/dominio/roles';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import { useIdioma } from '@/i18n/cliente';
import type { Idioma } from '@/i18n/idioma';
import type { EjecutarCamposArea } from '../useCamposArea';
import { DatosAreaPerfil, EditorDatosArea, borradorDatosArea } from './CamposArea';
import type { BorradorDatosArea } from './CamposArea';

const { Text } = Typography;

/** El área de la persona: la de Datos base; si no está ahí (Plataforma), el nombre del kit. */
export const areaDe = (areas: OpcionBaseline[], id: string) => (areas.some((a) => a.codigo === id) ? nombreDe(areas, id) : nombreArea(id));

/* ------------------------------------------------------- cargos: elegir y ver lo que dan */

/** Los cargos, en grupos por rol (Doer, Coordinator, Manager…). Varios a la vez. */
export function SelectorCargos({
  cargos,
  valor,
  onCambio,
  actuales = [],
}: {
  cargos: CargoOpcion[];
  valor: string[];
  onCambio: (v: string[]) => void;
  /** Los que ya tiene aunque ya no estén vigentes: se siguen viendo. */
  actuales?: string[];
}) {
  const { idioma } = useIdioma();
  const grupos = rolesProducto(idioma)
    .map((r) => ({ label: r.nombre, options: cargos.filter((c) => c.roles[0] === r.id).map((c) => ({ value: c.codigo, label: c.nombre })) }))
    .filter((g) => g.options.length);
  const viejos = actuales.filter((c) => !cargos.some((x) => x.codigo === c)).map((c) => ({ value: c, label: c }));
  return (
    <Select
      mode="multiple"
      allowClear
      showSearch={{ optionFilterProp: 'label' }}
      style={{ width: '100%' }}
      value={valor}
      onChange={onCambio}
      options={viejos.length ? [...grupos, { label: '—', options: viejos }] : grupos}
    />
  );
}

/** «Doer, Coordinator»: los roles distintos, sin alcance, en el orden del catálogo. Los dan los cargos, no se eligen. */
export const nombresDeRoles = (rolIds: string[], idioma: Idioma) => {
  const ids = [...new Set(rolIds)];
  const orden = rolesProducto(idioma).map((r) => r.id);
  const pos = (id: string) => (orden.includes(id) ? orden.indexOf(id) : orden.length);
  return ids.sort((a, b) => pos(a) - pos(b)).map((id) => nombreRol(id, idioma));
};

/** Lo que dan los cargos: rol, área, sub-área y roles con su alcance. Solo para mirar. */
export function ResumenCargos({ perfil, areas }: { perfil: PerfilDeCargos; areas: AreaOpcion[] }) {
  const { token } = theme.useToken();
  const { idioma, m } = useIdioma();
  const t = m.rolesPermisos;
  const subareas = perfil.unidades.filter((u) => areas.find((a) => a.codigo === u)?.padre);
  const roles = nombresDeRoles(perfil.roles.map((r) => r.rolId), idioma);
  return (
    <Descriptions
      column={1}
      size="small"
      items={[
        { key: 'rol', label: t.rol, children: roles.length ? roles.join(', ') : <Text type="secondary">—</Text> },
        { key: 'area', label: t.area, children: perfil.raices.length ? perfil.raices.map((r) => areaDe(areas, r)).join(', ') : <Text type="secondary">—</Text> },
        { key: 'sub', label: t.subarea, children: subareas.length ? subareas.map((s) => areaDe(areas, s)).join(', ') : <Text type="secondary">—</Text> },
        {
          key: 'roles',
          label: t.rolesActivos,
          children: perfil.roles.length ? (
            <Space size={token.marginXXS} wrap>
              {perfil.roles.map((r) => (
                <Tag key={`${r.rolId}-${r.area}`} color={rolPorId(r.rolId)?.color}>
                  {nombreRol(r.rolId, idioma)} · {r.area ? areaDe(areas, r.area) : t.todaLaEmpresa}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">{t.sinRolesNuevos}</Text>
          ),
        },
      ]}
    />
  );
}

/* ------------------------------------------------------- permisos: una sola lista */

/**
 * Una sola lista de permisos (H-034). Mirando: solo los que la persona tiene. Editando: el catálogo entero, cada uno
 * con su casilla. Por ahora todos se marcan por persona: ninguno sale de un rol (H-035).
 */
export function ListaPermisos({
  permisos,
  directos,
  onDirectos,
}: {
  /** Los que tiene hoy (o tendría, con el borrador). */
  permisos: string[];
  directos: string[];
  /** Con él, se edita. */
  onDirectos?: (lista: string[]) => void;
}) {
  const { token } = theme.useToken();
  const t = useIdioma().m.rolesPermisos;
  const fila = { display: 'flex', alignItems: 'center', gap: token.marginXS, padding: `${token.paddingXXS}px 0` } as const;

  if (!onDirectos) {
    const tiene = PERMISOS.filter((p) => permisos.includes(p.id));
    return (
      <div>
        <div style={{ margin: `${token.marginLG}px 0 ${token.marginXS}px` }}>
          <Text strong>{t.permisosTitulo(tiene.length)}</Text>
        </div>
        {tiene.length === 0 && <Cap>{t.sinPermisos}</Cap>}
        {tiene.map((p) => (
          <div key={p.id} style={fila}>
            <Ico de={Check} style={{ color: token.colorSuccess }} />
            <span>{p.nombre}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ margin: `${token.marginLG}px 0 ${token.marginXXS}px` }}>
        <Text strong>{t.permisosTitulo(permisos.length)}</Text>
      </div>
      <Cap style={{ marginBottom: token.marginXS }}>{t.permisosNuevosNota}</Cap>
      {PERMISOS.map((p) => (
        <div key={p.id} style={fila}>
          <Checkbox checked={directos.includes(p.id)} onChange={(e) => onDirectos(e.target.checked ? [...directos, p.id] : directos.filter((x) => x !== p.id))}>
            {p.nombre}
          </Checkbox>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- detalle del usuario (Drawer) */

type Resultado = { ok: true } | { ok: false; motivo: string };

/** Los campos de las áreas principales de una persona (H-027 + H-038). */
const camposDe = (campos: CampoArea[], raices: string[]) => raices.flatMap((r) => camposDeArea(campos, r));

/**
 * El detalle de una persona, con **un solo punto de edición** (H-034): mirando, nada se edita; «Editar» pasa todo
 * el detalle a edición y «Guardar» corre, en orden, cada acción con su contrato: editar usuario (cargos) → revocar los
 * roles que sus cargos ya no dan → asignar los que dan → datos del área → permisos. Si una se rechaza, se detiene y
 * dice por qué.
 */
export function DetalleUsuario({
  empleado,
  eventos,
  cargos,
  areas,
  campos,
  valores,
  catalogos,
  dominioCorreo,
  puede,
  ejecutar,
  editar,
  ejecutarCampos,
  definirPermisos,
  onCerrar,
}: {
  empleado: EmpleadoConCorreo;
  eventos: Evento[];
  cargos: CargoOpcion[];
  areas: AreaOpcion[];
  campos: CampoArea[];
  valores: ValorCampoArea[];
  catalogos: CatalogosCampos;
  dominioCorreo: string;
  /** Administrador y fuera de «Ver como». Sin él, no hay «Editar». */
  puede: boolean;
  ejecutar: (accionId: string, entrada: EntradaAccion) => Promise<({ ok: true; evento: Evento }) | { ok: false; motivo: string }>;
  editar: (entrada: EntradaAccion) => Promise<Resultado>;
  ejecutarCampos: EjecutarCamposArea;
  definirPermisos: (empleadoId: string, permisos: string[]) => Promise<{ ok: boolean; motivo?: string }>;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { idioma, m } = useIdioma();
  const t = m.rolesPermisos;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activas = asignacionesActivas(empleado);
  const revocadas = empleado.asignaciones.filter((a) => a.est !== 'ok');
  const propios = eventos.filter((ev) => ev.cambios.some((c) => c.id.startsWith(empleado.id)) || ev.entrada.empleadoId === empleado.id);
  const nombreCargo = (c: string) => cargos.find((x) => x.codigo === c)?.nombre ?? c;
  const cargosHoy = empleado.cargos.length ? empleado.cargos : [empleado.puesto];
  const raicesHoy = areasPrincipales(empleado, { cargos, areas });

  /* ---- el borrador de la edición */
  const inicial = { nombre: empleado.nombre, email: empleado.email ?? '', cargos: empleado.cargos };
  const [datos, setDatos] = useState(inicial);
  const [directos, setDirectos] = useState<string[]>(empleado.permisosDirectos);
  const perfil = perfilDeCargos(datos.cargos, cargos, areas);
  const camposBorrador = camposDe(campos, perfil.raices);
  const [datosArea, setDatosArea] = useState<BorradorDatosArea>(() => borradorDatosArea(camposDe(campos, raicesHoy), valores, empleado.id));

  function empezar() {
    setDatos(inicial);
    setDirectos(empleado.permisosDirectos);
    setDatosArea(borradorDatosArea(camposDe(campos, raicesHoy), valores, empleado.id));
    setError(null);
    setEditando(true);
  }

  function cambiarCargos(lista: string[]) {
    setDatos({ ...datos, cargos: lista });
    const raices = perfilDeCargos(lista, cargos, areas).raices;
    setDatosArea((d) => ({ ...borradorDatosArea(camposDe(campos, raices), valores, empleado.id), ...d }));
  }

  // Los roles que sobran (sus cargos ya no los dan) y los que faltan.
  const mismo = (a: { rolId: string; alcanceValor: string | null }, b: { rolId: string; alcanceValor: string | null }) => a.rolId === b.rolId && a.alcanceValor === b.alcanceValor;
  const sobran = activas.filter((a) => !perfil.asignaciones.some((d) => mismo(a, d)));
  const faltan = perfil.asignaciones.filter((d) => !activas.some((a) => mismo(a, d)));

  const permisosVista = permisosDe(editando ? directos : empleado.permisosDirectos);
  const cambioDatos = datos.nombre.trim() !== inicial.nombre || datos.email.trim() !== inicial.email || datos.cargos.join('|') !== inicial.cargos.join('|');
  const original = borradorDatosArea(camposBorrador, valores, empleado.id);
  const cambioArea = camposBorrador.some((c) => JSON.stringify(datosArea[c.id] ?? '') !== JSON.stringify(original[c.id] ?? ''));
  const cambioPermisos = [...directos].sort().join() !== [...empleado.permisosDirectos].sort().join();

  async function guardar() {
    setGuardando(true);
    setError(null);
    const paso = async (r: Promise<{ ok: boolean; motivo?: string }>) => {
      const x = await r;
      if (!x.ok) setError(x.motivo ?? t.contratoNoPermitio);
      return x.ok;
    };
    const datosDeSusAreas = Object.fromEntries(camposBorrador.map((c) => [c.id, datosArea[c.id] ?? '']));
    const ok =
      (!cambioDatos || (await paso(editar({ empleadoId: empleado.id, nombre: datos.nombre, email: datos.email, cargos: datos.cargos.join('|') })))) &&
      (await sobran.reduce<Promise<boolean>>(async (p, a) => (await p) && paso(ejecutar('revocar-asignacion', { empleadoId: empleado.id, asignacionId: a.id })), Promise.resolve(true))) &&
      (await faltan.reduce<Promise<boolean>>(async (p, a) => (await p) && paso(ejecutar('asignar-rol', { empleadoId: empleado.id, ...a })), Promise.resolve(true))) &&
      (!cambioArea || (await ejecutarCampos('guardar-datos-area', { empleadoId: empleado.id, valores: JSON.stringify(datosDeSusAreas) }))) &&
      (!cambioPermisos || (await paso(definirPermisos(empleado.id, directos))));
    setGuardando(false);
    if (ok) setEditando(false);
  }

  const titulo = (texto: string) => (
    <div style={{ margin: `${token.marginLG}px 0 ${token.marginXS}px` }}>
      <Text strong>{texto}</Text>
    </div>
  );

  return (
    <Drawer
      open
      title={
        <span>
          {empleado.nombre}
        </span>
      }
      size={token.controlHeightLG * 18}
      onClose={onCerrar}
      extra={
        puede &&
        !editando && (
          <Button icon={<Ico de={Pencil} />} onClick={empezar}>
            {t.editarUsuario}
          </Button>
        )
      }
      footer={
        editando && (
          <div style={{ display: 'flex', gap: token.marginXS, justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditando(false)} disabled={guardando}>
              {m.comun.cancelar}
            </Button>
            <Button type="primary" loading={guardando} onClick={guardar}>
              {t.guardar}
            </Button>
          </div>
        )
      }
    >
      {!editando ? (
        /* ------------------------------------------------ mirando */
        <div>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'cargos',
                label: t.cargos,
                children: (
                  <Space size={token.marginXXS} wrap>
                    {cargosHoy.map((c) => (
                      <Tag key={c}>{nombreCargo(c)}</Tag>
                    ))}
                  </Space>
                ),
              },
              { key: 'email', label: t.correo, children: empleado.email ?? <Text type="secondary">{t.sinCorreo}</Text> },
            ]}
          />
          {empleado.cargos.length ? (
            <ResumenCargos perfil={perfilDeCargos(empleado.cargos, cargos, areas)} areas={areas} />
          ) : (
            <Descriptions column={1} size="small" items={[{ key: 'area', label: t.area, children: areaDe(areas, empleado.areaId) }]} />
          )}
          {raicesHoy.map((r) => (
            <DatosAreaPerfil key={r} empleadoId={empleado.id} area={r} areaNombre={areaDe(areas, r)} campos={campos} valores={valores} catalogos={catalogos} roles={perfilDeCargos(empleado.cargos, cargos, areas).roles} />
          ))}

          {/* Con cargos, sus roles ya se ven en «Roles activos» (arriba). Sin cargos del catálogo, los guardados. */}
          {!empleado.cargos.length && (
            <>
              {titulo(t.asignacionesActivasTitulo)}
              {activas.length === 0 && <Cap>{t.sinAsignaciones}</Cap>}
              {activas.map((a) => (
                <div key={a.id} style={{ marginBottom: token.marginXS }}>
                  <Tag color={rolPorId(a.rolId)?.color}>{etiquetaRol(a, idioma)}</Tag>
                  {a.desde && <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{m.comun.desde.toLowerCase()} {a.desde}</Text>}
                </div>
              ))}
            </>
          )}
          {revocadas.length > 0 && (
            <>
              {titulo(t.asignacionesRevocadas)}
              <Cap style={{ marginBottom: token.marginXS }}>{t.revocadasNota}</Cap>
              {revocadas.map((a) => (
                <div key={a.id} style={{ marginBottom: token.marginXXS }}>
                  <Tag>{etiquetaRol(a, idioma)}</Tag>
                </div>
              ))}
            </>
          )}

          <ListaPermisos permisos={permisosVista} directos={empleado.permisosDirectos} />

          {titulo(t.rastro)}
          <RastroDeEventos eventos={propios} vacio={t.sinEventos} />
        </div>
      ) : (
        /* ------------------------------------------------ editando */
        <Form layout="vertical" requiredMark>
          {error && <Alert type="error" showIcon title={t.contratoNoPermitio} description={error} style={{ marginBottom: token.margin }} />}
          <Form.Item label={m.comun.nombre} required>
            <Input value={datos.nombre} maxLength={80} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          </Form.Item>
          <Form.Item label={t.correoCorporativo} required>
            <Input type="email" value={datos.email} placeholder={t.placeholderCorreo(dominioCorreo)} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
          </Form.Item>
          <Form.Item label={t.cargos} required extra={t.cargosAyuda}>
            <SelectorCargos cargos={cargos} valor={datos.cargos} onCambio={cambiarCargos} actuales={empleado.cargos} />
          </Form.Item>
          <ResumenCargos perfil={perfil} areas={areas} />
          {(sobran.length > 0 || faltan.length > 0) && <Cap style={{ marginTop: token.marginXS }}>{t.rolesSeAjustan(faltan.length, sobran.length)}</Cap>}

          {perfil.raices.map((r) => {
            // Solo los que se le piden con lo que lleva el borrador: sus roles y, para «Solo si», lo que ya marcó (H-040).
            const delArea = camposDePersona(campos, [r], perfil.roles, (id) => datosArea[id]);
            return delArea.length ? (
              <div key={r}>
                {titulo(t.camposArea.datosTitulo(areaDe(areas, r)))}
                <EditorDatosArea campos={delArea} datos={datosArea} onCambio={setDatosArea} catalogos={catalogos} />
              </div>
            ) : null;
          })}

          <ListaPermisos permisos={permisosVista} directos={directos} onDirectos={setDirectos} />
        </Form>
      )}
    </Drawer>
  );
}

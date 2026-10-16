'use client';
/**
 * Resolver los ZIP sin territorio (H-042). Ask Claro propone (regla local, sin IA externa): para cada ZIP, un
 * territorio existente con su confianza y su motivo, o uno nuevo con el estado del lead. Quien puede administrar
 * territorios (Datos base) revisa, cambia lo que quiera y aplica: se agrega el ZIP al territorio o se crea el nuevo,
 * cada uno con el contrato de Datos base, y después cada lead recibe su territorio por ZIP.
 */
import { useState } from 'react';
import { Alert, Button, Checkbox, Flex, Input, Modal, Select, Tag, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { Bot } from 'lucide-react';
import { Cap, Ico, Pila, SelloActor, Tabla, ZonaIA } from '@arc2-0/claro-one-kit';
import type { EntradaAccion, Evento } from '@arc2-0/claro-one-kit/capacidad';
import type { PropuestaTerritorio } from '@/dominio/territorioLeads';
import { useIdioma } from '@/i18n/cliente';

const { Text } = Typography;

/** Un territorio de Datos base, con lo que hace falta para agregarle ZIP. */
export interface TerritorioEditable {
  id: string;
  codigo: string;
  nombre: string;
  estado: string | null;
  subregion: string | null;
  zips: string[];
}

type Resultado = { ok: true } | { ok: false; motivo: string };
const NUEVO = '__nuevo__';

interface Decision {
  aplicar: boolean;
  destino: string; // código de un territorio, o NUEVO
  nombreNuevo: string;
}

export function ResolverTerritorios({
  propuesta,
  territorios,
  puedeAplicar,
  gestionarTerritorio,
  asignarPorZip,
  onCerrar,
}: {
  /** El evento de Ask Claro con las propuestas (`datos.propuestas`). */
  propuesta: Evento;
  territorios: TerritorioEditable[];
  /** Solo quien administra Datos base crea o cambia territorios. */
  puedeAplicar: boolean;
  gestionarTerritorio: (accion: 'agregar-valor' | 'editar-valor', entrada: EntradaAccion) => Promise<Resultado>;
  asignarPorZip: () => Promise<Resultado>;
  onCerrar: () => void;
}) {
  const { token } = theme.useToken();
  const { m } = useIdioma();
  const t = m.leads.territorios;
  const propuestas = ((propuesta.datos as { propuestas?: PropuestaTerritorio[] } | undefined)?.propuestas ?? []);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(propuestas.map((p) => [p.zip, { aplicar: true, destino: p.tipo === 'nuevo' ? NUEVO : p.territorio!, nombreNuevo: p.nombreNuevo ?? '' }])),
  );
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (zip: string, c: Partial<Decision>) => setDecisiones((d) => ({ ...d, [zip]: { ...d[zip]!, ...c } }));
  const elegidas = propuestas.filter((p) => decisiones[p.zip]?.aplicar);

  async function aplicar() {
    setAplicando(true);
    setError(null);
    // Los ZIP que van a un territorio existente, juntos por territorio; los nuevos, juntos por nombre y estado.
    const aExistentes = new Map<string, string[]>();
    const aNuevos = new Map<string, { nombre: string; estado: string; zips: string[] }>();
    for (const p of elegidas) {
      const d = decisiones[p.zip]!;
      if (d.destino === NUEVO) {
        const clave = `${d.nombreNuevo.trim().toLowerCase()}|${p.estado ?? ''}`;
        const g = aNuevos.get(clave) ?? { nombre: d.nombreNuevo.trim(), estado: p.estado ?? '', zips: [] };
        g.zips.push(p.zip);
        aNuevos.set(clave, g);
      } else aExistentes.set(d.destino, [...(aExistentes.get(d.destino) ?? []), p.zip]);
    }
    const paso = async (r: Promise<Resultado>) => {
      const x = await r;
      if (!x.ok) setError(x.motivo);
      return x.ok;
    };
    let ok = true;
    for (const [codigo, zips] of aExistentes) {
      const tr = territorios.find((x) => x.codigo === codigo)!;
      ok = ok && (await paso(gestionarTerritorio('editar-valor', { valorId: tr.id, nombre: tr.nombre, estado: tr.estado ?? '', subregion: tr.subregion ?? '', zips: [...tr.zips, ...zips].join(',') })));
    }
    for (const g of aNuevos.values()) {
      ok = ok && (await paso(gestionarTerritorio('agregar-valor', { tipo: 'territorio', nombre: g.nombre, estado: g.estado, zips: g.zips.join(',') })));
    }
    // Con los territorios al día, cada lead recibe el suyo por ZIP.
    if (ok) ok = await paso(asignarPorZip());
    setAplicando(false);
    if (ok) onCerrar();
  }

  const colorConfianza = (c: number) => (c >= 0.75 ? 'success' : c >= 0.5 ? 'warning' : 'error');
  const columnas: TableColumnsType<PropuestaTerritorio> = [
    ...(puedeAplicar
      ? [
          {
            key: 'aplicar',
            title: '',
            width: token.controlHeightLG,
            render: (_: unknown, p: PropuestaTerritorio) => <Checkbox aria-label={`${t.aplicar} ${p.zip}`} checked={decisiones[p.zip]?.aplicar} onChange={(e) => cambiar(p.zip, { aplicar: e.target.checked })} />,
          },
        ]
      : []),
    {
      key: 'zip',
      title: t.colZip,
      render: (_, p) => (
        <div>
          <Text strong>{p.zip}</Text>
          <Cap>{[p.ciudad, p.estado].filter(Boolean).join(', ') || '—'}</Cap>
        </div>
      ),
    },
    { key: 'leads', title: t.colLeads, align: 'right', render: (_, p) => p.leads.length },
    {
      key: 'propuesta',
      title: t.colPropuesta,
      render: (_, p) => {
        const d = decisiones[p.zip]!;
        const opciones = [
          ...territorios.filter((x) => !p.estado || x.estado === p.estado).map((x) => ({ value: x.codigo, label: x.nombre })),
          { value: NUEVO, label: t.nuevoTerritorio(p.estado ?? '—') },
        ];
        return (
          <Pila gap="sm">
            {puedeAplicar ? (
              <Select size="small" style={{ minWidth: token.controlHeightLG * 6 }} value={d.destino} onChange={(v) => cambiar(p.zip, { destino: v })} options={opciones} />
            ) : (
              <Text>{d.destino === NUEVO ? t.nuevoTerritorio(p.estado ?? '—') : territorios.find((x) => x.codigo === d.destino)?.nombre}</Text>
            )}
            {d.destino === NUEVO && puedeAplicar && (
              <Input size="small" aria-label={t.nombreNuevo} placeholder={t.nombreNuevo} value={d.nombreNuevo} onChange={(e) => cambiar(p.zip, { nombreNuevo: e.target.value })} />
            )}
          </Pila>
        );
      },
    },
    {
      key: 'confianza',
      title: t.colConfianza,
      render: (_, p) => (
        <div style={{ maxWidth: token.controlHeightLG * 9 }}>
          <Tag color={colorConfianza(p.confianza)}>{t.confianza(Math.round(p.confianza * 100))}</Tag>
          <Cap>{p.motivo}</Cap>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open
      title={t.titulo}
      width={token.controlHeightLG * 26}
      onCancel={onCerrar}
      destroyOnHidden
      footer={
        <Flex gap={token.marginXS} justify="flex-end" wrap>
          <Button onClick={onCerrar}>{m.comun.cancelar}</Button>
          {puedeAplicar && (
            <Button type="primary" loading={aplicando} disabled={!elegidas.length || elegidas.some((p) => decisiones[p.zip]!.destino === NUEVO && !decisiones[p.zip]!.nombreNuevo.trim())} onClick={aplicar}>
              {t.aplicarN(elegidas.length)}
            </Button>
          )}
        </Flex>
      }
    >
      <Pila>
        <ZonaIA superficie>
          <Flex gap={token.marginXS} align="center" wrap>
            <Ico de={Bot} />
            <SelloActor actor={propuesta.actor} conNombre />
            <Text>{propuesta.salida}</Text>
          </Flex>
          <Cap style={{ marginTop: token.marginXXS }}>{t.reglaLocal}</Cap>
        </ZonaIA>
        {!puedeAplicar && <Alert type="info" showIcon title={t.soloAdmin} />}
        {error && <Alert type="error" showIcon title={error} />}
        <Tabla<PropuestaTerritorio> size="small" rowKey="zip" dataSource={propuestas} columns={columnas} scroll={{ x: 'max-content' }} pagination={propuestas.length > 20 ? { pageSize: 20 } : false} />
      </Pila>
    </Modal>
  );
}

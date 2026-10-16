'use client';
/**
 * La línea de tiempo unificada de una agencia (MN7). Portada de `PestanaLinea` del prototipo
 * PB-002 v2.6 (`directorio-ficha.jsx`) del arnés, con los componentes del kit.
 *
 * - `Segmented` filtra el mismo contenido por tipo, con el conteo de cada grupo (TAB 4.1: cambia el
 *   recorte, no la sección). `Switch` «Incluir su red» suma sub-agencias y agentes del downline.
 * - `Timeline` de antd, la más reciente primero. Si la interacción es de otro (un agente o una
 *   sub-agencia de la red), lleva su nombre como link a su ficha.
 * - De solo lectura: registrar interacciones es trabajo de los módulos de correo, llamadas y casos.
 */
import { useState } from 'react';
import { Flex, Segmented, Switch, Tag, Timeline, Typography, theme } from 'antd';
import { Cap, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { nombreAgencia } from '@arc2-0/claro-one-kit/dominio';
import type { AgenciaDirectorio, DirectorioCompleto } from '@/dominio/directorio';
import { ORDEN_GRUPOS, conteoPorGrupo, lineaDeTiempoDeAgencia } from '@/dominio/interacciones';
import type { GrupoInteraccion, Interaccion } from '@/dominio/interacciones';
import { useIdioma } from '@/i18n/cliente';
import { fechaHoraCorta } from '@/i18n/formato';

const { Text } = Typography;

export function PanelInteracciones({
  agencia,
  directorio,
  interacciones,
  onAgencia,
  onAgente,
}: {
  agencia: AgenciaDirectorio;
  directorio: DirectorioCompleto;
  interacciones: Interaccion[];
  onAgencia: (id: string) => void;
  onAgente: (id: string) => void;
}) {
  const { token } = theme.useToken();
  const { idioma, m } = useIdioma();
  const t = m.directorio.interacciones;
  const [grupo, setGrupo] = useState<GrupoInteraccion>('todo');
  const [red, setRed] = useState(false);

  const conteo = conteoPorGrupo(directorio, interacciones, agencia.id, red);
  const eventos = lineaDeTiempoDeAgencia(directorio, interacciones, agencia.id, { grupo, incluirRed: red });

  const sujeto = (i: Interaccion) => {
    if (i.agenteId) {
      const a = directorio.agentes.find((x) => x.id === i.agenteId);
      return <Typography.Link onClick={() => onAgente(i.agenteId!)}>{a?.nombre ?? i.agenteId}</Typography.Link>;
    }
    if (i.agenciaId && i.agenciaId !== agencia.id) {
      return <Typography.Link onClick={() => onAgencia(i.agenciaId!)}>{nombreAgencia(directorio.agencias, i.agenciaId)}</Typography.Link>;
    }
    return null;
  };

  const motivoVacio = grupo !== 'todo' ? t.sinDeTipo : red ? t.sinEnRed : t.sinPropias;

  return (
    <Flex vertical gap={token.margin}>
      <Flex gap={token.margin} wrap align="center" justify="space-between">
        <Segmented<GrupoInteraccion>
          aria-label={t.filtro}
          value={grupo}
          onChange={setGrupo}
          options={ORDEN_GRUPOS.map((g) => ({ value: g, label: `${t.grupos[g]} (${conteo[g]})` }))}
        />
        <Flex gap={token.marginXS} align="center">
          <Switch checked={red} onChange={setRed} aria-label={t.incluirRed} />
          <Text>{t.incluirRed}</Text>
        </Flex>
      </Flex>

      {eventos.length === 0 ? (
        <VacioConMotivo titulo={t.sinTitulo} motivo={motivoVacio} />
      ) : (
        <Timeline
          items={eventos.map((i) => {
            const de = sujeto(i);
            return {
              key: i.id,
              title: <Text type="secondary">{fechaHoraCorta(i.cuando, idioma)}</Text>,
              content: (
                <Flex vertical gap={token.marginXXS}>
                  <Flex gap={token.marginXS} wrap align="center">
                    <Tag>{t.tipos[i.tipo]}</Tag>
                    {i.direccion && <Cap>{i.direccion === 'entrada' ? t.entro : t.salio}</Cap>}
                    {de}
                    <Text strong>{i.titulo}</Text>
                  </Flex>
                  {i.detalle && <Text>{i.detalle}</Text>}
                  {i.fuente && <Cap>{t.fuente(i.fuente)}</Cap>}
                </Flex>
              ),
            };
          })}
        />
      )}

      <Cap>{t.nota}</Cap>
      <Cap>{t.interna}</Cap>
    </Flex>
  );
}

'use client';
/**
 * El rastro de eventos (P: ningún cambio sin rastro), igual al `RastroDeEventos` del kit pero con las props vigentes de
 * antd 6 `Timeline` (`title` / `content`). El del kit todavía usa `label` / `children` y deja dos avisos en la consola
 * cada vez que un detalle tiene historia (H-033). Cuando el kit lo corrija, se vuelve a usar el suyo y se borra este.
 */
import { Timeline, Typography } from 'antd';
import type { Evento } from '@arc2-0/claro-one-kit/capacidad';
import { Cap, SelloActor, SelloCanal } from '@arc2-0/claro-one-kit';
import { useIdioma } from '@/i18n/cliente';

const { Text } = Typography;
const COLOR: Record<string, string> = { cambio: 'green', propuesta: 'blue', consulta: 'gray', rechazo: 'red' };

export function RastroDeEventos({ eventos, vacio }: { eventos: Evento[]; vacio: string }) {
  const { idioma, m } = useIdioma();
  const t = m.rastro;
  if (!eventos.length) return <Cap>{vacio}</Cap>;
  const hora = (d: Date | string) =>
    (d instanceof Date ? d : new Date(d)).toLocaleString(idioma === 'en' ? 'en-US' : 'es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Timeline
      items={[...eventos].reverse().map((ev, i) => ({
        key: String(i),
        color: COLOR[ev.tipo] ?? 'gray',
        title: (
          <span>
            {hora(ev.cuando)} · <SelloActor actor={ev.actor} conNombre={false} /> <SelloCanal canal={ev.canal} />
          </span>
        ),
        content: (
          <div>
            <b>{ev.nombreAccion || ev.accion}</b>
            {ev.tipo === 'propuesta' && <Text type="secondary"> · {t.propuesta}</Text>}
            {ev.tipo === 'rechazo' && <Text type="secondary"> · {t.denegada}</Text>}
            {ev.cambios.map((c, j) => (
              <div key={j}>
                {c.entidad} {c.id}: {c.de} → <b>{c.a}</b>
                {c.motivo ? ` · ${c.motivo}` : ''}
              </div>
            ))}
            {ev.motivo && <div>{ev.motivo}</div>}
            {ev.salida && <div>{ev.salida}</div>}
            <Cap>{[ev.regla, ev.procedencia && t.fuente(ev.procedencia.fuente), ev.emite?.length ? t.emite(ev.emite.join(', ')) : null].filter(Boolean).join(' · ')}</Cap>
          </div>
        ),
      }))}
    />
  );
}

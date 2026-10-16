/**
 * Fechas legibles según el Manual de UX Writing (§4.5), igual que en el prototipo PB-002 v2.6:
 * «21 sep 2026, 17:05» en español y «Sep 21, 2026, 17:05» en inglés. Hora local de quien mira.
 */
import type { Idioma } from './idioma';

const MESES: Record<Idioma, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function fechaHoraCorta(iso: string, idioma: Idioma): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mes = MESES[idioma][d.getMonth()];
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const base = idioma === 'en' ? `${mes} ${d.getDate()}, ${d.getFullYear()}` : `${d.getDate()} ${mes} ${d.getFullYear()}`;
  return `${base}, ${hora}`;
}

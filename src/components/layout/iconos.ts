/**
 * Las claves de icono que traen los datos (`FLUJOS[].icon`, heredadas del
 * Design System anterior) resueltas contra `lucide-react`, que es la libreria
 * de iconos del kit: antd 6 no trae iconos propios.
 *
 * El dato no cambio: el mapa vive aca para que `datos.mock.ts` siga siendo
 * datos puros, sin importar componentes.
 */
import {
  BookOpen, Building2, Calendar, CircleCheckBig, CreditCard, DollarSign, FileText, Folder, IdCard,
  LayoutDashboard, Link2, Lock, LogOut, MessageSquare, RefreshCw, Tags, ThumbsUp, TrendingUp, UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const MAPA: Record<string, LucideIcon> = {
  'user-add': UserPlus,
  idcard: IdCard,
  'file-text': FileText,
  'check-circle': CircleCheckBig,
  message: MessageSquare,
  sync: RefreshCw,
  like: ThumbsUp,
  logout: LogOut,
  'credit-card': CreditCard,
  tag: Tags,
  link: Link2,
  book: BookOpen,
  dollar: DollarSign,
  folder: Folder,
  rise: TrendingUp,
  dashboard: LayoutDashboard,
  apartment: Building2,
  calendar: Calendar,
  lock: Lock,
};

export function iconoDe(clave: string | undefined): LucideIcon {
  return (clave && MAPA[clave]) || Folder;
}

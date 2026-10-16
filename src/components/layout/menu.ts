/**
 * El menú lateral de la perspectiva Internal. **Se calcula, no se configura**: cada Flujo aparece
 * porque alguna asignación activa de la persona cubre su área dueña (`puedeVerFlujo`).
 *
 * Distribución del prototipo PB-002 v2.6 del arnés (`app.jsx`, NAV-R23):
 *   Inicio
 *   Mi espacio      Calendario · Mi performance · Mis reportes          (común a todo interno)
 *   Transversal     Directorio · Analítica Transversal de Negocio · Recursos
 *   Commercial      Lead Management → Onboarding → Growth → Release → Metas
 *   Operations      Contracts › · Negociación Especial · Book of Business · Payments › ·
 *                   Reconciliaciones · Service · Referrals
 *   Configuración   Gestión de Roles y Permisos · Baselines             (solo quien administra)
 * Solo el primer nivel lleva ícono (NAV-R04). Configuración se queda en el menú lateral por pedido del
 * negocio (el prototipo la movió al menú de la cuenta, TOP-R14); el menú de la cuenta también la abre.
 * Un grupo sin ítems visibles no aparece.
 *
 * Los destinos que todavía no se construyen abren `RUTAS.modulo(clave)`, que dice por qué está vacío.
 * Las claves de los destinos son rutas: `Shell` navega con ellas sin traducir nada.
 */
import { House, LayoutGrid, Settings, SlidersHorizontal, Users } from 'lucide-react';
import { esConfiguradorAdmin, flujoPorId, puedeVerFlujo, tieneAlcanceEnArea } from '@arc2-0/claro-one-kit/dominio';
import { tiene } from '@/dominio/permisos';
import type { EmpleadoConCorreo } from '@/dominio/tipos';
import type { NavNode } from '@arc2-0/claro-one-kit';
import type { Mensajes } from '@/i18n/mensajes';
import { RUTAS } from '@/routes/rutas';
import { iconoDe } from './iconos';

const sinSufijo = (nombre: string) => nombre.replace(' end-to-end', '');

/** `t` = los textos del menú en el idioma de quien mira. Los nombres de los Flujos son datos del
 *  catálogo y no se traducen. */
export function construirMenu(empleado: EmpleadoConCorreo, t: Mensajes['menu']): NavNode[] {
  const visible = (id: string) => {
    const f = flujoPorId(id);
    if (!f || !puedeVerFlujo(empleado, f)) return false;
    // Lead Management, además, pide «ver» o «importar» leads (H-032).
    if (id === 'lead-conversion') return tiene(empleado.permisosDirectos, 'leads.ver') || tiene(empleado.permisosDirectos, 'leads.importar');
    return true;
  };
  /** Los Flujos ya construidos tienen su propia ruta; los demás abren su ficha de referencia. */
  const RUTA_PROPIA: Record<string, string> = { 'lead-conversion': RUTAS.leads };
  const deFlujo = (id: string, etiqueta?: string): NavNode => {
    const f = flujoPorId(id)!;
    return { key: RUTA_PROPIA[f.id] ?? RUTAS.flujo(f.id), label: etiqueta ?? sinSufijo(f.nombre) };
  };
  const flujos = (ids: string[]) => ids.filter(visible).map((id) => deFlujo(id));

  const nav: NavNode[] = [{ key: RUTAS.inicio, label: t.inicio, icon: iconoDe('dashboard') }];

  nav.push({
    key: 'grupo-mi-espacio',
    label: t.miEspacio,
    icon: House,
    children: [
      { key: RUTAS.calendario, label: t.calendario },
      { key: RUTAS.modulo('mi-performance'), label: t.miPerformance },
      { key: RUTAS.modulo('mis-reportes'), label: t.misReportes },
    ],
  });

  nav.push({
    key: 'grupo-transversal',
    label: t.transversal,
    icon: LayoutGrid,
    children: [
      { key: RUTAS.directorio, label: t.directorio },
      { key: RUTAS.modulo('analitica'), label: t.analitica },
      { key: RUTAS.modulo('recursos'), label: t.recursos },
    ],
  });

  const comercial = flujos(['lead-conversion', 'onboarding-agente-agencia', 'growth-management', 'release-agente']);
  // Metas vive al final de Commercial; se ve con alcance sobre Comercial aunque no se vea ningún Flujo.
  if (tieneAlcanceEnArea(empleado, 'comercial')) comercial.push({ key: RUTAS.modulo('metas'), label: t.metas });
  if (comercial.length) nav.push({ key: 'grupo-commercial', label: t.commercial, icon: Users, children: comercial });

  const contracts = flujos(['contract-request', 'seguimiento-cartera-contratos', 'ready-to-sell']);
  const payments = flujos(['statements', 'calculo-comisiones', 'commission-advance', 'pagos-realizados']);
  const operations: NavNode[] = [];
  if (contracts.length) operations.push({ key: 'submenu-contracts', label: t.contracts, children: contracts });
  if (visible('negociacion-especial-comision')) operations.push(deFlujo('negociacion-especial-comision'));
  if (visible('book-of-business')) operations.push(deFlujo('book-of-business'));
  if (payments.length) operations.push({ key: 'submenu-payments', label: t.payments, children: payments });
  if (visible('reconciliacion-pago')) operations.push(deFlujo('reconciliacion-pago', t.reconciliaciones));
  if (visible('case-management')) operations.push(deFlujo('case-management', t.service));
  if (visible('referral-consolidation')) operations.push(deFlujo('referral-consolidation', t.referrals));
  if (operations.length) nav.push({ key: 'grupo-operations', label: t.operations, icon: Settings, children: operations });

  if (esConfiguradorAdmin(empleado)) {
    nav.push({ key: 'grupo-config', label: t.configuracion, icon: SlidersHorizontal, children: [
        { key: RUTAS.rolesPermisos, label: t.rolesPermisos },
        { key: RUTAS.baselines, label: t.baselines },
      ],
    });
  }

  return nav;
}

/** El destino del menú que corresponde a una URL (la más larga que la contenga). */
export function claveSeleccionada(nav: NavNode[], ruta: string): string | undefined {
  const hojas = nav.flatMap(function h(n: NavNode): string[] { return n.children ? n.children.flatMap(h) : [n.key]; });
  return hojas
    .filter((k) => k.startsWith('/') && (k === ruta || (k !== '/' && ruta.startsWith(k + '/'))))
    .sort((a, b) => b.length - a.length)[0];
}

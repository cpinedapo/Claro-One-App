/**
 * Cómo se llaman los roles en el producto (H-008).
 *
 * El catálogo de 5 roles viene del kit (`ROLES`) y se respeta entero. Lo único que el producto
 * cambia es el NOMBRE visible de uno: «Configurador / Admin» se muestra como **Administrador**.
 *
 * Por dentro no cambia nada: el id sigue siendo `configurador-admin`, y el contrato de Roles y
 * Permisos sigue concediendo sus acciones a `roles: ['Configurador / Admin']`, que es el nombre con
 * que `actorPara` arma al actor. Por eso el renombre vive aquí, en la presentación, y no en el actor.
 *
 * Puro: sin React, sin antd, sin base de datos.
 */
import { ROLES, nombreArea, rolPorId } from '@arc2-0/claro-one-kit/dominio';
import type { Actor } from '@arc2-0/claro-one-kit/capacidad';
import type { Asignacion, Rol } from '@arc2-0/claro-one-kit/dominio';
import type { Idioma } from '@/i18n/idioma';
import { areaEstandarDeKit } from './areas';

/** Solo los roles cuyo nombre cambia en el producto. El resto ya viene en inglés del catálogo. */
const NOMBRE_EN_PRODUCTO: Record<Idioma, Record<string, string>> = {
  es: { 'configurador-admin': 'Administrador' },
  en: { 'configurador-admin': 'Administrator' },
};

/** El nombre visible de un rol, por id. */
export const nombreRol = (rolId: string, idioma: Idioma = 'es'): string =>
  NOMBRE_EN_PRODUCTO[idioma][rolId] ?? rolPorId(rolId)?.nombre ?? rolId;

/** El catálogo del kit con los nombres del producto. Para selectores y listados. */
export const rolesProducto = (idioma: Idioma = 'es'): Rol[] => ROLES.map((r) => ({ ...r, nombre: nombreRol(r.id, idioma) }));

const TODA_LA_EMPRESA: Record<Idioma, string> = { es: 'Toda la empresa', en: 'Whole company' };

/**
 * «Manager · Commercial», «Administrador · Toda la empresa». El alcance lo da el rol y el área es una de las 8
 * estándar (H-036); la LOB ya no va en el rol, es un dato del área.
 */
export function etiquetaRol(a: Pick<Asignacion, 'rolId' | 'alcanceTipo' | 'alcanceValor' | 'lob'>, idioma: Idioma = 'es'): string {
  const donde = a.alcanceTipo === 'global' ? TODA_LA_EMPRESA[idioma] : (areaEstandarDeKit(a.alcanceValor) ?? (a.alcanceValor ? nombreArea(a.alcanceValor) : '—'));
  return `${nombreRol(a.rolId, idioma)} · ${donde}`;
}

/** Un actor listo para MOSTRAR (sello en la confirmación). Nunca se manda al contrato: allí el rol
 *  tiene que ir con el nombre del catálogo. */
export function actorVisible(actor: Actor, idioma: Idioma = 'es'): Actor {
  const rol = ROLES.find((r) => r.nombre === actor.rol);
  return rol ? { ...actor, rol: nombreRol(rol.id, idioma) } : actor;
}

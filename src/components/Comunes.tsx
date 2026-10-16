'use client';
/**
 * Piezas que usan dos o más features. Los componentes del kit no traen la directiva `'use client'`,
 * así que una página de servidor no los puede renderizar directo: pasan por aquí.
 */
import type { ReactNode } from 'react';
import { PageContainer, VacioConMotivo } from '@arc2-0/claro-one-kit';
import { useIdioma } from '@/i18n/cliente';

/** El encabezado de toda pantalla: migas, título y, si aplica, el área dueña. */
export function Pagina({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <PageContainer title={titulo} breadcrumb={[{ title: 'Claro One' }, { title: titulo }]} {...(subtitulo ? { subTitle: subtitulo } : {})}>
      {children}
    </PageContainer>
  );
}

/** Vacío con motivo para «estás dentro, pero esto no cae en tu alcance». */
export function FueraDeAlcance({ nombre, que }: { nombre: string; que: string }) {
  const { m } = useIdioma();
  return (
    <VacioConMotivo
      titulo={m.alcance.fueraTitulo(que)}
      motivo={m.alcance.fueraMotivo(nombre)}
      pie="Principio de interfaz · roles-permisos-spec.md §8"
    />
  );
}

/** Un destino del menú que todavía no se construye: dice por qué está vacío y qué contendrá. */
export function ModuloPendiente({ titulo, motivo }: { titulo: string; motivo: string }) {
  return <VacioConMotivo titulo={titulo} motivo={motivo} />;
}

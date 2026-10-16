/**
 * La plantilla de carga masiva de territorios (H-039), **solo con su fila de encabezados**. Las columnas son las de la
 * plantilla del negocio (`Public/territory_template.csv`) y salen de la misma lista que valida la carga
 * (`COLUMNAS_TERRITORIO`): la plantilla y la validación no pueden separarse.
 */
import { COLUMNAS_TERRITORIO } from '@/dominio/territorios';
import { sesionActual } from '@/server/sesion';

export async function GET() {
  if (!(await sesionActual())?.empleado) return new Response(null, { status: 401 });
  return new Response(COLUMNAS_TERRITORIO.join(',') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="territory_template.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}

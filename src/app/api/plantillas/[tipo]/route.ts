/**
 * La plantilla de importación de un tipo de lead (H-025), **solo con su fila de encabezados**: las plantillas del
 * negocio en `public/` traen filas de ejemplo que no deben llegar a una carga real. Sin asteriscos: lo obligatorio lo
 * explica la pantalla («Reglas del archivo»).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PLANTILLAS, TIPOS_IMPORTACION } from '@/dominio/importacion';
import type { TipoLead } from '@/dominio/leads';
import { sesionActual } from '@/server/sesion';
import { leerPrimeraHoja, plantillaXlsx } from '@/server/xlsx';

export async function GET(_: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS_IMPORTACION.includes(tipo as TipoLead)) return new Response(null, { status: 404 });
  if (!(await sesionActual())?.empleado) return new Response(null, { status: 401 });
  const archivo = PLANTILLAS[tipo as TipoLead];
  const original = await readFile(join(process.cwd(), 'public', archivo));
  const [encabezados] = leerPrimeraHoja(original);
  const cuerpo = plantillaXlsx(tipo === 'benefit-coordinator' ? 'Benefit Coordinators' : 'Leads', (encabezados?.celdas ?? []).map((h) => h.replaceAll('*', '').trim()));
  return new Response(new Uint8Array(cuerpo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

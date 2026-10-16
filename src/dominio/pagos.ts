/**
 * A quién se le paga y qué datos de pago exige (H-023, regla del negocio 2026-10-15).
 *
 * La comisión y el bono se le pagan a la **Agencia**, a la **Subagencia** o al **Agente**. Se define solo en
 * la Master Agency (la raíz de la jerarquía) y toda su jerarquía lo hereda. Si comisión y bono van a niveles
 * distintos, se suman los requisitos de los dos.
 *
 * | Nivel       | Master Agency            | Subagencias              | Agentes y vendedores sin licencia |
 * | :--         | :--                      | :--                      | :--                               |
 * | Agencia     | contact payee + códigos  | no tienen (ni se ven)    | —                                 |
 * | Subagencia  | contact payee + códigos  | contact payee + códigos  | —                                 |
 * | Agente      | contact payee + códigos  | no tienen (ni se ven)    | código por compañía en que produce |
 *
 * «Códigos» = un payment code por cada compañía a la que pertenece (Payment Account · E-051). Un
 * representante que no es agente y el staff no llevan código de pago; el que es agente usa el suyo de agente.
 * Un **agente independiente** (sin agencia vigente) cobra él mismo: su código es obligatorio (H-024).
 *
 * A todo el que se le exige payment code se le exigen también sus **documentos de pago aprobados** (W9, Direct
 * Deposit, Voided Check). Se aprueban en el Onboarding; el Directorio solo los muestra (H-024).
 *
 * Puro: sin React, sin antd, sin base.
 */

export const NIVELES_PAGO = ['agencia', 'subagencia', 'agente'] as const;
export type NivelPago = (typeof NIVELES_PAGO)[number];

/** Lo que estas reglas necesitan de una agencia. */
export interface AgenciaPago {
  id: string;
  parentId: string | null;
  comisionPagadaA: string | null;
  bonoPagadoA: string | null;
}

/** La Master Agency de una agencia: se sube por `parentId` hasta la raíz. */
export function masterDe<A extends AgenciaPago>(agencias: A[], id: string): A | undefined {
  let actual = agencias.find((a) => a.id === id);
  const vistos = new Set<string>();
  while (actual?.parentId && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    const padre = agencias.find((a) => a.id === actual!.parentId);
    if (!padre) break;
    actual = padre;
  }
  return actual;
}

/** Los niveles a los que paga una jerarquía (comisión y bono juntos). */
export function nivelesDe(master: Pick<AgenciaPago, 'comisionPagadaA' | 'bonoPagadoA'> | undefined): Set<NivelPago> {
  const n = new Set<NivelPago>();
  for (const v of [master?.comisionPagadaA, master?.bonoPagadoA]) if (v && (NIVELES_PAGO as readonly string[]).includes(v)) n.add(v as NivelPago);
  return n;
}

/** Qué datos de pago lleva una agencia: si se muestran y si son obligatorios. */
export function pagoDeAgencia(esMaster: boolean, niveles: Set<NivelPago>): { lleva: boolean; obligatorio: boolean } {
  if (esMaster) return { lleva: true, obligatorio: niveles.size > 0 };
  const lleva = niveles.has('subagencia');
  return { lleva, obligatorio: lleva };
}

/**
 * ¿Se le exige payment code a un agente o vendedor sin licencia? Sí si alguna de sus agencias paga al agente, o si
 * es un agente independiente (sin agencia vigente: cobra él mismo).
 */
export function exigeCodigoPersona(agenciasIds: string[], agencias: AgenciaPago[], { esAgente = false } = {}): boolean {
  if (esAgente && agenciasIds.length === 0) return true;
  return agenciasIds.some((id) => nivelesDe(masterDe(agencias, id)).has('agente'));
}

/** Las compañías a las que les falta payment code, entre las que se exigen. */
export function codigosFaltantes(companias: string[], codigos: { claro: string | null; atoz: string | null }): string[] {
  return companias.filter((c) => !(c === 'atoz' ? codigos.atoz : codigos.claro));
}

/* ------------------------------------------------------- documentos de pago (H-024) */

export const DOCUMENTOS_PAGO = ['w9', 'direct_deposit', 'voided_check'] as const;
export type DocumentoPago = (typeof DOCUMENTOS_PAGO)[number];
export type EstadoDocumentoPago = 'pendiente' | 'recibido' | 'aprobado' | 'rechazado';
/** El estado de negocio del kit de cada estado de un documento (color e icono, GLB-R07). */
export const ESTADO_NEGOCIO_DE_DOCUMENTO: Record<EstadoDocumentoPago, string> = { pendiente: 'pending', recibido: 'waiting', aprobado: 'ok', rechazado: 'blocked' };

export type TitularPago = 'agente' | 'vendedor' | 'agencia';
export interface DocumentoPagoRegistro {
  titular: TitularPago;
  titularId: string;
  documento: DocumentoPago;
  estado: EstadoDocumentoPago;
  revisado: string | null;
  nota: string | null;
}

/** El estado de los tres documentos de un titular; el que no tiene fila está pendiente. */
export function documentosDe(docs: DocumentoPagoRegistro[], titular: TitularPago, id: string): { documento: DocumentoPago; estado: EstadoDocumentoPago; revisado: string | null; nota: string | null }[] {
  return DOCUMENTOS_PAGO.map((documento) => {
    const d = docs.find((x) => x.titular === titular && x.titularId === id && x.documento === documento);
    return { documento, estado: d?.estado ?? 'pendiente', revisado: d?.revisado ?? null, nota: d?.nota ?? null };
  });
}

/** ¿Tiene los tres documentos de pago aprobados? */
export const documentosAprobados = (docs: DocumentoPagoRegistro[], titular: TitularPago, id: string) =>
  documentosDe(docs, titular, id).every((d) => d.estado === 'aprobado');

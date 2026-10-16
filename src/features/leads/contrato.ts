/**
 * CONTRATO DE LA CAPABILITY · Comercial (Lead Management)
 *
 * Traído del prototipo PB-002 v2.6 (`capacidades.js` → `comercial`): asignar un lead y registrar el
 * resultado de una interacción, cada una con su versión de IA que solo PROPONE (IA-2, IA-3, D-011:
 * una IA propone por defecto; una persona con permiso ejecuta).
 *
 * Ajustes del producto (H-021):
 * - Los roles de negocio del prototipo («Manager de New Business», «Especialista comercial») se
 *   mapean a los del kit: asignar = Manager; registrar = Doer o Manager. Hipótesis: el Administrador
 *   también puede, para operar y probar la plataforma.
 * - Cada acción exige además su permiso de Leads, que se enciende por persona (H-032): editar o importar.
 * - Territorio y responsable (H-042): el territorio de un lead sale de su ZIP; Ask Claro propone el de los ZIP que no
 *   están en ninguno; asignar (uno o todos) pide a un Doer de New Business que atienda el tipo de cliente, cubra las LOB
 *   y el territorio del lead, el de menos carga. Un lead con ZIP sin territorio no se asigna hasta resolverlo.
 * - `crear-interaccion` es nueva: el prototipo creaba la interacción desde el Calendario y el detalle
 *   del lead sin contrato (su §11). Aquí ninguna acción va sin contrato.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';
import { ESTADOS_COMERCIALES, MOTIVOS_CIERRE, RESULTADOS, TIPOS_INTERACCION, sugerirResponsable, sugerirResultado } from '@/dominio/leads';
import type { FamiliaCierre, InteraccionComercial, Lead, Resultado, TipoInteraccionComercial, TipoLead } from '@/dominio/leads';
import { MAX_FILAS, TIPOS_IMPORTACION, claveLead, esStatusInicial, validarImportacion } from '@/dominio/importacion';
import type { ErrorFila, FilaCruda, ImportacionHecha, LeadImportado } from '@/dominio/importacion';
import type { OpcionBaseline } from '@/dominio/baselines';
import { candidatosPara, listoParaAsignar, motivoRegla, porAsignarTerritorio, proponerTerritorios, reglaDe, territorioDeZip, tieneTerritorio, zipDeLead, zipsSinTerritorio } from '@/dominio/territorioLeads';
import type { CandidatoLead, TerritorioZip } from '@/dominio/territorioLeads';
import { PERMISOS_LEADS } from '@/dominio/permisos';
import type { PermisoLeads } from '@/dominio/permisos';

export type OperacionLead =
  | { tipo: 'asignar'; leadId: string; empleadoId: string }
  | { tipo: 'territorio'; leadId: string; territorio: string }
  | { tipo: 'resultado'; interaccionId: string; resultado: Resultado; familia: FamiliaCierre | null; motivo: string | null; siguientePaso: string | null }
  | { tipo: 'eliminar-importacion'; id: string; leadIds: string[]; por: string }
  | { tipo: 'importar'; importacion: { tipo: TipoLead; archivo: string; total: number; creadoPor: string; errores: ErrorFila[] }; leads: LeadImportado[] }
  | { tipo: 'crear-interaccion'; interaccion: Omit<InteraccionComercial, 'id' | 'resultado' | 'familiaResultado' | 'motivoResultado' | 'siguientePaso' | 'ordenRuta' | 'disposicion' | 'primera' | 'seguimiento' | 'personaContactada'> };

export interface EstadoComercial {
  leads: Lead[];
  interacciones: InteraccionComercial[];
  empleados: Empleado[];
  hoy: string;
  operaciones: OperacionLead[];
  /** Lo vigente en Datos base que la importación exige (H-025). */
  catalogo: { lobs: OpcionBaseline[]; estados: string[] };
  /** Las importaciones hechas (H-026). */
  importaciones: ImportacionHecha[];
  /** Los permisos de quien ejecuta (H-032): Leads se enciende por persona. */
  permisosActor: string[];
  /** Los territorios vigentes de Datos base, con sus ZIP (H-042). */
  territorios: TerritorioZip[];
  /** Los Doer de New Business con lo que atienden (H-042). */
  candidatos: CandidatoLead[];
}

/** Los leads abiertos de cada persona: la carga que desempata (H-042). */
const cargaDe = (leads: Lead[]) => (empleadoId: string) => leads.filter((p) => p.fase === 'lead' && p.responsableId === empleadoId && !p.cierre).length;

/** Los leads sobre los que actúa una acción de territorio o de asignación: todos, o los de una importación (H-043). */
function alcanceDe(estado: EstadoComercial, entrada: EntradaAccion): Lead[] | { error: string } {
  const id = (entrada.importacionId ?? '').trim();
  if (!id) return estado.leads;
  if (!estado.importaciones.some((i) => i.id === id && !i.eliminada)) return { error: 'Esa importación no existe o fue eliminada.' };
  return estado.leads.filter((l) => l.importacionId === id);
}

/** Un lead con ZIP sin territorio no se asigna todavía (H-042). */
function exigeTerritorio(estado: EstadoComercial, l: Lead) {
  if (listoParaAsignar(l, estado.territorios)) return null;
  return { error: `${l.nombre} tiene el ZIP ${zipDeLead(l)} sin territorio: resuélvelo primero con «Resolver territorios».` };
}

/** Ver, editar, importar y convertir leads son permisos por persona (H-032): sin el suyo, el contrato rechaza. */
function exigePermiso(estado: EstadoComercial, permiso: PermisoLeads) {
  if (estado.permisosActor.includes(permiso)) return null;
  const nombre = PERMISOS_LEADS.find((p) => p.id === permiso)?.nombre ?? permiso;
  return { error: `No tienes el permiso «${nombre}». Lo enciende un Administrador en Roles y Permisos.` };
}

const ASIGNA = ['Manager', 'Configurador / Admin'];
const TRABAJA = ['Doer', 'Manager', 'Coordinator', 'Configurador / Admin'];
const texto = (v: string | null | undefined) => (v ?? '').trim();
const nombreDe = (e: EstadoComercial, id: string | null) => (id ? (e.empleados.find((x) => x.id === id)?.nombre ?? id) : 'Sin asignar');
const ETIQUETA_RESULTADO: Record<Resultado, string> = { exitosa: 'Exitosa', 'no-interesado': 'No interesado', 'sin-exito': 'Sin éxito' };

export const CAPACIDAD_COMERCIAL = crearCapacidad<EstadoComercial>({
  id: 'comercial',
  nombre: 'Comercial: asignación de leads y resultado de las interacciones',
  journey: 'Hipótesis: del primer contacto al agente contratado, en un solo recorrido (hoy partido entre dos herramientas)',
  entidades: ['Prospect (lead de agente o agencia; hipótesis de nombre)', 'Interacción comercial · hipótesis', 'Internal Actor · E-006'],
  estados: {
    pending: { etiqueta: 'Abierto', responsable: 'Responsable del lead' },
    neutral: { etiqueta: 'Cerrado con motivo', responsable: 'Responsable del lead' },
  },

  acciones: [
    {
      id: 'asignar-lead',
      nombre: 'Asignar un lead',
      descripcion: 'Define quién trabaja el lead. Hoy no hay reglas de asignación en la captación y hay leads sin responsable.',
      quien: [{ tipo: 'human', roles: ASIGNA }],
      canales: ['ui'],
      entrada: { leadId: 'id', empleadoId: 'id de empleado' },
      consecuencia: {
        cambia: 'El responsable del lead.',
        noCambia: 'Su etapa, sus interacciones y su historial.',
        alcance: 'Este lead.',
        requiere: 'Que el lead y la persona existan.',
        registro: 'Quién asignó, a quién y cuándo.',
      },
      regla: 'C-4 · IA-2 · prototipo PB-002 v2.6 · propuesta: asignar por territorio, línea, idioma y carga',
      emite: ['prospect.assigned'],
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const l = estado.leads.find((x) => x.id === entrada.leadId);
        if (!l) return { error: 'Ese lead no existe.' };
        const sinTerritorio = exigeTerritorio(estado, l);
        if (sinTerritorio) return sinTerritorio;
        if (!estado.empleados.some((e) => e.id === entrada.empleadoId)) return { error: 'Esa persona no existe.' };
        if (l.responsableId === entrada.empleadoId) return { error: 'Ese lead ya está asignado a esa persona.' };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, { tipo: 'asignar', leadId: l.id, empleadoId: entrada.empleadoId! }] },
          cambios: [{ entidad: 'Prospect', id: l.nombre, de: nombreDe(estado, l.responsableId), a: nombreDe(estado, entrada.empleadoId!) }],
          salida: `${l.nombre} quedó con ${nombreDe(estado, entrada.empleadoId!)}.`,
        };
      },
    },
    {
      id: 'sugerir-asignacion-lead',
      nombre: 'Sugerir responsable para un lead',
      descripcion: 'IA-2. Solo propone el responsable por línea y carga. Una persona con permiso asigna.',
      quien: [{ tipo: 'ai-agent', modo: 'propone' }],
      canales: ['tool'],
      soloLectura: true,
      entrada: { leadId: 'id' },
      consecuencia: { cambia: 'Nada.', registro: 'Qué se sugirió y por qué, para auditar a la IA igual que a una persona.' },
      regla: 'IA-2 · una IA propone por defecto (D-011)',
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const l = estado.leads.find((x) => x.id === entrada.leadId);
        if (!l) return { error: 'Ese lead no existe.' };
        if (!listoParaAsignar(l, estado.territorios)) return { estado, cambios: [], salida: `${l.nombre} tiene el ZIP ${zipDeLead(l)} sin territorio: primero hay que resolverlo.` };
        const [s] = candidatosPara(l, estado.candidatos, estado.territorios, cargaDe(estado.leads));
        if (!s) return { estado, cambios: [], salida: `Ningún ${motivoRegla(l, estado.territorios)}.` };
        return {
          estado,
          cambios: [],
          salida: `Sugiero asignar ${l.nombre} a ${s.nombre}: es ${motivoRegla(l, estado.territorios)}, y tiene ${s.carga} leads abiertos, la menor carga entre quienes cumplen.`,
          datos: { sugerencias: [{ accionId: 'asignar-lead', entrada: { leadId: l.id, empleadoId: s.empleadoId } }], regla: reglaDe(l, tieneTerritorio(l, estado.territorios)) },
        };
      },
    },
    {
      id: 'registrar-resultado-interaccion',
      nombre: 'Registrar el resultado de una interacción',
      descripcion: 'Deja el resultado, el motivo (si no hubo interés o contacto) y el siguiente paso.',
      quien: [{ tipo: 'human', roles: TRABAJA }],
      canales: ['ui'],
      entrada: { interaccionId: 'id', resultado: RESULTADOS.join(' | '), familia: 'no-contactable | no-interesado (opcional)', motivo: 'opcional', siguientePaso: 'opcional' },
      consecuencia: {
        cambia: 'El resultado y el siguiente paso de la interacción.',
        noCambia: 'La etapa del lead.',
        alcance: 'Esta interacción.',
        requiere: 'Un resultado y, si no fue exitosa, por qué.',
        registro: 'Quién lo registró y cuándo.',
      },
      regla: 'C-10 · IA-3 · prototipo PB-002 v2.6',
      emite: ['interaction.logged'],
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const i = estado.interacciones.find((x) => x.id === entrada.interaccionId);
        if (!i) return { error: 'Esa interacción no existe.' };
        const resultado = entrada.resultado as Resultado;
        if (!RESULTADOS.includes(resultado)) return { error: 'Falta el resultado.' };
        const familia = (texto(entrada.familia) || null) as FamiliaCierre | null;
        if (familia && !(familia in MOTIVOS_CIERRE)) return { error: 'Ese motivo no está en el catálogo.' };
        if (resultado !== 'exitosa' && !familia) return { error: 'Di por qué no se logró: no contactable o no interesado.' };
        const motivo = texto(entrada.motivo) || null;
        if (familia && motivo && !MOTIVOS_CIERRE[familia].includes(motivo)) return { error: 'Ese motivo no está en el catálogo.' };
        return {
          estado: {
            ...estado,
            operaciones: [...estado.operaciones, { tipo: 'resultado', interaccionId: i.id, resultado, familia: resultado === 'exitosa' ? null : familia, motivo: resultado === 'exitosa' ? null : motivo, siguientePaso: texto(entrada.siguientePaso) || null }],
          },
          cambios: [{ entidad: 'Interacción comercial', id: i.nombre, de: i.resultado ? ETIQUETA_RESULTADO[i.resultado] : 'Sin registrar', a: ETIQUETA_RESULTADO[resultado], motivo: texto(entrada.siguientePaso) }],
        };
      },
    },
    {
      id: 'sugerir-resultado-interaccion',
      nombre: 'Sugerir el resultado de una interacción',
      descripcion: 'IA-3. Lee la nota (en el TARGET, la transcripción) y propone resultado, motivo y siguiente paso.',
      quien: [{ tipo: 'ai-agent', modo: 'propone' }],
      canales: ['tool'],
      soloLectura: true,
      entrada: { interaccionId: 'id' },
      consecuencia: { cambia: 'Nada.', registro: 'Qué se sugirió y por qué.' },
      regla: 'IA-3 · una IA propone por defecto (D-011)',
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const i = estado.interacciones.find((x) => x.id === entrada.interaccionId);
        if (!i) return { error: 'Esa interacción no existe.' };
        const s = sugerirResultado(i);
        return {
          estado,
          cambios: [],
          salida: `${s.razon} Resultado sugerido: ${ETIQUETA_RESULTADO[s.resultado]}${s.motivo ? ` (${s.motivo})` : ''}. Siguiente paso: ${s.siguientePaso}`,
          datos: {
            sugerencias: [
              { accionId: 'registrar-resultado-interaccion', entrada: { interaccionId: i.id, resultado: s.resultado, familia: s.familia ?? '', motivo: s.motivo ?? '', siguientePaso: s.siguientePaso } },
            ],
          },
        };
      },
    },
    {
      id: 'importar-leads',
      nombre: 'Importar leads',
      descripcion: 'Carga masiva de leads desde la plantilla .xlsx de su tipo. Entran las filas válidas; las demás quedan con su motivo.',
      quien: [{ tipo: 'human', roles: TRABAJA }],
      canales: ['ui'],
      entrada: { tipo: 'agencia | agente | vendedor-sin-npn | benefit-coordinator', archivo: 'nombre del archivo', filas: 'JSON: [{ fila, valores }]' },
      consecuencia: {
        cambia: 'Se crean como leads nuevos, sin responsable, las filas válidas del archivo.',
        noCambia: 'Los leads que ya existen: un lead con el mismo nombre y teléfono no se vuelve a crear.',
        alcance: 'Las filas válidas de este archivo.',
        requiere: 'Que el 100 % de las filas sea válido: lo obligatorio de la plantilla; LOB, estado, fuente e idiomas de las listas permitidas; prioridad High, Medium o Low.',
        registro: 'Quién importó qué archivo, cuántas filas entraron y por qué se rechazó cada una.',
      },
      regla: 'H-025 · decisión de negocio 2026-10-15 · plantillas de importación del negocio',
      emite: ['prospect.imported'],
      aplicar(estado, entrada, actor) {
        const sinPermiso = exigePermiso(estado, 'leads.importar');
        if (sinPermiso) return sinPermiso;
        const tipo = entrada.tipo as TipoLead;
        if (!TIPOS_IMPORTACION.includes(tipo)) return { error: 'Elige el tipo de lead.' };
        const archivo = texto(entrada.archivo) || 'archivo.xlsx';
        let filas: FilaCruda[];
        try {
          filas = JSON.parse(entrada.filas ?? '[]') as FilaCruda[];
        } catch {
          return { error: 'No se pudo leer el archivo.' };
        }
        if (!Array.isArray(filas) || !filas.length) return { error: 'El archivo no tiene filas.' };
        if (filas.length > MAX_FILAS) return { error: `Un archivo tiene hasta ${MAX_FILAS} filas.` };
        const existentes = new Set(estado.leads.map((l) => claveLead(l.nombre, l.telefonos[0] ?? l.contacto.telefono)));
        const r = validarImportacion(tipo, filas, estado.catalogo, existentes);
        // Un archivo entra completo o no entra (H-026).
        const conError = new Set(r.errores.map((e) => e.fila)).size;
        if (conError) return { error: `El archivo tiene ${conError} ${conError === 1 ? 'fila' : 'filas'} con error: corrígelas y vuelve a subirlo.` };
        return {
          estado: {
            ...estado,
            operaciones: [
              ...estado.operaciones,
              { tipo: 'importar', importacion: { tipo, archivo, total: filas.length, creadoPor: actor?.id ?? '', errores: r.errores }, leads: r.validos.map((v) => ({ ...v.lead, territorio: territorioDeZip(zipDeLead(v.lead), estado.territorios)?.codigo ?? null })) },
            ],
          },
          cambios: [{ entidad: 'Prospect', id: archivo, de: '—', a: `${r.validos.length} leads`, motivo: r.errores.length ? `${new Set(r.errores.map((e) => e.fila)).size} filas rechazadas` : 'sin rechazos' }],
          salida: `Se importaron ${r.validos.length} leads de ${archivo}.`,
        };
      },
    },
    {
      id: 'eliminar-importacion',
      nombre: 'Eliminar una importación',
      descripcion: 'Borra los leads que entraron con un archivo, si todos siguen en «New». La importación queda en el historial como eliminada.',
      quien: [{ tipo: 'human', roles: TRABAJA }],
      canales: ['ui'],
      entrada: { importacionId: 'id' },
      consecuencia: {
        cambia: 'Los leads de ese archivo salen del pool de leads.',
        noCambia: 'Los demás leads. La importación queda en el historial, marcada como eliminada, con quién y cuándo.',
        alcance: 'Los leads de esta importación.',
        requiere: 'Que todos sus leads sigan en status «New» y sin interacciones.',
        registro: 'Quién la eliminó, cuándo y qué leads salieron.',
      },
      regla: 'H-026 · decisión de negocio 2026-10-15',
      emite: ['prospect.import-deleted'],
      aplicar(estado, entrada, actor) {
        const sinPermiso = exigePermiso(estado, 'leads.importar');
        if (sinPermiso) return sinPermiso;
        const im = estado.importaciones.find((x) => x.id === entrada.importacionId);
        if (!im) return { error: 'Esa importación no existe.' };
        if (im.eliminada) return { error: 'Esa importación ya se eliminó.' };
        const suyos = estado.leads.filter((l) => l.importacionId === im.id);
        const trabajado = suyos.find((l) => !esStatusInicial(l.disposicion));
        if (trabajado) return { error: `No se puede eliminar: ${trabajado.nombre} ya no está en «New» (${trabajado.disposicion}).` };
        const conInteracciones = suyos.find((l) => estado.interacciones.some((i) => i.leadId === l.id));
        if (conInteracciones) return { error: `No se puede eliminar: ${conInteracciones.nombre} ya tiene interacciones.` };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, { tipo: 'eliminar-importacion', id: im.id, leadIds: suyos.map((l) => l.id), por: actor?.id ?? '' }] },
          cambios: suyos.map((l) => ({ entidad: 'Prospect', id: l.nombre, de: 'New', a: 'eliminado', motivo: im.archivo })),
          salida: `Se eliminó la importación ${im.archivo}: salieron ${suyos.length} leads.`,
        };
      },
    },
    {
      id: 'crear-interaccion',
      nombre: 'Agendar o registrar una interacción con un lead',
      descripcion: 'Una llamada, visita, reunión o evento con un lead. Es la misma fila en el lead, en el Plan semanal, en la Ruta diaria y en el Calendario.',
      quien: [{ tipo: 'human', roles: TRABAJA }],
      canales: ['ui'],
      entrada: {
        leadId: 'id', tipo: TIPOS_INTERACCION.join(' | '), fecha: 'AAAA-MM-DD', estado: `${ESTADOS_COMERCIALES.join(' | ')} (pending si aún no se hace)`,
        motivo: 'string', notas: 'opcional', origen: 'Calendario | Detalle de lead | Plan semanal',
      },
      consecuencia: {
        cambia: 'Aparece de inmediato en el lead, en el Plan semanal, en la Ruta diaria (si es visita) y en el Calendario de quien la crea.',
        noCambia: 'La etapa y el responsable del lead.',
        alcance: 'Una interacción.',
        requiere: 'Un lead que exista, el tipo, la fecha y el motivo.',
        registro: 'Quién la creó, desde dónde y cuándo.',
      },
      regla: 'Decimosexta extensión del prototipo (misma cola, no una copia) · H-021: acción nueva con contrato',
      emite: ['interaction.created'],
      aplicar(estado, entrada, actor) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const l = estado.leads.find((x) => x.id === entrada.leadId);
        if (!l) return { error: 'Elige el lead.' };
        const tipo = entrada.tipo as TipoInteraccionComercial;
        if (!TIPOS_INTERACCION.includes(tipo)) return { error: 'Elige el tipo de interacción.' };
        const fecha = texto(entrada.fecha);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Elige la fecha.' };
        const est = texto(entrada.estado) || 'pending';
        if (!(ESTADOS_COMERCIALES as readonly string[]).includes(est)) return { error: 'Ese estado no existe.' };
        const motivo = texto(entrada.motivo);
        if (!motivo) return { error: 'Falta el motivo.' };
        const etiquetaTipo = { llamada: 'Llamada', visita: 'Visita', reunion: 'Reunión', evento: 'Evento' }[tipo];
        return {
          estado: {
            ...estado,
            operaciones: [
              ...estado.operaciones,
              {
                tipo: 'crear-interaccion',
                interaccion: {
                  leadId: l.id, tipo, fecha, estado: est, motivo, empleadoId: actor?.id ?? null, nombre: `${etiquetaTipo} · ${l.nombre}`, notas: texto(entrada.notas) || null,
                  origen: texto(entrada.origen) || 'Manual', contactoNombre: l.contacto.nombre ?? l.nombre,
                },
              },
            ],
          },
          cambios: [{ entidad: 'Interacción comercial', id: `${etiquetaTipo} · ${l.nombre}`, de: '—', a: fecha, motivo }],
          salida: `Se agendó la ${etiquetaTipo.toLowerCase()} con ${l.nombre}.`,
        };
      },
    },
    {
      id: 'asignar-territorios',
      nombre: 'Asignar territorio por ZIP',
      descripcion: 'A cada lead con ZIP le pone el territorio de Datos base que contiene ese ZIP (H-042).',
      quien: [{ tipo: 'human', roles: TRABAJA }],
      canales: ['ui'],
      entrada: { importacionId: 'opcional: solo los leads de esa importación' },
      consecuencia: {
        cambia: 'El territorio de los leads cuyo ZIP está en un territorio y todavía no lo tienen.',
        noCambia: 'Los leads sin ZIP, ni los que tienen un ZIP que no está en ningún territorio.',
        alcance: 'Los leads con ZIP.',
        registro: 'Quién lo hizo, cuándo y el territorio de cada lead.',
      },
      regla: 'H-042 · decisión de producto 2026-10-15',
      emite: ['prospect.territory-assigned'],
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const alcance = alcanceDe(estado, entrada);
        if ('error' in alcance) return alcance;
        const lista = porAsignarTerritorio(alcance, estado.territorios);
        if (!lista.length) return { error: 'No hay leads con ZIP esperando su territorio.' };
        const nombreT = (c: string) => estado.territorios.find((t) => t.codigo === c)?.nombre ?? c;
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, ...lista.map((x) => ({ tipo: 'territorio' as const, ...x }))] },
          cambios: lista.map((x) => {
            const l = estado.leads.find((y) => y.id === x.leadId)!;
            return { entidad: 'Prospect', id: `${l.nombre} · territorio`, de: l.territorio ?? '—', a: nombreT(x.territorio), motivo: `ZIP ${zipDeLead(l)}` };
          }),
          salida: `${lista.length} ${lista.length === 1 ? 'lead quedó' : 'leads quedaron'} con su territorio.`,
        };
      },
    },
    {
      id: 'sugerir-territorios',
      nombre: 'Proponer territorio para los ZIP sin territorio',
      descripcion: 'Ask Claro propone, para cada ZIP que no está en ningún territorio, uno existente con su confianza o uno nuevo con su estado. Solo propone.',
      quien: [{ tipo: 'ai-agent', modo: 'propone' }],
      canales: ['tool'],
      soloLectura: true,
      entrada: { importacionId: 'opcional: solo los ZIP de los leads de esa importación' },
      consecuencia: { cambia: 'Nada.', registro: 'Qué propuso y por qué, para auditar la propuesta igual que a una persona.' },
      regla: 'H-042 · regla local sin IA externa (decisión de la usuaria, 2026-10-15) · una IA propone por defecto (D-011)',
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const alcance = alcanceDe(estado, entrada);
        if ('error' in alcance) return alcance;
        const sin = zipsSinTerritorio(alcance, estado.territorios);
        if (!sin.length) return { estado, cambios: [], salida: 'Todos los ZIP de los leads ya están en un territorio.' };
        const propuestas = proponerTerritorios(sin, estado.territorios, estado.leads);
        const nuevos = propuestas.filter((p) => p.tipo === 'nuevo').length;
        return {
          estado,
          cambios: [],
          salida: `Revisé ${sin.length} ZIP sin territorio: ${sin.length - nuevos} encajan en uno existente y ${nuevos} piden un territorio nuevo.`,
          datos: { propuestas },
        };
      },
    },
    {
      id: 'asignar-leads',
      nombre: 'Asignar los leads sin responsable',
      descripcion: 'Asigna de una vez cada lead sin responsable al Doer de New Business que cumple la regla y tiene menos carga (H-042).',
      quien: [{ tipo: 'human', roles: ASIGNA }],
      canales: ['ui'],
      entrada: { importacionId: 'opcional: solo los leads de esa importación' },
      consecuencia: {
        cambia: 'El responsable de los leads abiertos sin responsable que tienen a alguien que cumple la regla.',
        noCambia: 'Los que ya tienen responsable, ni los que no tienen a nadie que cumpla: quedan sin asignar, con el motivo.',
        alcance: 'Los leads abiertos sin responsable.',
        requiere: 'Que ningún lead tenga un ZIP sin territorio.',
        registro: 'Quién asignó, a quién quedó cada lead y con qué regla.',
      },
      regla: 'H-042 · tipo de cliente + LOB + territorio; sin territorio o sin LOB se ignora ese dato · desempata la menor carga',
      emite: ['prospect.assigned'],
      aplicar(estado, entrada) {
        const sinPermiso = exigePermiso(estado, 'leads.editar');
        if (sinPermiso) return sinPermiso;
        const alcance = alcanceDe(estado, entrada);
        if ('error' in alcance) return alcance;
        const sin = zipsSinTerritorio(alcance, estado.territorios);
        if (sin.length) return { error: `Hay ${sin.reduce((n, g) => n + g.leads.length, 0)} leads con ZIP sin territorio: resuélvelos primero.` };
        const pendientes = alcance.filter((l) => l.fase === 'lead' && !l.responsableId && !l.cierre);
        if (!pendientes.length) return { error: 'No hay leads abiertos sin responsable.' };
        // La carga crece con cada asignación: así se reparten.
        const extra = new Map<string, number>();
        const base = cargaDe(estado.leads);
        const carga = (id: string) => base(id) + (extra.get(id) ?? 0);
        const ops: OperacionLead[] = [];
        const cambios = [];
        const sinNadie: string[] = [];
        for (const l of pendientes) {
          const [s] = candidatosPara(l, estado.candidatos, estado.territorios, carga);
          if (!s) {
            sinNadie.push(l.nombre);
            continue;
          }
          extra.set(s.empleadoId, (extra.get(s.empleadoId) ?? 0) + 1);
          ops.push({ tipo: 'asignar', leadId: l.id, empleadoId: s.empleadoId });
          cambios.push({ entidad: 'Prospect', id: l.nombre, de: 'Sin asignar', a: s.nombre, motivo: `regla ${reglaDe(l, tieneTerritorio(l, estado.territorios))}` });
        }
        if (!ops.length) return { error: `Ningún Doer de New Business cumple la regla para ${pendientes.length === 1 ? `${pendientes[0]!.nombre} (${motivoRegla(pendientes[0]!, estado.territorios)})` : `los ${pendientes.length} leads sin responsable`}. Revisa la línea de negocio, los territorios y el tipo de clientes de los Doer.` };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, ...ops] },
          cambios,
          salida: `Se ${ops.length === 1 ? 'asignó 1 lead' : `asignaron ${ops.length} leads`}.` + (sinNadie.length ? ` ${sinNadie.length} ${sinNadie.length === 1 ? 'quedó' : 'quedaron'} sin asignar porque nadie cumple la regla: ${sinNadie.slice(0, 5).join(', ')}${sinNadie.length > 5 ? '…' : ''}.` : ''),
        };
      },
    },
  ],
});

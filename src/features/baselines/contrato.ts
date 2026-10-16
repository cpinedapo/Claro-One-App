/**
 * CONTRATO DE LA CAPABILITY · Baselines
 *
 * La información base del negocio que el Administrador mantiene desde Configuración: carriers,
 * estados, líneas de negocio y cargos (H-018). El resto de la app las toma de aquí: al relacionar una
 * LOB con una agencia, al dar de alta un agente, al escribir la dirección de una agencia o al darle
 * cargo a un usuario de la plataforma.
 *
 * Es del producto: ni el arnés ni el kit traen un contrato para esto (H-018).
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 * - El código es la llave que guardan las otras tablas y no cambia. Un estado lleva sus 2 letras;
 *   una LOB o un carrier usan su nombre como código. El nombre sí se edita.
 * - Un código no se repite dentro de su tipo. Si ya existe desactivado, se reactiva en vez de crearlo.
 * - Un carrier vende al menos una línea de negocio, y solo las vigentes.
 * - Un cargo aplica a al menos un rol del catálogo del kit (Doer, Manager…).
 * - Un área puede pertenecer a un área principal (es una sub-área, H-038). Solo hay dos niveles: una sub-área no
 *   tiene sub-áreas, y un área que ya tiene sub-áreas no pasa a ser sub-área de otra.
 * - Un cargo dice su rol y su área o sub-áreas (H-038): al menos una, vigentes. De ahí salen el área y los roles de
 *   quien lo tiene.
 * - Un territorio (H-037) es de un estado vigente y tiene al menos un ZIP de 5 dígitos. Un ZIP no está en dos
 *   territorios vigentes a la vez (supuesto: los territorios no se pisan).
 * - Desactivar no borra: el valor deja de ofrecerse para relaciones nuevas, y lo que ya lo usa lo
 *   conserva. Reactivar abre un intervalo nuevo.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import { ROLES } from '@arc2-0/claro-one-kit/dominio';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { TIPOS_BASELINE, leerZips } from '@/dominio/baselines';
import { MAX_TERRITORIOS, validarTerritorios } from '@/dominio/territorios';
import type { FilaTerritorio } from '@/dominio/territorios';
import type { TipoBaseline, ValorBaseline } from '@/dominio/baselines';

/** Lo que una acción cambia. Lo escribe la persistencia. */
export type OperacionBaseline =
  | { tipo: 'alta'; valor: { tipo: TipoBaseline; codigo: string; nombre: string; lobs: string[]; roles: string[]; padre: string | null; areas: string[]; estado: string | null; subregion: string | null; zips: string[] } }
  | { tipo: 'edicion'; id: string; nombre: string; lobs: string[]; roles: string[]; padre: string | null; areas: string[]; estado: string | null; subregion: string | null; zips: string[] }
  | { tipo: 'baja'; id: string };

export interface EstadoBaselines {
  valores: ValorBaseline[];
  /** Vacío al cargar; cada acción deja aquí lo que hay que guardar. */
  operaciones: OperacionBaseline[];
}

const ENTIDAD: Record<TipoBaseline, string> = { carrier: 'Carrier', state: 'Estado', lob: 'Line of Business · E-011', cargo: 'Cargo · Internal Actor (E-006)', area: 'Área de la organización', 'tipo-comision': 'Tipo de comisión', territorio: 'Territorio' };

const texto = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

const vigentesDe = (estado: EstadoBaselines, tipo: TipoBaseline) => estado.valores.filter((v) => v.tipo === tipo && v.vigente);

/** Las LOB de un carrier: al menos una, y todas vigentes. */
function leerLobs(estado: EstadoBaselines, entrada: EntradaAccion): { lista: string[] } | { error: string } {
  const lista = [...new Set((entrada.lobs ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
  if (!lista.length) return { error: 'Elige al menos una línea de negocio que venda el carrier.' };
  const lobs = vigentesDe(estado, 'lob');
  const desconocida = lista.find((l) => !lobs.some((x) => x.codigo === l));
  if (desconocida) return { error: `La línea de negocio «${desconocida}» no está vigente.` };
  return { lista };
}

/** Los roles de un cargo: al menos uno, y todos del catálogo del kit. */
function leerRoles(entrada: EntradaAccion): { lista: string[] } | { error: string } {
  const lista = [...new Set((entrada.roles ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
  if (!lista.length) return { error: 'Elige al menos un rol al que aplique el cargo.' };
  const desconocido = lista.find((r) => !ROLES.some((x) => x.id === r));
  if (desconocido) return { error: `El rol «${desconocido}» no existe.` };
  return { lista };
}

/** El área principal a la que pertenece una sub-área (vacío = es área principal). `salvo`: la propia área. */
function leerPadre(estado: EstadoBaselines, entrada: EntradaAccion, salvo?: ValorBaseline): { padre: string | null } | { error: string } {
  const padre = texto(entrada.padre);
  if (!padre) return { padre: null };
  const p = vigentesDe(estado, 'area').find((x) => x.codigo === padre);
  if (!p) return { error: 'El área a la que pertenece tiene que estar vigente.' };
  if (p.padre) return { error: `«${p.nombre}» ya es una sub-área: una sub-área no tiene sub-áreas.` };
  if (salvo && p.codigo === salvo.codigo) return { error: 'Un área no puede pertenecer a sí misma.' };
  if (salvo && vigentesDe(estado, 'area').some((x) => x.padre === salvo.codigo)) return { error: `«${salvo.nombre}» tiene sub-áreas: no puede ser sub-área de otra.` };
  return { padre };
}

/** Las áreas o sub-áreas de un cargo: al menos una, todas vigentes. */
function leerAreasCargo(estado: EstadoBaselines, entrada: EntradaAccion): { lista: string[] } | { error: string } {
  const lista = [...new Set((entrada.areas ?? '').split('|').map((x) => x.trim()).filter(Boolean))];
  if (!lista.length) return { error: 'Elige al menos un área o sub-área del cargo.' };
  const desconocida = lista.find((a) => !vigentesDe(estado, 'area').some((x) => x.codigo === a));
  if (desconocida) return { error: `El área «${desconocida}» no está vigente.` };
  return { lista };
}

/** El estado y los ZIP de un territorio. `salvo`: el propio territorio, al editarlo. */
function leerTerritorio(estado: EstadoBaselines, entrada: EntradaAccion, salvo?: string): { estado: string; subregion: string | null; zips: string[] } | { error: string } {
  const st = texto(entrada.estado)?.toUpperCase() ?? '';
  if (!vigentesDe(estado, 'state').some((x) => x.codigo === st)) return { error: 'Elige un estado vigente de Datos base.' };
  const { zips, invalidos } = leerZips(entrada.zips ?? '');
  if (invalidos.length) return { error: `Estos ZIP no tienen 5 dígitos: ${invalidos.slice(0, 5).join(', ')}${invalidos.length > 5 ? '…' : ''}` };
  if (!zips.length) return { error: 'Escribe al menos un ZIP code.' };
  for (const otro of vigentesDe(estado, 'territorio').filter((x) => x.id !== salvo)) {
    const repetidos = zips.filter((z) => otro.zips.includes(z));
    if (repetidos.length) return { error: `${repetidos.slice(0, 5).join(', ')}${repetidos.length > 5 ? '…' : ''} ya ${repetidos.length === 1 ? 'está' : 'están'} en «${otro.nombre}».` };
  }
  const subregion = texto(entrada.subregion);
  if (subregion && subregion.length > 60) return { error: 'La subregión tiene que tener 60 caracteres o menos.' };
  return { estado: st, subregion, zips };
}

function nombreValido(nombre: string | null): string | { error: string } {
  if (!nombre) return { error: 'Escribe el nombre.' };
  if (nombre.length > 60) return { error: 'El nombre tiene que tener 60 caracteres o menos.' };
  return nombre;
}

function operacion(estado: EstadoBaselines, o: OperacionBaseline, tipo: TipoBaseline, id: string, de: string, a: string) {
  return { estado: { ...estado, operaciones: [...estado.operaciones, o] }, cambios: [{ entidad: ENTIDAD[tipo], id, de, a }] };
}

const QUIEN = [{ tipo: 'human' as const, roles: ['Configurador / Admin'], ambito: 'global' as const }];

export const CAPACIDAD_BASELINES = crearCapacidad<EstadoBaselines>({
  id: 'baselines',
  nombre: 'Datos base',
  journey: 'Sin journey en el arnés: capability del producto para la información base (H-018)',
  entidades: ['Carrier', 'Estado (US)', 'Line of Business · E-011', 'Cargo · Internal Actor (E-006)', 'Área de la organización'],
  estados: {
    vigente: { etiqueta: 'Vigente', responsable: 'Datos base' },
    inactivo: { etiqueta: 'Inactivo', responsable: 'Datos base' },
  },

  acciones: [
    {
      id: 'agregar-valor',
      nombre: 'Agregar valor base',
      descripcion: 'Agrega un carrier, un estado, una línea de negocio, un cargo o un área a la información base.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { tipo: 'carrier | state | lob | cargo | area | tipo-comision | territorio', codigo: 'solo estado: 2 letras', nombre: 'string, hasta 60', lobs: 'solo carrier: ACA,Medicare,…', roles: 'solo cargo: doer,manager,…', areas: 'solo cargo: áreas o sub-áreas, separadas por |', padre: 'solo área: el área principal si es sub-área', estado: 'solo territorio: código del estado', zips: 'solo territorio: ZIP de 5 dígitos, separados por coma o espacio' },
      consecuencia: {
        cambia: 'El valor se puede elegir desde hoy en toda la app.',
        noCambia: 'Nada de lo que ya existe.',
        alcance: 'Solo este valor.',
        requiere: 'Nombre. Un estado, sus 2 letras. Un carrier, al menos una línea de negocio. Un cargo, al menos un rol y un área. Un territorio, su estado y al menos un ZIP.',
        registro: 'Quién lo agregó y cuándo.',
      },
      regla: 'H-018 · decisión de producto 2026-10-13',
      emite: ['baseline.added'],
      aplicar(estado, entrada) {
        const tipo = texto(entrada.tipo) as TipoBaseline | null;
        if (!tipo || !(TIPOS_BASELINE as readonly string[]).includes(tipo)) return { error: 'Elige el tipo de valor.' };
        const nombre = nombreValido(texto(entrada.nombre));
        if (typeof nombre !== 'string') return nombre;

        let codigo = nombre;
        if (tipo === 'state') {
          const c = texto(entrada.codigo)?.toUpperCase() ?? '';
          if (!/^[A-Z]{2}$/.test(c)) return { error: 'El código del estado va con sus 2 letras, por ejemplo FL.' };
          codigo = c;
        }
        let lobs: string[] = [];
        if (tipo === 'carrier') {
          const l = leerLobs(estado, entrada);
          if ('error' in l) return l;
          lobs = l.lista;
        }
        let roles: string[] = [];
        let areas: string[] = [];
        if (tipo === 'cargo') {
          const r = leerRoles(entrada);
          if ('error' in r) return r;
          roles = r.lista;
          const a = leerAreasCargo(estado, entrada);
          if ('error' in a) return a;
          areas = a.lista;
        }
        let padre: string | null = null;
        if (tipo === 'area') {
          const p = leerPadre(estado, entrada);
          if ('error' in p) return p;
          padre = p.padre;
        }

        let territorio: { estado: string | null; subregion: string | null; zips: string[] } = { estado: null, subregion: null, zips: [] };
        if (tipo === 'territorio') {
          const tr = leerTerritorio(estado, entrada);
          if ('error' in tr) return tr;
          territorio = tr;
        }

        const mismo = estado.valores.filter((v) => v.tipo === tipo && v.codigo.toLowerCase() === codigo.toLowerCase());
        if (mismo.some((v) => v.vigente)) return { error: `«${codigo}» ya está en la información base.` };
        if (mismo.length) return { error: `«${codigo}» existe pero está inactivo. Reactívalo en vez de crearlo.` };

        return {
          ...operacion(estado, { tipo: 'alta', valor: { tipo, codigo, nombre, lobs, roles, padre, areas, ...territorio } }, tipo, codigo, '—', tipo === 'territorio' ? `vigente · ${territorio.estado} · ${territorio.zips.length} ZIP` : 'vigente'),
          salida: `Se agregó ${nombre}.`,
        };
      },
    },
    {
      id: 'editar-valor',
      nombre: 'Editar valor base',
      descripcion: 'Cambia el nombre de un valor; si es un carrier, las líneas de negocio que vende; si es un cargo, sus roles; si es un territorio, su estado y sus ZIP.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { valorId: 'id del valor', nombre: 'string, hasta 60', lobs: 'solo carrier: ACA,Medicare,…', roles: 'solo cargo: doer,manager,…', areas: 'solo cargo', padre: 'solo área', estado: 'solo territorio', zips: 'solo territorio' },
      consecuencia: {
        cambia: 'Cómo se ve el valor en toda la app.',
        noCambia: 'Su código ni lo que ya lo usa.',
        alcance: 'Solo este valor.',
        registro: 'Quién lo cambió, cuándo y el valor de antes y de después.',
      },
      regla: 'H-018 · decisión de producto 2026-10-13',
      emite: ['baseline.edited'],
      aplicar(estado, entrada) {
        const v = estado.valores.find((x) => x.id === entrada.valorId && x.vigente);
        if (!v) return { error: 'Ese valor no existe o está inactivo.' };
        const nombre = nombreValido(texto(entrada.nombre));
        if (typeof nombre !== 'string') return nombre;
        let lobs = v.lobs;
        if (v.tipo === 'carrier') {
          const l = leerLobs(estado, entrada);
          if ('error' in l) return l;
          lobs = l.lista;
        }
        let roles = v.roles;
        if (v.tipo === 'cargo') {
          const r = leerRoles(entrada);
          if ('error' in r) return r;
          roles = r.lista;
        }
        let areas = v.areas;
        if (v.tipo === 'cargo') {
          const a = leerAreasCargo(estado, entrada);
          if ('error' in a) return a;
          areas = a.lista;
        }
        let padre = v.padre;
        if (v.tipo === 'area') {
          const p = leerPadre(estado, entrada, v);
          if ('error' in p) return p;
          padre = p.padre;
        }
        let territorio = { estado: v.estado, subregion: v.subregion, zips: v.zips };
        if (v.tipo === 'territorio') {
          const tr = leerTerritorio(estado, entrada, v.id);
          if ('error' in tr) return tr;
          territorio = tr;
        }
        const entran = territorio.zips.filter((z) => !v.zips.includes(z));
        const salen = v.zips.filter((z) => !territorio.zips.includes(z));
        const cambios = [
          ...(nombre !== v.nombre ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · nombre`, de: v.nombre, a: nombre }] : []),
          ...(lobs.join(',') !== v.lobs.join(',') ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · lobs`, de: v.lobs.join(', ') || '—', a: lobs.join(', ') }] : []),
          ...(roles.join(',') !== v.roles.join(',') ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · roles`, de: v.roles.join(', ') || '—', a: roles.join(', ') }] : []),
          ...(areas.join('|') !== v.areas.join('|') ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · áreas`, de: v.areas.join(', ') || '—', a: areas.join(', ') }] : []),
          ...(padre !== v.padre ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · pertenece a`, de: v.padre ?? 'área principal', a: padre ?? 'área principal' }] : []),
          ...(territorio.subregion !== v.subregion ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · subregión`, de: v.subregion ?? '—', a: territorio.subregion ?? '—' }] : []),
          ...(territorio.estado !== v.estado ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · estado`, de: v.estado ?? '—', a: territorio.estado ?? '—' }] : []),
          ...(entran.length || salen.length
            ? [{ entidad: ENTIDAD[v.tipo], id: `${v.codigo} · ZIP`, de: `${v.zips.length} ZIP`, a: `${territorio.zips.length} ZIP`, motivo: [entran.length ? `entran ${entran.join(', ')}` : '', salen.length ? `salen ${salen.join(', ')}` : ''].filter(Boolean).join(' · ') }]
            : []),
        ];
        if (!cambios.length) return { error: 'No cambiaste nada.' };
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, { tipo: 'edicion', id: v.id, nombre, lobs, roles, padre, areas, ...territorio }] },
          cambios,
          salida: `Se actualizó ${nombre}.`,
        };
      },
    },
    {
      id: 'desactivar-valor',
      nombre: 'Desactivar valor base',
      descripcion: 'Deja de ofrecer un valor para relaciones nuevas. No se borra.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { valorId: 'id del valor' },
      consecuencia: {
        cambia: 'Desde hoy el valor ya no se puede elegir.',
        noCambia: 'Las agencias, agentes, carriers y usuarios que ya lo usan lo conservan. Su historia.',
        alcance: 'Solo este valor.',
        registro: 'Quién lo desactivó y cuándo.',
      },
      regla: 'H-018 · decisión de producto 2026-10-13',
      emite: ['baseline.deactivated'],
      aplicar(estado, entrada) {
        const v = estado.valores.find((x) => x.id === entrada.valorId && x.vigente);
        if (!v) return { error: 'Ese valor ya está inactivo.' };
        return { ...operacion(estado, { tipo: 'baja', id: v.id }, v.tipo, v.codigo, 'vigente', 'inactivo'), salida: `${v.nombre} quedó inactivo.` };
      },
    },
    {
      id: 'reactivar-valor',
      nombre: 'Reactivar valor base',
      descripcion: 'Vuelve a ofrecer un valor inactivo, desde hoy.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { valorId: 'id del valor inactivo' },
      consecuencia: {
        cambia: 'Desde hoy el valor se puede elegir otra vez.',
        noCambia: 'El intervalo en que estuvo inactivo: queda en la historia.',
        alcance: 'Solo este valor.',
        registro: 'Quién lo reactivó y cuándo.',
      },
      regla: 'H-018 · decisión de producto 2026-10-13',
      emite: ['baseline.reactivated'],
      aplicar(estado, entrada) {
        const v = estado.valores.find((x) => x.id === entrada.valorId && !x.vigente);
        if (!v) return { error: 'Ese valor ya está vigente.' };
        if (vigentesDe(estado, v.tipo).some((x) => x.codigo === v.codigo)) return { error: `«${v.codigo}» ya está vigente.` };
        // Un carrier vuelve solo con las LOB que sigan vigentes.
        const lobs = v.tipo === 'carrier' ? v.lobs.filter((l) => vigentesDe(estado, 'lob').some((x) => x.codigo === l)) : [];
        if (v.tipo === 'carrier' && !lobs.length) return { error: 'Ninguna de sus líneas de negocio está vigente. Reactiva primero una.' };
        // Un territorio vuelve solo si su estado sigue vigente y ninguno de sus ZIP está ya en otro.
        if (v.tipo === 'territorio') {
          const tr = leerTerritorio(estado, { estado: v.estado, subregion: v.subregion, zips: v.zips.join(',') }, v.id);
          if ('error' in tr) return tr;
        }
        return {
          ...operacion(estado, { tipo: 'alta', valor: { tipo: v.tipo, codigo: v.codigo, nombre: v.nombre, lobs, roles: v.roles, padre: v.padre, areas: v.areas, estado: v.estado, subregion: v.subregion, zips: v.zips } }, v.tipo, v.codigo, 'inactivo', 'vigente'),
          salida: `${v.nombre} está vigente otra vez.`,
        };
      },
    },
    {
      id: 'importar-territorios',
      nombre: 'Importar territorios',
      descripcion: 'Agrega de una vez los territorios de un archivo de la plantilla (H-039).',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { archivo: 'nombre del archivo', filas: 'JSON: [{ fila, nombre, region, subregion, zips }]' },
      consecuencia: {
        cambia: 'Desde hoy cada territorio del archivo se puede elegir en toda la app.',
        noCambia: 'Los territorios que ya existen: el archivo solo agrega.',
        alcance: 'Los territorios del archivo.',
        requiere: 'Todas las filas bien: nombre nuevo, un estado vigente, ZIP de 5 dígitos que no estén en otro territorio. Si una falla, no entra ninguna.',
        registro: 'Quién lo importó, cuándo, el archivo y cada territorio que entró.',
      },
      regla: 'H-039 · decisión de producto 2026-10-15',
      emite: ['baseline.imported'],
      aplicar(estado, entrada) {
        let filas: FilaTerritorio[];
        try {
          filas = JSON.parse(entrada.filas ?? '[]') as FilaTerritorio[];
        } catch {
          return { error: 'Las filas del archivo no se pudieron leer.' };
        }
        if (!Array.isArray(filas) || !filas.length) return { error: 'El archivo no trae territorios.' };
        if (filas.length > MAX_TERRITORIOS) return { error: `Hasta ${MAX_TERRITORIOS} territorios por archivo.` };
        const estados = vigentesDe(estado, 'state').map((x) => ({ codigo: x.codigo, nombre: x.nombre }));
        const existentes = estado.valores.filter((x) => x.tipo === 'territorio').map((x) => ({ nombre: x.nombre, zips: x.vigente ? x.zips : [] }));
        const leidos = validarTerritorios(filas, estados, existentes);
        const malas = leidos.filter((l) => l.errores.length);
        // Todo o nada (como la importación de leads, H-026): con una fila mal no entra ninguna.
        if (malas.length) return { error: `${malas.length} de ${leidos.length} filas tienen errores (la primera, fila ${malas[0]!.fila}: ${malas[0]!.errores[0]}). No se importó ninguna.` };
        const operaciones: OperacionBaseline[] = leidos.map((l) => ({
          tipo: 'alta',
          valor: { tipo: 'territorio', codigo: l.nombre, nombre: l.nombre, lobs: [], roles: [], padre: null, areas: [], estado: l.estado, subregion: l.subregion, zips: l.zips },
        }));
        return {
          estado: { ...estado, operaciones: [...estado.operaciones, ...operaciones] },
          cambios: leidos.map((l) => ({ entidad: ENTIDAD.territorio, id: l.nombre, de: '—', a: `vigente · ${l.estado} · ${l.zips.length} ZIP`, motivo: texto(entrada.archivo) ?? undefined })),
          salida: `Se importaron ${leidos.length} territorios.`,
        };
      },
    },
  ],
});

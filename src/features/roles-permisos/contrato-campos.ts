/**
 * CONTRATO DE LA CAPABILITY · Campos por área
 *
 * Cada área de la organización (Configuración › Datos base) necesita datos propios de sus usuarios para sus
 * procesos: el Administrador los define por área y los llena en el perfil de cada persona (pedido del negocio,
 * 2026-10-15). PB-002 no lo trae; vive aquí, al lado de su contrato (H-027).
 *
 * Reglas que el contrato sostiene:
 * - Solo quien tiene el rol Administrador (`Configurador / Admin` en el catálogo) la ejecuta.
 * - Un campo es de un área vigente y su nombre no se repite dentro de ella.
 * - El tipo de un campo no cambia: los valores guardados se leyeron con ese tipo. Para otro tipo, otro campo.
 * - Una lista tiene al menos dos opciones propias, o toma las de un catálogo de Datos base (LOB, carriers, estados).
 * - Una multi-lista guarda varias opciones; todas tienen que estar vigentes al guardar.
 * - Desactivar no borra: el campo deja de pedirse y los valores guardados quedan en su historia.
 * - Un usuario solo guarda los campos de su área, con el tipo de cada campo, y los obligatorios llenos.
 * - Cambiar un valor cierra el anterior (`valid_to`): la historia de cada dato queda.
 * - «Solo para» (H-040): un campo puede pedirse solo a ciertos roles en ciertas sub-áreas del área. «Solo si»: solo
 *   cuando otro campo Sí/No del área vale lo pedido. A quien no le aplica, ni se le pide ni se le exige; si tenía un
 *   valor (p. ej. dejó de ser On field), se cierra.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import type { EntradaAccion } from '@arc2-0/claro-one-kit/capacidad';
import { FUENTES_OPCIONES, TIPOS_CAMPO, aplica, camposDeArea, codigosDe, esLista, leerValor, valorDe } from '@/dominio/camposArea';
import type { CampoArea, CatalogosCampos, FuenteOpciones, RolEnArea, TipoCampo, ValorCampoArea } from '@/dominio/camposArea';

export type OperacionCampo =
  | { tipo: 'alta'; campo: Omit<CampoArea, 'id' | 'vigente'> }
  | { tipo: 'edicion'; id: string; etiqueta: string; opciones: string[]; obligatorio: boolean; condiciones: Condiciones }
  | { tipo: 'baja'; id: string }
  | { tipo: 'valores'; empleadoId: string; valores: { campoId: string; valor: string | null }[] };

export interface EstadoCamposArea {
  /** Las áreas vigentes de Datos base, con su área principal (las sub-áreas, H-038). */
  areas: { codigo: string; padre: string | null }[];
  /** `areas`: sus áreas principales (las de sus cargos, H-038). Los campos se definen por área principal. */
  empleados: { id: string; nombre: string; areas: string[]; roles: RolEnArea[] }[];
  campos: CampoArea[];
  /** Los catálogos vigentes de Datos base que una lista puede usar. */
  catalogos: CatalogosCampos;
  /** Solo los valores vigentes. */
  valores: ValorCampoArea[];
  /** Vacío al cargar; cada acción deja aquí lo que hay que guardar. */
  operaciones: OperacionCampo[];
}

const ENTIDAD = 'Campo de área';
const QUIEN = [{ tipo: 'human' as const, roles: ['Configurador / Admin'], ambito: 'global' as const }];

const texto = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

function etiquetaValida(estado: EstadoCamposArea, area: string, etiqueta: string | null, salvo?: string): string | { error: string } {
  if (!etiqueta) return { error: 'Escribe el nombre del campo.' };
  if (etiqueta.length > 60) return { error: 'El nombre del campo tiene que tener 60 caracteres o menos.' };
  const repetido = camposDeArea(estado.campos, area).some((c) => c.id !== salvo && c.etiqueta.toLowerCase() === etiqueta.toLowerCase());
  return repetido ? { error: `El área ya tiene un campo «${etiqueta}».` } : etiqueta;
}

function fuenteValida(tipo: TipoCampo, entrada: EntradaAccion): FuenteOpciones | { error: string } {
  if (!esLista(tipo)) return 'propias';
  const f = texto(entrada.fuente) ?? 'propias';
  return (FUENTES_OPCIONES as readonly string[]).includes(f) ? (f as FuenteOpciones) : { error: 'Elige de dónde salen las opciones.' };
}

function opcionesValidas(tipo: TipoCampo, fuente: FuenteOpciones, entrada: EntradaAccion): { lista: string[] } | { error: string } {
  if (!esLista(tipo) || fuente !== 'propias') return { lista: [] };
  const lista = [...new Set((entrada.opciones ?? '').split('|').map((x) => x.trim()).filter(Boolean))];
  if (lista.length < 2) return { error: 'Una lista necesita al menos dos opciones.' };
  if (lista.some((o) => o.length > 60)) return { error: 'Cada opción tiene que tener 60 caracteres o menos.' };
  return { lista };
}

/** «Solo para» y «Solo si» (H-040). */
type Condiciones = Pick<CampoArea, 'soloRoles' | 'soloSubareas' | 'dependeDe' | 'dependeValor' | 'filtradoPor'>;
const ROLES_KIT = ['ceo-level', 'manager', 'coordinator', 'doer', 'configurador-admin'];

function leerCondiciones(estado: EstadoCamposArea, area: string, entrada: EntradaAccion, fuente: FuenteOpciones, salvo?: string): Condiciones | { error: string } {
  // «Filtrar opciones por» (H-041): solo una lista de territorios, por un campo de estados de la misma área.
  const filtrarPor = texto(entrada.filtrarPor);
  let filtradoPor: string | null = null;
  if (filtrarPor) {
    if (fuente !== 'territorio') return { error: '«Filtrar opciones por» es solo para listas de territorios.' };
    const otro = camposDeArea(estado.campos, area).find((c) => c.id === filtrarPor);
    if (!otro || otro.fuente !== 'state' || otro.id === salvo) return { error: 'Los territorios se filtran por un campo de estados de la misma área.' };
    filtradoPor = otro.id;
  }
  const lista = (v: string | null | undefined, sep: string) => [...new Set((v ?? '').split(sep).map((x) => x.trim()).filter(Boolean))];
  const soloRoles = lista(entrada.soloRoles, ',');
  if (soloRoles.some((r) => !ROLES_KIT.includes(r))) return { error: 'Uno de los roles de «Solo para» no existe.' };
  const soloSubareas = lista(entrada.soloSubareas, '|');
  const ajena = soloSubareas.find((s) => !estado.areas.some((a) => a.codigo === s && a.padre === area));
  if (ajena) return { error: `«${ajena}» no es una sub-área vigente de ${area}.` };
  const dependeDe = texto(entrada.dependeDe);
  if (!dependeDe) return { soloRoles, soloSubareas, dependeDe: null, dependeValor: null, filtradoPor };
  const otro = camposDeArea(estado.campos, area).find((c) => c.id === dependeDe);
  if (!otro || otro.tipo !== 'si-no') return { error: '«Solo si» tiene que depender de un campo Sí/No de la misma área.' };
  if (otro.id === salvo) return { error: 'Un campo no puede depender de sí mismo.' };
  const dependeValor = texto(entrada.dependeValor) ?? 'si';
  if (dependeValor !== 'si' && dependeValor !== 'no') return { error: '«Solo si» vale Sí o No.' };
  return { soloRoles, soloSubareas, dependeDe, dependeValor, filtradoPor };
}

const conOperacion = (estado: EstadoCamposArea, o: OperacionCampo) => ({ ...estado, operaciones: [...estado.operaciones, o] });

export const CAPACIDAD_CAMPOS_AREA = crearCapacidad<EstadoCamposArea>({
  id: 'campos-por-area',
  nombre: 'Campos por área',
  journey: 'Sin journey en el arnés: capability del producto, al lado de PB-002 (H-027)',
  entidades: ['Internal Actor · E-006', 'Área de la organización', 'Campo de área'],
  estados: {
    vigente: { etiqueta: 'Vigente', responsable: 'Campo de área' },
    inactivo: { etiqueta: 'Inactivo', responsable: 'Campo de área' },
  },

  acciones: [
    {
      id: 'agregar-campo',
      nombre: 'Agregar campo al área',
      descripcion: 'Agrega un dato que el área necesita de sus usuarios.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { area: 'código del área (Datos base)', etiqueta: 'string, hasta 60', tipo: TIPOS_CAMPO.join(' | '), fuente: 'solo listas: ' + FUENTES_OPCIONES.join(' | '), opciones: 'solo fuente propias: A|B|C', obligatorio: 'si | no' },
      consecuencia: {
        cambia: 'Desde hoy el campo aparece en el perfil y en la tabla de los usuarios del área.',
        noCambia: 'Los datos de los usuarios: nadie tiene valor hasta que se llene.',
        alcance: 'Los usuarios de esta área.',
        requiere: 'Nombre, tipo y, si es lista, al menos dos opciones propias o un catálogo de Datos base.',
        registro: 'Quién lo agregó y cuándo.',
      },
      regla: 'H-027 · decisión de producto 2026-10-15',
      emite: ['area-field.added'],
      aplicar(estado, entrada) {
        const area = texto(entrada.area);
        if (!area || !estado.areas.some((a) => a.codigo === area)) return { error: 'Elige un área vigente.' };
        const tipo = texto(entrada.tipo) as TipoCampo | null;
        if (!tipo || !(TIPOS_CAMPO as readonly string[]).includes(tipo)) return { error: 'Elige el tipo del campo.' };
        const etiqueta = etiquetaValida(estado, area, texto(entrada.etiqueta));
        if (typeof etiqueta !== 'string') return etiqueta;
        const fuente = fuenteValida(tipo, entrada);
        if (typeof fuente !== 'string') return fuente;
        const opciones = opcionesValidas(tipo, fuente, entrada);
        if ('error' in opciones) return opciones;
        const obligatorio = entrada.obligatorio === 'si';
        const orden = Math.max(0, ...camposDeArea(estado.campos, area).map((c) => c.orden)) + 1;
        const condiciones = leerCondiciones(estado, area, entrada, fuente);
        if ('error' in condiciones) return condiciones;
        return {
          estado: conOperacion(estado, { tipo: 'alta', campo: { area, etiqueta, tipo, fuente, opciones: opciones.lista, obligatorio, orden, ...condiciones } }),
          cambios: [{ entidad: ENTIDAD, id: `${area} · ${etiqueta}`, de: '—', a: obligatorio ? 'vigente · obligatorio' : 'vigente' }],
          salida: `Se agregó «${etiqueta}».`,
        };
      },
    },
    {
      id: 'editar-campo',
      nombre: 'Editar campo del área',
      descripcion: 'Cambia el nombre, las opciones propias o si es obligatorio. El tipo y la fuente de las opciones no cambian.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { campoId: 'id del campo', etiqueta: 'string, hasta 60', opciones: 'solo lista: A|B|C', obligatorio: 'si | no' },
      consecuencia: {
        cambia: 'Cómo se pide el campo desde hoy.',
        noCambia: 'Los valores ya guardados, aunque una opción deje de ofrecerse.',
        alcance: 'Los usuarios del área de este campo.',
        registro: 'Quién lo cambió, cuándo y el valor de antes y de después.',
      },
      regla: 'H-027 · decisión de producto 2026-10-15',
      emite: ['area-field.edited'],
      aplicar(estado, entrada) {
        const c = estado.campos.find((x) => x.id === entrada.campoId && x.vigente);
        if (!c) return { error: 'Ese campo no existe o está inactivo.' };
        const etiqueta = etiquetaValida(estado, c.area, texto(entrada.etiqueta), c.id);
        if (typeof etiqueta !== 'string') return etiqueta;
        const opciones = opcionesValidas(c.tipo, c.fuente, entrada);
        if ('error' in opciones) return opciones;
        const obligatorio = entrada.obligatorio === 'si';
        const condiciones = leerCondiciones(estado, c.area, entrada, c.fuente, c.id);
        if ('error' in condiciones) return condiciones;
        const resumen = (x: Condiciones) => [x.soloRoles.join(', '), x.soloSubareas.join(', '), x.dependeDe ? `si ${x.dependeDe} = ${x.dependeValor}` : '', x.filtradoPor ? `filtrado por ${x.filtradoPor}` : ''].filter(Boolean).join(' · ') || 'a todos';
        const cambios = [
          ...(resumen(condiciones) !== resumen(c) ? [{ entidad: ENTIDAD, id: `${c.area} · ${etiqueta} · a quién`, de: resumen(c), a: resumen(condiciones) }] : []),
          ...(etiqueta !== c.etiqueta ? [{ entidad: ENTIDAD, id: `${c.area} · nombre`, de: c.etiqueta, a: etiqueta }] : []),
          ...(opciones.lista.join('|') !== c.opciones.join('|') ? [{ entidad: ENTIDAD, id: `${c.area} · ${etiqueta} · opciones`, de: c.opciones.join(', ') || '—', a: opciones.lista.join(', ') }] : []),
          ...(obligatorio !== c.obligatorio ? [{ entidad: ENTIDAD, id: `${c.area} · ${etiqueta} · obligatorio`, de: c.obligatorio ? 'sí' : 'no', a: obligatorio ? 'sí' : 'no' }] : []),
        ];
        if (!cambios.length) return { error: 'No cambiaste nada.' };
        return {
          estado: conOperacion(estado, { tipo: 'edicion', id: c.id, etiqueta, opciones: opciones.lista, obligatorio, condiciones }),
          cambios,
          salida: `Se actualizó «${etiqueta}».`,
        };
      },
    },
    {
      id: 'desactivar-campo',
      nombre: 'Desactivar campo del área',
      descripcion: 'Deja de pedir un campo. No se borra.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { campoId: 'id del campo' },
      consecuencia: {
        cambia: 'Desde hoy el campo ya no aparece en el perfil ni en la tabla del área.',
        noCambia: 'Los valores guardados: quedan en la historia del campo.',
        alcance: 'Los usuarios del área de este campo.',
        registro: 'Quién lo desactivó y cuándo.',
      },
      regla: 'H-027 · decisión de producto 2026-10-15',
      emite: ['area-field.deactivated'],
      aplicar(estado, entrada) {
        const c = estado.campos.find((x) => x.id === entrada.campoId && x.vigente);
        if (!c) return { error: 'Ese campo no existe o ya está inactivo.' };
        const conValor = estado.valores.filter((v) => v.campoId === c.id).length;
        return {
          estado: conOperacion(estado, { tipo: 'baja', id: c.id }),
          cambios: [{ entidad: ENTIDAD, id: `${c.area} · ${c.etiqueta}`, de: 'vigente', a: 'inactivo', motivo: `${conValor} valores quedan en la historia` }],
          salida: `«${c.etiqueta}» ya no se pide.`,
        };
      },
    },
    {
      id: 'guardar-datos-area',
      nombre: 'Guardar datos del área',
      descripcion: 'Guarda los datos que el área de la persona le pide.',
      quien: QUIEN,
      canales: ['ui'],
      entrada: { empleadoId: 'id del usuario', valores: 'JSON {campoId: valor}; vacío = sin valor' },
      consecuencia: {
        cambia: 'Los datos del área de esta persona desde hoy.',
        noCambia: 'Sus roles, su cargo ni su área. Los valores de antes quedan en la historia.',
        alcance: 'Solo esta persona.',
        requiere: 'Los campos obligatorios de su área llenos y cada valor con el tipo de su campo.',
        registro: 'Quién los guardó, cuándo y el valor de antes y de después.',
      },
      regla: 'H-027 · decisión de producto 2026-10-15',
      emite: ['internal-actor.area-data-updated'],
      aplicar(estado, entrada) {
        const e = estado.empleados.find((x) => x.id === entrada.empleadoId);
        if (!e) return { error: 'Ese usuario no existe o fue eliminado.' };
        let crudos: Record<string, unknown>;
        try {
          crudos = JSON.parse(entrada.valores ?? '{}') as Record<string, unknown>;
        } catch {
          return { error: 'Los datos no se pudieron leer.' };
        }
        const campos = e.areas.flatMap((a) => camposDeArea(estado.campos, a));
        if (!campos.length) return { error: 'El área de esta persona no tiene campos.' };
        const ajeno = Object.keys(crudos).find((id) => !campos.some((c) => c.id === id));
        if (ajeno) return { error: 'Uno de los campos no es del área de esta persona.' };
        // «Solo si» se resuelve con lo que llega; si un campo no llega, con lo guardado.
        const texto = (x: unknown) => (Array.isArray(x) ? JSON.stringify(x) : typeof x === 'string' ? x : x == null ? null : String(x));
        const leer = (id: string) => (id in crudos ? texto(crudos[id]) : valorDe(estado.valores, e.id, id));

        const valores: { campoId: string; valor: string | null }[] = [];
        const cambios = [];
        for (const c of campos) {
          const crudo = crudos[c.id];
          const r = !aplica(c, e.roles, leer) ? { valor: null } : leerValor(c, Array.isArray(crudo) ? JSON.stringify(crudo) : typeof crudo === 'string' ? crudo : crudo == null ? null : String(crudo), estado.catalogos, leer);
          if ('error' in r) return r;
          const antes = valorDe(estado.valores, e.id, c.id);
          if (r.valor === antes) continue;
          valores.push({ campoId: c.id, valor: r.valor });
          const ver = (x: string | null) => (x === null ? '—' : c.tipo === 'multi-lista' ? codigosDe(x).join(', ') || '—' : x);
          cambios.push({ entidad: ENTIDAD, id: `${e.nombre} · ${c.etiqueta}`, de: ver(antes), a: ver(r.valor) });
        }
        if (!cambios.length) return { error: 'No cambiaste nada.' };
        return {
          estado: conOperacion(estado, { tipo: 'valores', empleadoId: e.id, valores }),
          cambios,
          salida: `Se guardaron los datos de ${e.nombre}.`,
        };
      },
    },
  ],
});

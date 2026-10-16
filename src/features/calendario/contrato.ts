/**
 * CONTRATO DE LA CAPABILITY · Calendario (Gestor de actividades)
 *
 * Traído del prototipo PB-002 v2.6 (`capacidad-actividades.js`, pedido de negocio 2026-10-01), con
 * tres ajustes del producto (H-021):
 * - El equipo es el área de la organización (Datos base, H-018), no un área del kit.
 * - La hora del cronómetro la pone el servidor (`estado.ahora`), nunca el navegador.
 * - Exportar solo valida el alcance y devuelve los ids: el CSV se arma en el navegador, así el
 *   archivo no queda guardado en el rastro.
 *
 * Toda acción declara quién, por qué canal, con qué consecuencia y qué regla, y deja evento.
 * Entidad: Task · E-063. Quién ve qué vive en `src/dominio/actividades.ts`.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import type { Actor } from '@arc2-0/claro-one-kit/capacidad';
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';
import { ESTADOS_TAREA, PRIORIDADES, TIPOS_TAREA, duracion, enBandeja, minutosCronometro, minutosDe, puedeVer } from '@/dominio/actividades';
import type { Cronometro, EstadoTarea, Prioridad, Tarea, TipoTarea } from '@/dominio/actividades';

/** Lo que una acción cambia. Lo escribe la persistencia. */
export type OperacionTarea =
  | {
      tipo: 'crear';
      tarea: Pick<Tarea, 'titulo' | 'tipo' | 'prioridad' | 'fechaInicio' | 'fechaFin' | 'motivo' | 'creadaPor' | 'equipoId' | 'responsableId' | 'cliente' | 'descripcion'>;
    }
  | { tipo: 'tomar'; id: string; responsableId: string; motivo: string }
  | { tipo: 'estado'; id: string; estado: EstadoTarea; motivo: string; quien: string }
  | { tipo: 'tiempo'; id: string; empleadoId: string; minutos: number; fecha: string; origen: 'manual' | 'cronometro'; nota: string | null }
  | { tipo: 'cronometro-inicio'; empleadoId: string; tareaId: string }
  | { tipo: 'cronometro-fin'; empleadoId: string };

export interface EstadoActividades {
  tareas: Tarea[];
  cronometros: Cronometro[];
  /** Para saber el equipo de cada quien y quién gestiona a quién. */
  empleados: Empleado[];
  /** Los códigos de las áreas vigentes en Datos base: los equipos que reciben tareas. */
  areas: string[];
  /** Hoy (AAAA-MM-DD) y ahora (ms), del servidor. */
  hoy: string;
  ahora: number;
  operaciones: OperacionTarea[];
}

const ETIQUETA: Record<EstadoTarea, string> = { pendiente: 'Pendiente', 'en-curso': 'En curso', cerrada: 'Cerrada' };
const texto = (v: string | null | undefined) => (v ?? '').trim();
const nombreDe = (estado: EstadoActividades, id: string | null) => (id ? (estado.empleados.find((e) => e.id === id)?.nombre ?? id) : '—');
const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);

function buscar(estado: EstadoActividades, id: string | null | undefined) {
  return estado.tareas.find((t) => t.id === id);
}
/** Solo quien trabaja la tarea mueve su estado y su tiempo. */
function soloResponsable(estado: EstadoActividades, t: Tarea, actor: Actor | undefined): string | null {
  if (t.responsableId === actor?.id) return null;
  return t.responsableId
    ? `La trabaja ${nombreDe(estado, t.responsableId)}: solo quien la trabaja mueve su estado y su tiempo.`
    : 'Nadie la tomó todavía: primero hay que tomarla.';
}
function con(estado: EstadoActividades, ...o: OperacionTarea[]): EstadoActividades {
  return { ...estado, operaciones: [...estado.operaciones, ...o] };
}

const CUALQUIER_INTERNO = [{ tipo: 'human' as const }];

export const CAPACIDAD_ACTIVIDADES = crearCapacidad<EstadoActividades>({
  id: 'actividades',
  nombre: 'Calendario: tareas propias y para otros equipos, con tiempo invertido',
  journey: 'Hipótesis transversal: qué tengo que hacer hoy, qué le pedí a otro equipo y cuánto tiempo me llevó',
  entidades: ['Task · E-063', 'Internal Actor · E-006', 'Área de la organización (Datos base)', 'Time Entry · hipótesis'],
  estados: {
    pending: { etiqueta: 'Pendiente', responsable: 'Su responsable o, si nadie la tomó, el equipo asignado' },
    waiting: { etiqueta: 'En curso', responsable: 'Su responsable' },
    ok: { etiqueta: 'Cerrada', responsable: 'Su responsable' },
  },

  acciones: [
    {
      id: 'crear-tarea',
      nombre: 'Crear una tarea',
      descripcion: 'Crea una tarea para sí mismo o la asigna a otro equipo. Si va a otro equipo, cae en su bandeja hasta que alguien la tome.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: {
        titulo: 'string', tipo: TIPOS_TAREA.join(' | '), prioridad: PRIORIDADES.join(' | '), fechaInicio: 'AAAA-MM-DD', fechaFin: 'AAAA-MM-DD',
        asignarA: "'mi' | 'equipo'", equipoId: 'código de un área de Datos base', clienteTipo: 'agente | agencia | lead (opcional)', clienteId: 'id', clienteNombre: 'nombre', descripcion: 'opcional',
      },
      consecuencia: {
        cambia: 'Se crea la tarea en «Pendiente». Para sí: queda en su calendario. Para otro equipo: queda en la bandeja de ese equipo y en «Pedidas».',
        noCambia: 'El calendario de los demás: nadie del otro equipo la ve en su calendario hasta tomarla.',
        alcance: 'Una tarea.',
        requiere: 'Nombre, fecha de inicio y de fin (la de fin no antes que la de inicio) y, si va a otro equipo, uno que exista y no sea el propio.',
        registro: 'Quién la creó, para quién y cuándo.',
      },
      regla: 'Prototipo PB-002 v2.6 · pedido de negocio 2026-10-01 · E-063 · hipótesis: el equipo es el área',
      emite: ['task.created'],
      aplicar(estado, entrada, actor) {
        const yo = estado.empleados.find((e) => e.id === actor?.id);
        if (!yo) return { error: 'Solo una persona interna crea tareas.' };
        const titulo = texto(entrada.titulo);
        if (!titulo) return { error: 'Falta el nombre de la tarea.' };
        if (titulo.length > 140) return { error: 'El nombre de la tarea tiene que tener 140 caracteres o menos.' };
        const tipo = (entrada.tipo || 'tarea') as TipoTarea;
        if (!TIPOS_TAREA.includes(tipo)) return { error: `Tipo desconocido: ${tipo}.` };
        const prioridad = (entrada.prioridad || 'normal') as Prioridad;
        if (!PRIORIDADES.includes(prioridad)) return { error: `Prioridad desconocida: ${prioridad}.` };
        const fechaInicio = texto(entrada.fechaInicio);
        const fechaFin = texto(entrada.fechaFin);
        if (!fechaValida(fechaInicio) || !fechaValida(fechaFin)) return { error: 'Faltan la fecha de inicio o la de fin.' };
        if (fechaFin < fechaInicio) return { error: 'La fecha de fin no puede ser anterior a la de inicio.' };
        const aEquipo = entrada.asignarA === 'equipo';
        const equipoId = texto(entrada.equipoId);
        if (aEquipo) {
          if (!estado.areas.includes(equipoId)) return { error: 'Elige el equipo al que se la asignas.' };
          if (equipoId === yo.areaId) return { error: 'Ese es tu propio equipo: créala para ti.' };
        }
        const clienteTipo = texto(entrada.clienteTipo);
        const cliente =
          clienteTipo && ['agente', 'agencia', 'lead'].includes(clienteTipo) && texto(entrada.clienteId)
            ? { tipo: clienteTipo as 'agente' | 'agencia' | 'lead', id: texto(entrada.clienteId), nombre: texto(entrada.clienteNombre) || texto(entrada.clienteId) }
            : null;
        const motivo = aEquipo ? `Asignada al equipo ${equipoId}; nadie la tomó todavía` : 'Creada; sin empezar';
        return {
          estado: con(estado, {
            tipo: 'crear',
            tarea: { titulo, tipo, prioridad, fechaInicio, fechaFin, motivo, creadaPor: yo.id, equipoId: aEquipo ? equipoId : null, responsableId: aEquipo ? null : yo.id, cliente, descripcion: texto(entrada.descripcion) || null },
          }),
          cambios: [{ entidad: 'Task · E-063', id: titulo, de: '—', a: 'Pendiente', motivo: aEquipo ? `para ${equipoId}` : 'para sí' }],
          salida: aEquipo ? `La tarea quedó en la bandeja de ${equipoId}.` : 'La tarea quedó en tu calendario.',
        };
      },
    },
    {
      id: 'tomar-tarea',
      nombre: 'Tomar una tarea de la bandeja de mi equipo',
      descripcion: 'Una persona del equipo asignado se hace responsable. Desde ahí la tarea entra en su calendario.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: { tareaId: 'id' },
      consecuencia: {
        cambia: 'El responsable de la tarea; aparece en su calendario.',
        noCambia: 'Su estado, su prioridad y sus fechas.',
        alcance: 'Una tarea.',
        requiere: 'Que la tarea esté asignada a su equipo y que nadie la haya tomado.',
        registro: 'Quién la tomó y cuándo; quien la creó lo ve.',
      },
      regla: 'Prototipo PB-002 v2.6 · hipótesis: cualquiera del equipo la toma',
      emite: ['task.assigned'],
      aplicar(estado, entrada, actor) {
        const t = buscar(estado, entrada.tareaId);
        if (!t) return { error: 'Esa tarea no existe.' };
        if (t.responsableId) return { error: `Ya la tomó ${nombreDe(estado, t.responsableId)}.` };
        const yo = estado.empleados.find((e) => e.id === actor?.id);
        if (!yo || !enBandeja(t, yo)) return { error: 'Esa tarea no está asignada a tu equipo.' };
        const motivo = `La tomó ${yo.nombre}`;
        return {
          estado: con(estado, { tipo: 'tomar', id: t.id, responsableId: yo.id, motivo }),
          cambios: [{ entidad: 'Task · E-063', id: t.titulo, de: `Sin tomar (${t.equipoId})`, a: yo.nombre }],
          salida: 'La tarea entró en tu calendario.',
        };
      },
    },
    {
      id: 'cambiar-estado-tarea',
      nombre: 'Cambiar el estado de una tarea',
      descripcion: 'Pendiente, en curso o cerrada, siempre con motivo.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: { tareaId: 'id', estado: ESTADOS_TAREA.join(' | '), motivo: 'string' },
      consecuencia: {
        cambia: 'El estado, el motivo y el historial de la tarea.',
        noCambia: 'El tiempo ya registrado.',
        alcance: 'Una tarea.',
        requiere: 'Ser su responsable, un estado distinto al actual, un motivo y, para cerrarla, que su cronómetro no esté corriendo.',
        registro: 'Quién, cuándo, de qué estado a cuál y por qué; quien la creó lo ve.',
      },
      regla: 'Ningún estado sin motivo (regla dura del kit) · E-063',
      emite: ['task.status-changed'],
      aplicar(estado, entrada, actor) {
        const t = buscar(estado, entrada.tareaId);
        if (!t) return { error: 'Esa tarea no existe.' };
        const no = soloResponsable(estado, t, actor);
        if (no) return { error: no };
        const nuevo = entrada.estado as EstadoTarea;
        if (!ESTADOS_TAREA.includes(nuevo)) return { error: `Estado desconocido: ${entrada.estado}.` };
        if (t.estado === nuevo) return { error: `La tarea ya está ${ETIQUETA[nuevo].toLowerCase()}.` };
        const motivo = texto(entrada.motivo);
        if (!motivo) return { error: 'Falta el motivo del cambio.' };
        if (nuevo === 'cerrada' && estado.cronometros.some((c) => c.empleadoId === actor?.id && c.tareaId === t.id)) {
          return { error: 'Detén el cronómetro antes de cerrarla, para que el tiempo quede registrado.' };
        }
        return {
          estado: con(estado, { tipo: 'estado', id: t.id, estado: nuevo, motivo, quien: actor!.id! }),
          cambios: [{ entidad: 'Task · E-063', id: t.titulo, de: ETIQUETA[t.estado], a: ETIQUETA[nuevo], motivo }],
        };
      },
    },
    {
      id: 'registrar-tiempo',
      nombre: 'Registrar tiempo invertido a mano',
      descripcion: 'Suma minutos trabajados en la tarea, con fecha y nota opcional.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: { tareaId: 'id', minutos: 'número > 0', fecha: 'AAAA-MM-DD', nota: 'opcional' },
      consecuencia: {
        cambia: 'El tiempo invertido de la tarea.',
        noCambia: 'Su estado.',
        alcance: 'Una tarea, una persona.',
        requiere: 'Ser su responsable, minutos mayores que 0 (hasta 24 horas por registro) y una fecha que no sea futura.',
        registro: 'Quién, cuánto, para qué día y que fue a mano.',
      },
      regla: 'Prototipo PB-002 v2.6 · hipótesis: el tiempo lo registra quien trabaja la tarea',
      emite: ['task.time-logged'],
      aplicar(estado, entrada, actor) {
        const t = buscar(estado, entrada.tareaId);
        if (!t) return { error: 'Esa tarea no existe.' };
        const no = soloResponsable(estado, t, actor);
        if (no) return { error: no };
        const min = Math.round(Number(entrada.minutos));
        if (!(min > 0)) return { error: 'El tiempo tiene que ser mayor que cero.' };
        if (min > 24 * 60) return { error: 'Un registro no puede pasar de 24 horas.' };
        const fecha = texto(entrada.fecha) || estado.hoy;
        if (!fechaValida(fecha)) return { error: 'La fecha no es válida.' };
        if (fecha > estado.hoy) return { error: 'No se registra tiempo en una fecha futura.' };
        return {
          estado: con(estado, { tipo: 'tiempo', id: t.id, empleadoId: actor!.id!, minutos: min, fecha, origen: 'manual', nota: texto(entrada.nota) || null }),
          cambios: [{ entidad: 'Time Entry · hipótesis', id: t.titulo, de: duracion(minutosDe(t)), a: duracion(minutosDe(t) + min), motivo: `+${duracion(min)} a mano · ${fecha}` }],
        };
      },
    },
    {
      id: 'iniciar-cronometro',
      nombre: 'Arrancar el cronómetro de una tarea',
      descripcion: 'Empieza a contar el tiempo. Una persona tiene un solo cronómetro corriendo. Si la tarea estaba pendiente, pasa a en curso.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: { tareaId: 'id' },
      consecuencia: {
        cambia: 'Su cronómetro queda corriendo en esta tarea; si estaba pendiente, pasa a «En curso» con motivo.',
        noCambia: 'El tiempo registrado hasta que lo detenga.',
        alcance: 'Una tarea, una persona.',
        requiere: 'Ser su responsable, que no esté cerrada y no tener otro cronómetro corriendo.',
        registro: 'Cuándo arrancó.',
      },
      regla: 'Prototipo PB-002 v2.6 · hipótesis: un cronómetro por persona',
      emite: ['task.timer-started'],
      aplicar(estado, entrada, actor) {
        const t = buscar(estado, entrada.tareaId);
        if (!t) return { error: 'Esa tarea no existe.' };
        const no = soloResponsable(estado, t, actor);
        if (no) return { error: no };
        if (t.estado === 'cerrada') return { error: 'La tarea está cerrada.' };
        const actual = estado.cronometros.find((c) => c.empleadoId === actor?.id);
        if (actual) return { error: `Ya tienes el cronómetro corriendo en «${buscar(estado, actual.tareaId)?.titulo ?? actual.tareaId}». Detenlo primero.` };
        const pasa = t.estado === 'pendiente';
        const ops: OperacionTarea[] = [{ tipo: 'cronometro-inicio', empleadoId: actor!.id!, tareaId: t.id }];
        if (pasa) ops.push({ tipo: 'estado', id: t.id, estado: 'en-curso', motivo: 'Arrancó el cronómetro', quien: actor!.id! });
        return {
          estado: con(estado, ...ops),
          cambios: [{ entidad: 'Task · E-063', id: t.titulo, de: ETIQUETA[t.estado], a: pasa ? 'En curso' : ETIQUETA[t.estado], motivo: 'Arrancó el cronómetro' }],
        };
      },
    },
    {
      id: 'detener-cronometro',
      nombre: 'Detener el cronómetro',
      descripcion: 'Detiene el cronómetro y registra el tiempo transcurrido en la tarea.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      entrada: {},
      consecuencia: {
        cambia: 'Suma el tiempo transcurrido (redondeado al minuto, mínimo 1) a la tarea.',
        noCambia: 'El estado de la tarea.',
        alcance: 'Una tarea, una persona.',
        requiere: 'Tener un cronómetro corriendo.',
        registro: 'Quién, cuánto y que fue con cronómetro.',
      },
      regla: 'Prototipo PB-002 v2.6',
      emite: ['task.time-logged'],
      aplicar(estado, _entrada, actor) {
        const c = estado.cronometros.find((x) => x.empleadoId === actor?.id);
        if (!c) return { error: 'No tienes ningún cronómetro corriendo.' };
        const t = buscar(estado, c.tareaId);
        const fin: OperacionTarea = { tipo: 'cronometro-fin', empleadoId: c.empleadoId };
        if (!t) return { estado: con(estado, fin), cambios: [] };
        const min = minutosCronometro(Date.parse(c.inicio), estado.ahora);
        return {
          estado: con(estado, fin, { tipo: 'tiempo', id: t.id, empleadoId: c.empleadoId, minutos: Math.min(min, 24 * 60), fecha: estado.hoy, origen: 'cronometro', nota: null }),
          cambios: [{ entidad: 'Time Entry · hipótesis', id: t.titulo, de: duracion(minutosDe(t)), a: duracion(minutosDe(t) + min), motivo: `+${duracion(min)} con cronómetro` }],
          salida: `Se registraron ${duracion(min)} en «${t.titulo}».`,
        };
      },
    },
    {
      id: 'exportar-tareas',
      nombre: 'Exportar tareas',
      descripcion: 'Solo lectura: valida que la persona pueda ver todas las tareas pedidas. El archivo se arma en el navegador.',
      quien: CUALQUIER_INTERNO,
      canales: ['ui'],
      soloLectura: true,
      entrada: { tareaIds: 'ids separados por coma' },
      consecuencia: { cambia: 'Nada.', alcance: 'Solo tareas que la persona puede ver.', requiere: 'Al menos una tarea.', registro: 'Quién exportó cuántas tareas y cuándo.' },
      regla: 'Hipótesis del prototipo: exportar no amplía el alcance de nadie; deja rastro como cualquier consulta',
      aplicar(estado, entrada, actor) {
        const yo = estado.empleados.find((e) => e.id === actor?.id);
        const ids = (entrada.tareaIds ?? '').split(',').filter(Boolean);
        const lista = ids.map((id) => buscar(estado, id)).filter((t): t is Tarea => !!t);
        if (!yo || !lista.length) return { error: 'No hay tareas para exportar en esta vista.' };
        const ajenas = lista.filter((t) => !puedeVer(t, yo, estado.empleados));
        if (ajenas.length) return { error: `Hay ${ajenas.length} tarea(s) fuera de tu alcance.` };
        return { estado, cambios: [], salida: `${lista.length} tarea(s) exportadas`, datos: { tareaIds: lista.map((t) => t.id) } };
      },
    },
  ],
});

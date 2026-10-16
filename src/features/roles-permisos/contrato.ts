/**
 * PB-002 · CONTRATO DE LA CAPABILITY
 *
 * Este prototipo es un shell de navegacion (amplitud, no profundidad): un menu
 * con los 15 Flujos end-to-end del negocio, agrupados por area, mas un motor de
 * Roles y Permisos. De los 16 "modulos" del shell, uno solo tiene un contrato
 * ejecutable de verdad: GESTION DE ROLES Y PERMISOS. Es el unico con modelo y
 * mapeo "cerrados" segun el insumo (`roles-permisos-spec.md`, estado: "Modelo y
 * mapeo cerrados. Pendiente: inventario de acciones atomicas").
 *
 * Los otros 15 Flujos se muestran como pantallas de referencia: titulo, area
 * duena, que ve/puede cada rol y, para algunos, una cola mock con estados. NO
 * tienen acciones ejecutables porque decidir sus acciones/objetos atomicos esta
 * marcado como pendiente en el propio insumo (`flujos-acciones-objetos.md`).
 * Construir ahi un contrato ejecutable habria inventado una precision que el
 * negocio todavia no cerro. Ver `hallazgos.md`.
 *
 * MODELO ADITIVO (la pieza central): una persona puede tener VARIAS
 * asignaciones (rol + alcance + LOB) simultaneas. Sus permisos efectivos son la
 * UNION de todas, nunca "gana la mas alta". Caso real que el contrato soporta
 * sin friccion: Ana es Manager de BOB & Commissions Y AL MISMO TIEMPO Doer del
 * mismo alcance.
 *
 * Entidades: Role · E-008, Grantable Action · E-009, Internal Actor · E-006.
 * Area y Assignment NO estan en el catalogo de 55 entidades: HIPOTESIS.
 */
import { crearCapacidad } from '@arc2-0/claro-one-kit/capacidad';
import type { Evento } from '@arc2-0/claro-one-kit/capacidad';
import type { AlcanceTipo, Asignacion, Empleado } from '@arc2-0/claro-one-kit/dominio';

export interface EstadoRoles {
  empleados: Empleado[];
  eventos: Evento[];
}

const sinAcentos = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, '');

export const CAPACIDAD = crearCapacidad<EstadoRoles>({
  id: 'gestion-de-roles-y-permisos',
  nombre: 'Gestión de Roles y Permisos',
  journey:
    'Sin journey formal todavía (no está en journeys/). Insumo: roles-permisos-spec.md + Miro "Rol interno" (Paso 1 Crear usuario → Paso 2 Asignar rol/alcance/LOB → Paso 3 Permisos)',
  entidades: [
    'Role · E-008 (catálogo fijo de 5)',
    'Grantable Action · E-009',
    'Internal Actor · E-006',
    'Area · HIPÓTESIS (no está en el catálogo — "areas" con parent_id del insumo)',
    'Assignment · HIPÓTESIS (no está en el catálogo — "user_role_assignments": rol+alcance+LOB, N por usuario)',
  ],
  estados: {
    ok: { etiqueta: 'Activa', responsable: 'Assignment · hipótesis' },
    neutral: { etiqueta: 'Revocada', responsable: 'Assignment · hipótesis · histórica' },
  },

  acciones: [
    {
      id: 'crear-usuario',
      nombre: 'Crear usuario',
      descripcion:
        'Alta de un Internal Actor nuevo: datos básicos, puesto y área. Sin asignaciones todavía — no puede hacer nada hasta que se le asigne un rol.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { nombre: 'string', puesto: 'string', areaId: 'string' },
      consecuencia: {
        cambia: 'Se crea un Internal Actor nuevo, sin asignaciones.',
        noCambia: 'Ningún permiso: sin asignación, el usuario no ve ni puede nada.',
        alcance: 'Solo este usuario.',
        requiere: 'Nombre, puesto y área.',
        registro: 'Quién lo creó, cuándo, con qué puesto y área inicial.',
      },
      regla: 'Miro "Rol interno" · Paso 1 · sin RUL asignada',
      emite: ['employee.created'],
      aplicar(estado, entrada) {
        const nombre = entrada.nombre ?? '';
        const puesto = entrada.puesto ?? '';
        const areaId = entrada.areaId ?? '';
        if (!nombre || !puesto || !areaId) return { error: 'Nombre, puesto y área son obligatorios.' };
        const id = 'u-' + sinAcentos(nombre);
        if (estado.empleados.some((e) => e.id === id)) {
          return { error: `Ya existe un usuario con un identificador equivalente a "${nombre}".` };
        }
        const nuevo: Empleado = { id, nombre, puesto, areaId, asignaciones: [], ficticio: true };
        return {
          estado: { ...estado, empleados: [...estado.empleados, nuevo] },
          cambios: [
            { entidad: 'Internal Actor · E-006', id, de: '—', a: 'creado', motivo: `Puesto: ${puesto}` },
          ],
          salida: `${nombre} creado sin asignaciones.`,
        };
      },
    },

    {
      id: 'asignar-rol',
      nombre: 'Asignar rol',
      descripcion:
        'Agrega una asignación (rol + alcance + LOB) a un usuario. ADITIVO: nunca reemplaza las asignaciones que ya tiene — así se soporta que un Manager sea también Doer de su propio alcance, al mismo tiempo.',
      quien: [
        { tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' },
        { tipo: 'ai-agent', modo: 'propone' },
      ],
      canales: ['ui', 'tool'],
      entrada: {
        empleadoId: 'string',
        rolId: 'string',
        alcanceTipo: "'global' | 'vertical' | 'team' | 'self'",
        alcanceValor: 'areaId (null si global)',
        lob: "'Life' | 'Medicare' | 'P&C' | null",
      },
      consecuencia: {
        cambia: 'Se agrega una asignación nueva y queda Activa de inmediato.',
        noCambia:
          'Las asignaciones que el usuario ya tenía siguen activas sin cambio — la unión de permisos solo crece.',
        alcance: 'Solo este usuario y esta asignación nueva.',
        requiere: 'Un rol del catálogo fijo de 5. Alcance y LOB según el área (no todas son LOB-aware).',
        registro: 'Quién asignó, a quién, qué rol/alcance/LOB, y cuándo.',
      },
      regla: 'roles-permisos-spec.md §2-3 · modelo aditivo confirmado con el negocio',
      emite: ['assignment.created'],
      aplicar(estado, entrada) {
        const i = estado.empleados.findIndex((e) => e.id === entrada.empleadoId);
        const emp = estado.empleados[i];
        if (!emp) return { error: `No existe el usuario ${entrada.empleadoId}.` };
        const lob = entrada.lob ?? null;
        const alcanceValor = entrada.alcanceValor ?? null;
        const dup = emp.asignaciones.find(
          (a) => a.est === 'ok' && a.rolId === entrada.rolId && a.alcanceValor === alcanceValor && (a.lob ?? null) === lob,
        );
        if (dup) return { error: 'Esa asignación exacta ya está activa para este usuario.' };
        const asignacionId = emp.id + '-a' + (emp.asignaciones.length + 1);
        const nueva: Asignacion = {
          id: asignacionId,
          rolId: entrada.rolId ?? '',
          alcanceTipo: (entrada.alcanceTipo ?? 'team') as AlcanceTipo,
          alcanceValor,
          lob,
          est: 'ok',
          desde: new Date().toISOString().slice(0, 10),
        };
        const empleados = estado.empleados.slice();
        empleados[i] = { ...emp, asignaciones: [...emp.asignaciones, nueva] };
        return {
          estado: { ...estado, empleados },
          cambios: [
            {
              entidad: 'Assignment · hipótesis',
              id: asignacionId,
              de: '—',
              a: `${entrada.rolId} · ${entrada.alcanceTipo}${lob ? ' · ' + lob : ''}`,
              motivo: `Agregada a ${emp.nombre}, aditiva sobre sus ${emp.asignaciones.length} asignación(es) previas`,
            },
          ],
        };
      },
    },

    {
      id: 'revocar-asignacion',
      nombre: 'Revocar asignación',
      descripcion: 'Da de baja UNA asignación puntual. Las demás asignaciones del usuario no se tocan.',
      quien: [{ tipo: 'human', roles: ['Configurador / Admin'], ambito: 'global' }],
      canales: ['ui'],
      entrada: { empleadoId: 'string', asignacionId: 'string' },
      consecuencia: {
        cambia: 'Esa asignación pasa a Revocada y deja de aportar permisos a la unión.',
        noCambia: 'Las demás asignaciones activas del usuario.',
        alcance: 'Solo esta asignación.',
        requiere: 'Que la asignación exista y esté Activa.',
        registro: 'Quién revocó, cuándo y cuál asignación.',
      },
      regla: 'hipótesis EXPLORE · sin RUL asignada',
      emite: ['assignment.revoked'],
      aplicar(estado, entrada) {
        const i = estado.empleados.findIndex((e) => e.id === entrada.empleadoId);
        const emp = estado.empleados[i];
        if (!emp) return { error: `No existe el usuario ${entrada.empleadoId}.` };
        const j = emp.asignaciones.findIndex((a) => a.id === entrada.asignacionId);
        const antes = emp.asignaciones[j];
        if (!antes) return { error: 'Esa asignación no existe.' };
        if (antes.est !== 'ok') return { error: 'Esa asignación ya está revocada.' };
        const asignaciones = emp.asignaciones.slice();
        asignaciones[j] = { ...antes, est: 'neutral' };
        const empleados = estado.empleados.slice();
        empleados[i] = { ...emp, asignaciones };
        return {
          estado: { ...estado, empleados },
          cambios: [
            { entidad: 'Assignment · hipótesis', id: antes.id, de: 'ok', a: 'neutral', motivo: `Revocada sobre ${emp.nombre}` },
          ],
        };
      },
    },

    {
      id: 'sugerir-asignacion',
      nombre: 'Sugerir asignación para un usuario nuevo',
      descripcion:
        'ASK → UNDERSTAND → ASSIST (patrón P11). Solo lectura: busca en la plantilla organizacional un puesto/área parecido y propone qué asignar. Nunca ejecuta — el Configurador/Admin confirma con "Asignar rol".',
      quien: [{ tipo: 'ai-agent' }, { tipo: 'human' }],
      canales: ['tool', 'ui'],
      soloLectura: true,
      entrada: { empleadoId: 'string' },
      consecuencia: {
        cambia: 'Nada.',
        registro: 'Qué se consultó y qué se sugirió, para auditar a la IA igual que a una persona.',
      },
      regla: 'P11 · Ask Claro',
      aplicar(estado, entrada) {
        const emp = estado.empleados.find((e) => e.id === entrada.empleadoId);
        if (!emp) return { error: `No existe el usuario ${entrada.empleadoId}.` };
        const par = estado.empleados.find(
          (e) => e.id !== emp.id && e.areaId === emp.areaId && e.asignaciones.some((a) => a.est === 'ok'),
        );
        if (!par) {
          return {
            estado,
            cambios: [],
            salida: `No encontré a nadie más en "${emp.areaId}" con asignaciones activas para usar de referencia.`,
          };
        }
        const activas = par.asignaciones.filter((a) => a.est === 'ok');
        return {
          estado,
          cambios: [],
          salida: `${par.nombre} tiene el mismo puesto/área y hoy tiene ${activas.map((a) => a.rolId).join(' + ')}. Sugiero calcar esa combinación para ${emp.nombre}.`,
          datos: {
            sugerencias: activas.map((a) => ({
              accionId: 'asignar-rol',
              entrada: {
                empleadoId: emp.id,
                rolId: a.rolId,
                alcanceTipo: a.alcanceTipo,
                alcanceValor: a.alcanceValor,
                lob: a.lob,
              },
            })),
          },
        };
      },
    },
  ],
});

import 'server-only';
import { crearDb } from './conexion';

export type { Db, Tx } from './conexion';

/* Una sola conexión por proceso: en desarrollo el recargado en caliente reevalúa este módulo, y
   sin el global abriría un pool nuevo en cada guardado. */
const global_ = globalThis as unknown as { __claroDb?: ReturnType<typeof crearDb>['db'] };
export const db = global_.__claroDb ?? crearDb().db;
if (process.env.NODE_ENV !== 'production') global_.__claroDb = db;

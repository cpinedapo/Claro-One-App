/* Sin `server-only` a propósito: lo usan también los scripts de terminal (bootstrap, seed), que
   corren fuera de Next. La app entra siempre por `./index.ts`. */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function crearDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Falta DATABASE_URL (ver .env.example).');
  const cliente = postgres(url, { max: 10 });
  return { db: drizzle(cliente, { schema }), cerrar: () => cliente.end() };
}

export type Db = ReturnType<typeof crearDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

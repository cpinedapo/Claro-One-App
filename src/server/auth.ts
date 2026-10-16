/**
 * Autenticación. Fase 1: solo personal interno, con su cuenta corporativa de Google Workspace.
 *
 * Entrar no es lo mismo que poder hacer algo: la sesión dice QUIÉN es (un correo), y lo que puede ver
 * y hacer sale de sus asignaciones activas como `empleado`. Un correo del dominio sin empleado
 * enlazado entra a «Sin acceso», nunca a una pantalla vacía.
 */
import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { db } from './db';
import { account, session, user, verification } from './db/schema';

export const DOMINIO_CORPORATIVO = (process.env.ALLOWED_EMAIL_DOMAIN ?? 'claroinsurance.com').toLowerCase();

export const esCorreoCorporativo = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith('@' + DOMINIO_CORPORATIVO);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            prompt: 'select_account',
          },
        }
      : {},
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          if (!esCorreoCorporativo(u.email)) {
            throw new APIError('FORBIDDEN', { message: `Solo pueden entrar cuentas @${DOMINIO_CORPORATIVO}.` });
          }
          return { data: u };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

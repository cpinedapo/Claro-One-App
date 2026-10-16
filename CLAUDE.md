# CLAUDE.md · Claro One App

Contrato operativo de este repositorio. Enruta; el conocimiento vive en las fuentes.

## Qué es esto

**El producto Claro One**: el CRM + ERP de la FMO (Claro Insurance / AtoZ) y sus agencias internas.
Una sola aplicación web con cuatro perspectivas (Internal, Agente, Agencia y Lead) que también se
embebe en mobile.

| Fase | Quién entra | Cómo |
| :-- | :-- | :-- |
| **1 (actual)** | Personal interno | Google Workspace corporativo (`@claroinsurance.com`) |
| 2 | Agentes, Agencias, Leads | Por definir |

## Las tres fuentes

| Repo | Rol | Permiso |
| :-- | :-- | :-- |
| [`claro-one-agentic-harness`](https://github.com/ARC2-0/claro-one-agentic-harness) | El negocio: entidades, reglas, journeys, roles y decisiones | **Solo lectura.** Es muy grande: **no se recorre entero.** Antes de consultarlo, pregúntale a la usuaria qué parte leer |
| [`claro-one-kit`](https://github.com/ARC2-0/claro-one-kit) (`@arc2-0/claro-one-kit`) | La forma: tema, patrones, shell, tipos, reglas puras y contratos | Se consume como dependencia. Lo que falte se propone **allá**, no se copia acá |
| Este repo | El producto: stack, persistencia, auth, rutas | Se escribe |

**Cuando el arnés y el kit se contradicen, manda el arnés. Cuando el kit y este repo se contradicen, manda el kit.**

## Stack

Next.js 16 (App Router) · React 19 · antd 6 vía el kit · PostgreSQL 17 · Drizzle ORM · Better Auth (Google) · pnpm 11.

## El árbol

Es el espejo de `ESTRUCTURA-DEL-FRONT.md` del kit, adaptado al App Router:

```
src/
├── app/                         rutas (la costura de RUTAS). Páginas = server components que cargan y pasan props
│   ├── (app)/                   todo lo que vive dentro del shell: exige sesión + empleado
│   ├── login/ · sin-acceso/     fuera del shell
│   ├── api/auth/[...all]/       Better Auth
│   └── providers/ThemeProvider  ConfigProvider con el tema del kit
├── components/                  lo que usan 2+ features. `layout/` = Shell + menú calculado
├── dominio/                     puro: sin React, sin antd, sin DB (actor.ts, tipos.ts)
├── features/<slug>/
│   ├── contrato.ts              la capability, VERBATIM del prototipo
│   ├── acciones.ts              'use server': la única puerta de escritura
│   ├── persistencia.ts          cargar estado + persistir el diff
│   ├── use<Capability>.ts       el hook del navegador
│   └── components/              pantallas `Pantalla*`, todo por props
├── server/                      solo servidor: db/, auth, sesion, datos (la costura de DATOS), capacidad (la de ESCRITURAS)
└── routes/rutas.ts              las URLs
```

## Las reglas duras

Las 7 del kit aplican tal cual (colores y medidas solo de `theme.useToken()`, nada reimplementado si
antd o el kit lo tienen, iconos de `lucide-react`, ningún estado/vacío/cifra sin motivo y
procedencia, **ninguna acción sin contrato**, `Drawer` para mostrar y `Modal` para actuar, cero
warnings). Además:

1. **Toda escritura pasa por `ejecutarYPersistir`** (`src/server/capacidad.ts`): contrato del kit
   primero, persistencia después, evento en el rastro siempre (también los rechazos).
2. **El actor lo decide el servidor**, desde la sesión. El navegador solo manda acción y entrada.
   Toda acción que escribe empieza con `exigirEmpleadoParaEscribir()`: usa la identidad REAL y
   rechaza escribir mientras un Administrador está en «Ver como» (H-009).
3. **Los atributos fechados no se aplanan.** Revocar o vencer cierra un intervalo (`valid_to`), no
   borra ni sobreescribe. La tabla `evento` es append-only.
4. **Los catálogos no van a la base.** Roles, áreas, Flujos, compañías y permisos se importan de
   `@arc2-0/claro-one-kit/dominio`; las tablas guardan su id. **Excepción, los baselines** (H-018):
   carriers, estados, LOB, cargos y áreas de la organización viven en la tabla `baselines`, los administra Configuración › Datos base y
   las opciones de los formularios salen de ahí (`cargarBaselinesVigentes`), nunca de una lista en el código.
5. **Una pantalla nunca importa fixtures ni la base.** Recibe todo por props.
6. **Una feature no importa de otra.** Lo compartido sube a `components/`.
7. **Ningún texto de interfaz escrito en el componente.** Todo va en `src/i18n/mensajes.ts` (`es` define la
   forma, `en` no compila si falta algo). En el cliente, `useIdioma()`; en el servidor, `mensajesServidor()`.
   Se traduce la pantalla, no los datos (nombres de Flujos, áreas, agencias, contratos).
8. **Los componentes del kit no traen `'use client'`.** Una página de servidor no los renderiza
   directo: pasa por un componente cliente (`components/Comunes.tsx` o la pantalla de la feature).

## El orden de construcción de una feature nueva

```
consultar el arnés (con la usuaria) → contrato.ts → persistencia.ts + migración → acciones.ts
→ use<Capability>.ts → components/ → la página en app/ → el menú en components/layout/menu.ts
```

Si la feature necesita una entidad o un estado nuevo, es un cambio al **kit** antes que acá.

## Comandos

```bash
pnpm db:up           # PostgreSQL en Docker (puerto 55433)
pnpm db:migrate      # aplica las migraciones de drizzle/
pnpm db:bootstrap    # crea el primer Configurador/Admin (BOOTSTRAP_ADMIN_EMAIL)
pnpm db:seed         # datos de DEMO del kit (se niega en producción)
pnpm dev             # http://localhost:3100
pnpm typecheck
pnpm build
pnpm db:generate --name <cambio>   # tras tocar src/server/db/schema.ts
```

## Al cerrar un cambio

- [ ] `pnpm typecheck` y `pnpm build` limpios
- [ ] Recorrido en navegador real, consola sin warnings
- [ ] Ancho móvil (390px) revisado: es una app que se embebe
- [ ] Lo que se asumió o lo que le falta al kit, anotado en `docs/hallazgos.md`

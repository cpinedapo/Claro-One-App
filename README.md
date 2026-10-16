# Claro One

El CRM + ERP de Claro Insurance: agentes, agencias, contratos, pólizas y comisiones en un solo lugar.
Next.js + PostgreSQL, sobre el design system [`@arc2-0/claro-one-kit`](https://github.com/ARC2-0/claro-one-kit).

## Qué hay hoy (Fase 1, personal interno)

| Módulo | Ruta | Estado |
| :-- | :-- | :-- |
| Login con Google Workspace | `/login` | Solo cuentas `@claroinsurance.com` |
| Shell con menú calculado por alcance | todas | El menú sale de las asignaciones activas, no de una configuración |
| Inicio | `/` | Lo que ve cada persona según su alcance |
| **Gestión de Roles y Permisos** | `/configuracion/roles-permisos` | Crear usuario, asignar y revocar roles con modelo aditivo, Ask Claro sugiere, todo con rastro auditable |
| **Directorio** | `/directorio` | De solo lectura: agencias en árbol (con su representante y staff dentro), agentes, vendedores de descuento y benefit coordinators, de agencia o independientes por contrato |
| Los 15 Flujos de negocio | `/flujos/<id>` | De referencia y solo lectura hasta que el arnés cierre sus contratos |

## Primer arranque

Requisitos: Node 24, pnpm 11 (`npm i -g pnpm@11`), Docker.

**1. Acceso al kit.** Se publica en GitHub Packages con acceso restringido. Crea un token clásico
(GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)*) con el
permiso `read:packages`, autorízalo para la organización ARC2-0 si pide SSO, y déjalo en tu entorno:

```bash
setx NODE_AUTH_TOKEN "ghp_..."      # Windows (abre una terminal nueva después)
export NODE_AUTH_TOKEN=ghp_...      # macOS / Linux
```

**2. Instalar, base de datos y datos iniciales:**

```bash
pnpm install
cp .env.example .env.local        # y completa BETTER_AUTH_SECRET
pnpm db:up
pnpm db:migrate
pnpm db:bootstrap                 # tu correo (BOOTSTRAP_ADMIN_EMAIL) queda como Configurador/Admin
pnpm db:seed                      # opcional: empleados y Directorio de demostración
pnpm dev                          # http://localhost:3100
```

**3. Google.** Mientras no haya credenciales, en desarrollo se entra automáticamente como
`DEV_LOGIN_EMAIL` (tu propio usuario). Para el login real, crea un OAuth Client tipo *Web application* en Google Cloud
Console con el redirect `http://localhost:3100/api/auth/callback/google`, y completa
`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

## Cómo se trabaja aquí

[CLAUDE.md](CLAUDE.md) tiene las reglas, el árbol y el orden de construcción. En
[docs/hallazgos.md](docs/hallazgos.md) está lo que se asumió y lo que le falta al kit.

# Hallazgos

Lo que apareció al construir el producto sobre el kit y el arnés: supuestos, faltantes y
contradicciones. Cada uno dice **a quién le toca** resolverlo.

| ID | Qué | Le toca a | Estado |
| :-- | :-- | :-- | :-- |
| H-001 | El contrato `crear-usuario` no pide correo | Arnés + kit | Mitigado en el producto |
| H-002 | `AppShell` y `MenuLateral` no se pueden renderizar en el servidor | Kit | Mitigado en el producto |
| H-003 | `RastroDeEventos` usa props deprecadas de `Timeline` (rompe la regla 7) | Kit | **Abierto** |
| H-004 | El shell no tiene variante móvil | Kit | Mitigado a medias |
| H-005 | La `BarraSuperior` no permite cerrar sesión | Kit | Mitigado en el producto |
| H-006 | Google bloquea el login dentro de un WebView | Producto (mobile) | Decisión pendiente |
| H-007 | Quién ve el Directorio | Arnés | Supuesto |
| H-008 | «Configurador / Admin» se llama «Administrador» | Arnés + kit | Mitigado en el producto |
| H-009 | «Ver como» para soporte: capability sin respaldo en el arnés | Arnés | Construida, por validar |
| H-010 | El Directorio tiene 5 tipos de papel, N a N y por contrato | Arnés + kit | Reemplazado en parte por H-013 |
| H-011 | Jerarquía de agencias: Table en árbol en vez de `Tree` (Manual 3.1) | Kit (UX) | Decisión por validar |
| H-012 | Los textos propios del kit no se traducen al inglés | Kit | **Abierto** |
| H-013 | Modelo de agencias del negocio: `agencies`, `agency_tree` y relaciones por tipo | Arnés + kit | Construido; catálogos por completar |
| H-014 | Interacciones de la agencia (MN7) y menú del prototipo v2.6 | Arnés | Construido; Excepciones (MN10) pendiente |
| H-015 | Crear y editar agencias: contrato del producto | Arnés | Construido; quién puede, por validar |
| H-016 | Altas dentro de la agencia; interacciones en su propia pestaña | Arnés | Construido; bajas y edición en H-020 |
| H-017 | Dirección, equipo de trabajo, LOB, compañías y labels de la agencia | Arnés | Construido; catálogos por validar |
| H-018 | Datos base (baselines): carriers, estados, LOB, cargos y áreas se administran en la base, no en el kit | Kit + arnés | Construido; propuesta al kit |
| H-019 | «Eliminar usuario»: PB-002 no tiene baja; contrato del producto al lado | Arnés + kit | Construido; por validar |
| H-020 | Editar a los miembros de la agencia y quitarlos de ella | Arnés | Construido |
| H-021 | Calendario y Lead Management traídos del prototipo PB-002 v2.6 | Arnés + kit | Construido; hipótesis por validar |
| H-022 | Agencia: redes, tipo de comisión, a quién se paga, payment code por compañía y Legacy | Arnés + kit | Construido; catálogos por definir |
| H-023 | A quién se paga (agencia, subagencia, agente) y qué datos de pago exige | Arnés | Construido; por validar |
| H-024 | Agente independiente con payment code; documentos de pago aprobados para quien cobra | Arnés + Onboarding | Construido (solo lectura); se aprueban en Onboarding |
| H-025 | Importación masiva de leads desde las plantillas .xlsx del negocio | Arnés + kit | Construido; supuestos por validar |
| H-026 | Importación: vista previa, todo o nada, idiomas permitidos y eliminar si todo sigue en New | Kit (excepción FRM) | Construido |
| H-027 | Usuarios por área y campos propios de cada área | Producto (sin arnés) | Construido; quién llena los datos por validar |
| H-028 | Sin pantallas intermedias de confirmación en acciones comunes | Kit (excepción P) | Construido en Roles y Permisos |
| H-029 | El header del shell desborda a 390 px (acciones + avatar) | Kit / shell | Pendiente |
| H-030 | Editar el detalle de un usuario; clic en la persona abre su detalle | Producto (sin arnés) | Construido |
| H-031 | Crear usuario con sus roles y ver en vivo los permisos que encienden | Arnés (Miro «Rol interno») | Construido |
| H-032 | Permisos de Leads por persona (Importar, Ver, Editar, Convertir), atados a su función | Kit (catálogo de permisos) | Construido; proponer al kit |
| H-033 | `RastroDeEventos` del kit usa props viejas de antd `Timeline` (warning en consola) | Kit | Resuelto acá con un rastro propio; pendiente en el kit |
| H-034 | Detalle de usuario con un solo punto de edición y una sola lista de permisos | Producto | Construido |
| H-035 | Ningún permiso sale de un rol por ahora: todos se marcan por persona | Kit (ROLE_PERMISOS) | Construido; el negocio levanta los permisos por defecto |
| H-036 | El alcance lo da el rol; el área es la de la persona (8 estándar); la LOB solo en los datos del área | Kit (alcance, áreas) | Construido; puente al kit |
| H-037 | Territorios en Datos base: nombre, estado y ZIP codes | Producto | Construido; carga masiva en H-039 |
| H-038 | Áreas con sub-áreas; cargos con rol y área; varios cargos por persona deciden su área y sus roles | Kit (áreas) + negocio | Construido; mapa al kit por validar |
| H-039 | Carga masiva de territorios con plantilla y vista previa; subregión | Producto | Construido |
| H-040 | Campos por área condicionales («Solo para», «Solo si»); Doer de New Business / Growth: On field, Territorios y tipo de clientes | Negocio | Construido |
| H-041 | On field → Estados → Territorios: los estados filtran los territorios | Negocio | Construido |
| H-042 | Territorio de los leads por ZIP; Ask Claro propone el de los ZIP sin territorio; asignación de leads a Doer de New Business | Negocio | Construido; regla local sin IA externa |
| H-043 | Territorio y asignación se resuelven en cada importación; a Leads llegan asignados | Negocio | Construido |

---

### H-001 · `crear-usuario` sin correo

El contrato de Gestión de Roles y Permisos (PB-002, copiado verbatim) da de alta un Internal Actor
con `nombre`, `puesto` y `areaId`. Con login por Google Workspace, **un empleado sin correo no puede
entrar nunca**.

**Mitigación:** `features/roles-permisos/acciones.ts` exige el correo corporativo, verifica que no
exista y lo agrega a la entrada (así queda en el rastro). El contrato lo ignora y
`persistencia.ts` lo guarda. **Propuesta:** agregar `email` a la entrada de `crear-usuario` en el
arnés y en el contrato del kit, con su validación de dominio.

### H-002 · El chrome del kit no es SSR-safe

`AppShell` lee `document.documentElement` mientras renderiza, y `MenuLateral` lee `localStorage`.
En Next.js eso rompe el render del servidor.

**Mitigación:** `components/layout/ShellCliente.tsx` lo carga con `dynamic(..., { ssr: false })`.
**Propuesta al kit:** mover esas lecturas a `useEffect` o a un `useSyncExternalStore` con snapshot
de servidor. Aparte, los módulos del kit no declaran `'use client'`, así que una página de servidor
no puede renderizar ni un `PageContainer`. Agregar la directiva en el build del kit eliminaría el
envoltorio `components/Comunes.tsx`.

### H-003 · Warnings de antd en `RastroDeEventos`

Al abrir el perfil de un usuario con rastro, la consola muestra:

```
[antd: Timeline] `items.label` is deprecated. Please use `items.title` instead.
[antd: Timeline] `items.children` is deprecated. Please use `items.content` instead.
```

Vienen de `patrones.tsx` del kit (2.6.0), no del producto. Rompen la regla dura 7 («cero warnings»).
**Propuesta:** migrar a `title` / `content` en el kit (es un `### Fixed`, sube patch).

### H-004 · Sin variante móvil del shell

A 390px de ancho, el menú lateral fijo (240px) y la barra superior desbordaban la página 196px.

**Mitigación:** en pantalla angosta (`md` de antd) el menú arranca plegado al riel de iconos. El
desborde baja a 50px, y lo que queda es el grupo derecho de `BarraSuperior` (búsqueda,
notificaciones, ayuda, avatar), que tiene ancho fijo. **Propuesta al kit:** una variante móvil del
shell (menú en `Drawer`, barra compacta) o un modo `embebido` sin chrome, para cuando la app nativa
pone su propia navegación. Decidirlo antes de construir el contenedor mobile.

### H-005 · No se puede cerrar sesión desde la barra

El menú de la cuenta de `BarraSuperior` trae «Cerrar sesión» deshabilitado («fuera del alcance del
prototipo»). **Mitigación:** botón «Cerrar sesión» en `actions` del shell. **Propuesta:** prop
`onLogout` en `BarraSuperior`.

### H-006 · Google no deja iniciar sesión dentro de un WebView

Google rechaza OAuth desde WebViews embebidos (`disallowed_useragent`). Si el contenedor mobile es
un WebView plano, el login no va a funcionar ahí. **Opciones:** iniciar sesión en el navegador del
sistema (ASWebAuthenticationSession / Custom Tabs) y devolver la sesión a la app, o usar Google
Sign-In nativo e intercambiar el token con Better Auth. Hay que decidirlo cuando arranque mobile.

### H-007 · Quién ve el Directorio

PB-002 pone el Directorio en el grupo Transversal, visible para **todo** interno. Así se construyó.
Si el negocio lo acota (por ejemplo, solo Commercial y Contracting), la regla entra en
`components/layout/menu.ts` y en `app/(app)/directorio/page.tsx`. Hay que confirmarlo en el arnés.

### H-008 · «Configurador / Admin» se llama «Administrador»

**Decisión de producto (2026-10-13).** El rol `configurador-admin` se muestra como **Administrador**
en todas las pantallas: selector de rol, etiquetas de asignación, sello del actor en la
confirmación, Inicio y mensajes.

**Mitigación:** el renombre vive en `src/dominio/roles.ts` (`nombreRol`, `ROLES_PRODUCTO`,
`etiquetaRol`, `actorVisible`) y es **solo de presentación**. El catálogo del kit y el contrato
(copiado verbatim) siguen usando «Configurador / Admin»: el contrato concede sus acciones comparando
ese nombre, así que el actor que va al contrato no se renombra. Los eventos ya guardados conservan
el nombre con el que se registraron.

**Propuesta:** renombrar el rol en el catálogo del arnés y en `ROLES` del kit (y en el contrato de
Roles y Permisos). Cuando eso se publique, `NOMBRE_EN_PRODUCTO` se borra.

### H-009 · «Ver como» para soporte

**Pedido del producto (2026-10-13).** El Administrador puede navegar la plataforma como otro
empleado para ver lo mismo que esa persona (menú, alcance, vacíos, errores) y darle soporte. Está al
pie del menú lateral.

Se construyó con contrato propio (`features/soporte/contrato.ts`), porque ninguna acción tiene botón
sin contrato. Las reglas del producto son:

- **Solo lo usa quien INICIÓ SESIÓN como Administrador.** `sesionActual` lo revisa en cada petición
  contra la identidad real: una cookie puesta por otra persona no tiene efecto.
- **Es de solo lectura.** `exigirEmpleadoParaEscribir` rechaza toda escritura mientras dura, y toda
  escritura usa siempre la identidad real, nunca la que se está viendo.
- **Queda auditado.** `iniciar-ver-como` y `terminar-ver-como` dejan evento con el actor real y el
  objetivo. La cookie se pone solo después de guardar el evento. Una sesión de soporte se corta sola
  a las 8 horas.
- **Siempre se ve.** Mientras dura, una barra delgada arriba del contenido dice «Viendo como: …», con
  el botón «Salir». Entrar no pide confirmación (pedido del producto): es de solo lectura y se sale
  con un clic.

**Por validar con el negocio:** si soporte necesita además actuar en nombre de alguien (hoy no se
puede, a propósito), si se debe avisar a la persona que fue vista, y la política de retención de
estos eventos. Si se cierra sesión en medio de un «Ver como» no queda evento de fin: la sesión
vence por su cuenta.

### H-010 · El Directorio: personas, papeles y vínculos por contrato

**Definición del negocio (2026-10-13).** En el Directorio hay agencias y personas. Una persona
cumple uno o varios **papeles**:

| Papel | De agencia | Independiente | NPN |
| :-- | :-- | :-- | :-- |
| Agente | Sí, en una o más agencias | Sí | Siempre |
| Representante de agencia | Sí | No | Solo si además es agente |
| Staff de agencia | Sí | No | No |
| Vendedor de productos de descuento | Sí | Sí | No |
| Benefit Coordinator | — | Sí | No |

- **Una persona puede tener varios papeles a la vez** (por ejemplo, agente y representante de la
  misma agencia).
- **«Independiente» es una propiedad del vínculo, no de la persona**: un agente o un vendedor de
  descuentos puede ser independiente en un contrato y estar bajo una agencia en otro.

**Cómo se modeló** (`src/dominio/directorio.ts`, tablas `persona` y `vinculo`), siguiendo el arnés:
`persona` es **E-001 Party** delgada (identidad + NPN opcional) y `vinculo` es **E-004 Distribution
Relationship**: N a N, fechado, con tipo de papel, agencia o `null` (independiente) y un contrato
opcional (`carrier` + `lob`) mientras Contract (E-024) no exista en el producto. Las reglas del kit
(`agentesDeAgencia`, downline) siguen funcionando: `comoDirectorioDelKit` arma la forma que esperan.

**Lo que resuelve y lo que agrega al arnés:**
- Resuelve el **conflicto K-1** (`negocio/taller-2026-09-18-contraste.md`): la relación agente–agencia es
  **N a N**, y además **por contrato**.
- Agrega tres papeles que el arnés no tiene como entidad: representante de agencia (en el AS-IS solo
  existe como `Agency_Representative__c`), staff de agencia y vendedor de productos de descuento. El
  Benefit Coordinator hoy solo aparece como tipo de contacto del pipeline y como fuente de referidos.
- **Pendiente con el negocio:** el benefit coordinator, ¿se vincula a un centro médico como entidad?
  (hoy es un texto en la nota); ¿la jerarquía agencia–agencia también es por contrato?

**Propuesta al kit:** tipos `Persona` / `Vinculo` / `TipoPapel` en `/dominio`, y fixtures con estos
casos. Hoy viven en el producto.

**Migraciones:** `0001` borra `agente` y `agente_agencia` (solo tenían datos de demo) y `0002` crea
`persona` y `vinculo`. Se generaron en dos pasos porque `drizzle-kit` pide confirmar los renombres
en una terminal interactiva.

### H-011 · La jerarquía de agencias va en una Table con árbol, no en `Tree`

El Directorio se reestructuró con base en el Manual de uso y buenas prácticas del kit (fichas Table y
Tabs). Solo hay una desviación consciente: la tabla de 3.1 pide `Tree` para jerarquías de más de 2
niveles, y la de agencias tiene 3 (Master Agency → Agency → Sub Agency).

**Qué se hizo:** `Table` con datos en árbol (filas que se expanden y pliegan), la vía nativa de antd.
**Por qué:** la vista necesita comparar columnas por agencia (agentes, downline, equipo, vendedores) y
ordenarlas, y `Tree` no tiene columnas. PB-002 dejó la misma duda abierta.

**Propuesta para UX:** agregar al manual el caso «jerarquía con atributos comparables → Table en
árbol», o definir la alternativa (por ejemplo, `Tree` a la izquierda y el detalle a la derecha).

### H-012 · Los textos propios del kit no se traducen al inglés

Claro One ya cambia entre español e inglés (selector en el menú del avatar, como pide el kit, y en
el login). Todo el texto del producto vive en `src/i18n/mensajes.ts`, y el locale de antd sigue al
idioma. Pero varios componentes del kit traen texto fijo en español, que el producto no puede
cambiar:

| Componente | Texto fijo |
| :-- | :-- |
| `BarraSuperior` | El menú del avatar (Mi perfil, Idioma, Apariencia, Tema, Configuración, Ayuda y atajos, Cerrar sesión), la búsqueda, los atajos |
| `AccionConConsecuencia` | Cambia, No cambia, Alcance, Requiere, Queda registro, Ejecuta, Cancelar |
| `SelloActor` / `ACTORES` | Persona, Agente de IA, Automatización, Sistema externo |
| `CANALES` | Las descripciones de cada canal |

`MenuLateral` sí acepta `labels` y `FalloConUltimoDatoBueno` trae `FALLO_TEXTOS_EN`: ese es el
modelo. **Propuesta al kit:** una prop `textos` (o `idioma`) en cada componente con texto propio.

**Lo que no se traduce a propósito** (regla del kit: «traduce la pantalla, no los datos»): nombres
de Flujos, áreas, agencias y roles del catálogo, y los textos de los contratos de capability.

### H-013 · El modelo de agencias del negocio

**Definición del negocio (2026-10-13), con diagrama propio.** Reemplaza la parte de «Persona + Vínculo»
de H-010 por tablas por tipo, con los nombres en inglés del diagrama:

| Tabla | Qué guarda |
| :-- | :-- |
| `agencies` | La agencia: `parent_id` (única fuente de verdad de la jerarquía), `payee_agent_id` (quién cobra), `name`, `npn`, `tax_id` (EIN, 9 dígitos), `status`, `phone` (10 dígitos), `started_at`, `agents_use_portal`, `communications_scope`, `reports_scope` |
| `agency_tree` | Tabla de clausura (`ancestor_id`, `descendant_id`, `depth`). La mantiene un trigger de Postgres desde `parent_id`; otro trigger impide ciclos |
| `agents` + `agency_agents` | Agentes (NPN obligatorio) y sus agencias, N a N y fechado |
| `agency_representatives` + `agency_representative_agencies` | Representantes; `agent_id` opcional cuando además son agentes (de ahí su NPN) |
| `staff_members` + `agency_staff` | Staff: tabla análoga, pedida por el negocio |
| `discount_sellers` + `agency_discount_sellers` | Vendedores de productos de descuento: análoga; `agent_id` opcional |
| `benefit_coordinators` | Sin agencia por ahora; el centro médico es texto |

**Decisiones tomadas con el negocio:**
- Sin relación vigente con ninguna agencia, la persona es **independiente**. Si es independiente en
  un contrato puntual (y de agencia en otro) se resuelve en **Contracting**, no en `agency_agents`.
- Los catálogos de estado y alcances usan **solo los valores visibles** del diagrama, como CHECK en la
  base (migración 0005). **Pendiente:** la lista completa de `status` y de los dos alcances.

**Lo que el producto agregó al diagrama:** `internal_companies` (Claro / AtoZ, RUL-038) e `is_demo`.

**Migraciones:** `0003` borra el modelo anterior (`agencia`, `persona`, `vinculo`: solo datos de demo),
`0004` crea las 11 tablas, `0005` agrega los triggers de `agency_tree` y los CHECK de catálogos.

### H-014 · Interacciones de la agencia y menú del prototipo v2.6

**Interacciones (MN7, reunión de managers de Service 2026-10-07).** La ficha de la agencia tiene la
pestaña «Interacciones»: una línea de tiempo unificada, filtrable por tipo (con conteos) y con
«Incluir su red», que suma sub-agencias (`agency_tree`) y agentes del downline. Está portada de
`PB-002-v2.6/directorio-ficha.jsx` y `logica-directorio.js` (rama `feat/pb-002-v2.6-refinamiento`
del arnés).

- **Diferencia con el prototipo:** allí la línea de tiempo no guardaba nada propio, solo juntaba
  correos, llamadas, casos, avisos y sesiones que ya existían. Aquí esos módulos todavía no existen,
  así que se creó la tabla `interactions` (**E-062 Interaction**): un hecho con fecha, de un agente o
  de una agencia (CHECK: nunca los dos). Correo, llamadas (Five9), casos y avisos escribirán ahí.
- **Pendiente:** «Excepciones» (MN10, etiquetas fechadas que bajan por la red, `E-072 Restriction`,
  P-94). Lleva acciones de aplicar y levantar: necesita su contrato de capability antes de botones.
  Por eso la línea de tiempo todavía no muestra «ese día valía» por interacción.

**Menú lateral.** Sigue la distribución del prototipo v2.6 (NAV-R23): Inicio · Mi espacio
(Calendario, Mi performance, Mis reportes) · Transversal (Directorio, Analítica, Recursos) ·
Commercial (+ Metas) · Operations. Solo el primer nivel lleva ícono. **Diferencia pedida por el
negocio:** «Configuración» (Gestión de Roles y Permisos) se queda en el menú lateral para quien
administra; el prototipo la movió al menú de la cuenta (TOP-R14), y ahí también está. Los destinos
sin construir abren `/modulo/<clave>`, que dice por qué están vacíos.

### H-015 · Crear y editar agencias: contrato del producto

Pedido del negocio (2026-10-13): botón **Crear agencia** y **Editar información** en cada agencia.
Ni el arnés ni el kit traen un contrato para esto, y ninguna acción tiene botón sin contrato (regla
dura 5), así que se creó `features/directorio/contrato.ts`: capability **Gestión de agencias**,
acciones `crear-agencia` y `editar-agencia`. Corre en el servidor (`acciones.ts`), persiste en
`agencies` y deja evento en el rastro con el antes y el después de cada campo; también los rechazos.

**Decisiones por defecto, por validar con el negocio:**
- **Quién:** solo el Administrador (`Configurador / Admin`). ¿También New Business o Contracting?
- **La agencia madre se elige al crear y no se edita.** Cambiar la jerarquía es su propio flujo
  (MN11: formatos, firma, envío al carrier), y `parent_id` no guarda historia.
- Una agencia nueva arranca en **Contratación pendiente**.
- El nombre no se repite bajo la misma agencia madre, ni el NPN entre agencias.

**Formulario:** según la ficha Form del Manual de uso (6.1 a 6.7). Drawer (12 campos, FRM-R30),
`layout="vertical"`, asterisco + leyenda, validación al salir del campo y revalidación al escribir
tras el primer error, dos secciones con título, sin Tabs, Radio/Checkbox/Select según 6.5, errores
del contrato en un Alert arriba, primario nunca deshabilitado, cancelar con cambios pide confirmar.
Los mensajes de error del contrato están en español (son texto del contrato, como los del kit).

### H-016 · Altas dentro de la agencia y separación de las interacciones

Pedido del negocio (2026-10-13): crear desde la agencia a su gente y sus sub-agencias, y no mezclar
las interacciones con las personas de la agencia.

**Ficha de la agencia:** la ficha (Identificación y Operación) arriba, común a todo (TAB-R12), y un
solo nivel de pestañas (TAB-R15): **Organización** (Equipo, Agentes, Vendedores, Sub-agencias, cada
sección con su tabla y su botón de alta) e **Interacciones**, aparte.

**Acciones nuevas del contrato `gestion-de-agencias`** (mismas reglas: solo Administrador, por validar):
- `agregar-agente`: crea un agente nuevo (NPN obligatorio y único) **o vincula uno que ya existe**,
  porque un agente puede estar en varias agencias. Rechaza vincularlo dos veces a la misma agencia.
- `agregar-equipo`: representante (opcionalmente enlazado a un agente: de ahí su NPN) o staff.
- `agregar-vendedor`: vendedor de productos de descuento, opcionalmente enlazado a un agente.
- «Crear sub-agencia» reusa `crear-agencia` con la agencia madre ya puesta, y hereda sus compañías.

Todas crean la relación fechada con la agencia desde hoy (`valid_from`) y dejan su evento en el
rastro. **Pendiente:** dar de baja a alguien de una agencia (cerrar `valid_to`) y editar personas.

### H-017 · Dirección, equipo de trabajo, líneas de negocio, compañías y labels de la agencia

Pedido del negocio (2026-10-13), con capturas del Salesforce actual (Work Team, Legal Entities, Line
of Business).

| Qué | Dónde se guarda | Cómo se usa en la ficha |
| :-- | :-- | :-- |
| Dirección | `agencies.address_street/city/state/zip` (estado 2 letras, ZIP 5 dígitos, con CHECK) | En Identificación; se edita con «Editar información» |
| Equipo de trabajo (Work Team) | `agency_work_team` (empleado + rol, fechado) | Pestaña propia: «Asignar miembro» (Modal) y «Quitar» (Popconfirm) |
| Líneas de negocio | `agency_lobs` (fechado) | Tags en Operación: «Relacionar LOB» y quitar |
| Compañías (Legal Entities) | `agencies.internal_companies` | Tags en Identificación: relacionar y quitar; siempre queda una. Ya no se editan en el formulario |
| Labels | `agency_labels` (texto libre, fechado) | Arriba de la ficha: «+ Label» y quitar. Avisan, no bloquean |

Ocho acciones nuevas del contrato `gestion-de-agencias` (asignar/quitar equipo, relacionar/quitar
LOB, compañía y label). Quitar cierra el intervalo (`valid_to`); nada se borra.

**Por validar con el negocio:**
- **Roles del equipo de trabajo:** ~~COS, Growth Specialist, Account Executive, Remote BDR, Customer
  Service~~ → **resuelto (2026-10-13): COS, GS y LOB specialist** (migración 0010). Las asignaciones
  vigentes con los roles que salieron se cerraron ese día; su historia queda. Sumar un rol es una migración.
- **Catálogo de LOB:** el del kit más Discount Medical Plans. ¿Faltan (Dental, Ancillary…)?
- **Labels:** texto libre de hasta 40 caracteres. ¿Debería ser un catálogo cerrado?
- ¿Las compañías necesitan historia fechada (desde cuándo está afiliada a AtoZ)? Hoy es una lista.

### H-018 · Datos base (baselines): la información base se administra desde Configuración

Pedido del negocio (2026-10-13): un submódulo **Configuración › Datos base** donde el Administrador
agrega la información base (carriers, estados, líneas de negocio) y el resto de la app la toma de ahí.

**Contradice la regla dura 4** («los catálogos no van a la base»). Se resolvió así:
- **Van a la base** (tabla `baselines`): carriers, estados y LOB. Son datos del negocio que cambian
  sin que cambie el código. Las otras tablas guardan su `code`, que no cambia; el nombre sí se edita.
- **Siguen en el kit**: roles, áreas, Flujos, compañías internas y permisos.
- Los valores iniciales vienen de `CATALOGOS_INFO_NEGOCIO` del kit (6 LOB + Discount Medical Plans,
  18 carriers con sus LOB) y de los 50 estados + DC y PR. Están en la migración `0009`, no en el
  seed: también hacen falta en producción.
- Contrato del producto `baselines` (agregar, editar, desactivar, reactivar). Desactivar cierra
  `valid_to`: el valor deja de ofrecerse, pero lo que ya lo usa lo conserva. Reactivar abre una fila nueva.

**Quién la usa hoy:** «Relacionar LOB» de la agencia, las LOB de un agente nuevo y el estado de la
dirección de la agencia (ahora un `Select` con búsqueda). Los carriers todavía no tienen quién los use:
llegan con Contracting.

**Propuesta al kit:** que `CATALOGOS_INFO_NEGOCIO` sea solo la semilla y el kit exponga el tipo
`ValorBaseline`; hoy vive en `src/dominio/baselines.ts`.

**Cargos (2026-10-13):** cuarto tipo de Datos base. Cada cargo dice a qué roles del kit aplica
(`roles`). Cargados en las migraciones 0011 (21 de Doer, 2 de ellos Doer / Manager) y 0012 (7 de Manager,
6 de nivel ejecutivo). El kit tiene un solo rol ejecutivo (`ceo-level`): los cargos «CLevel» y «CEO» del
negocio van ahí; si deben ser roles distintos, es un cambio al kit. Se corrigió la ortografía al
cargarlos (Campaign, Professional, Advance, Contracting). La tabla de usuarios muestra el cargo junto al
área, y el alta de un usuario lo elige del catálogo. El contrato `crear-usuario` (verbatim PB-002) sigue
recibiendo `puesto` como texto: no valida contra el catálogo. Los empleados demo se mapearon a un
cargo del catálogo, salvo Coordinator y Administrador, que no tienen cargo en la lista.

**Cargos de Administrador (0013):** Administrador IT y Administrador Proyectos, con el rol `configurador-admin`.

**Áreas (0014, 2026-10-13):** las del kit (25, en árbol) no son las de la organización. El negocio pasó 8:
BOB & Commissions, Service, Contracting, Quality, Finance, Strategy, Legal y Commercial. Son un quinto tipo
de Datos base y son **el área de cada persona** (`empleado.area_id` guarda su código). Decisión de la
usuaria: **los permisos y el menú siguen con las áreas del kit**, porque salen de las asignaciones
(`alcance_valor`) y del área dueña de cada Flujo, no del área de la persona. La migración pasó a cada
persona de su área del kit a la nueva (regla en 0014 y en el seed); Plataforma (Administrador) no tiene
equivalente y se quedó como está. **Pendiente:** que el negocio diga de qué área nueva es cada Flujo y el
kit reemplace su árbol de áreas; hasta entonces conviven dos listas (la de la persona y la del alcance).

**Por validar con el negocio:** ¿qué otros baselines hacen falta (uplines, tipos de licencia, productos
de descuento)? ¿Un carrier necesita más datos (NAIC, estados donde opera)?

### H-019 · Eliminar usuarios

Pedido del negocio (2026-10-13): poder eliminar usuarios desde Gestión de Roles y Permisos. PB-002 no
trae una acción de baja y su contrato se copia verbatim, así que la baja es un contrato del producto al
lado: `roles-permisos/contrato-baja.ts` (`baja-de-usuarios` · `eliminar-usuario`).

**Eliminar es dar de baja, no borrar** (regla dura 3): `empleado.valid_to` = hoy, y se cierran sus
asignaciones vigentes y su lugar en equipos de trabajo de agencias. Desde ese día no inicia sesión (va a
«Sin acceso»), sale de la lista, de «Ver como» y de la lista para asignar equipo. Su historia y el rastro
quedan con su nombre. Su correo sigue ocupado: no se puede crear otro usuario con el mismo.

Reglas: solo Administrador; nadie se elimina a sí mismo (el botón ni aparece en tu fila); siempre queda
al menos un Administrador activo.

**Por validar:** ¿hace falta reactivar a alguien dado de baja, o ver la lista de bajas? Hoy solo se
puede desde la base.

### H-020 · Editar y quitar miembros de la agencia

Pedido del negocio (2026-10-13). Dos acciones nuevas en `gestion-de-agencias`, solo para Administrador:

- **`editar-persona`**: los datos de un agente (nombre, NPN que no se repite, contacto, LOB de Datos base,
  FFM, compañías), representante (nombre, si también es agente, contacto), staff (nombre, puesto,
  contacto) o vendedor (nombre, agente, contacto, compañías). Cambia la persona en todas sus agencias.
  El papel no se cambia: representante y staff son registros distintos. El rastro guarda cada campo.
- **`quitar-de-agencia`**: cierra hoy la relación con esa agencia (`valid_to`); la persona sigue en el
  Directorio y en sus otras agencias. No se puede quitar al agente que cobra por la agencia.

En la pestaña Organización de la agencia, cada fila de Equipo, Agentes y Vendedores tiene «Editar» (el
mismo formulario del alta, con sus datos) y «Quitar» (Popconfirm, GLB-R10).

**Por validar:** editar desde la ficha de la persona (pestañas Agentes y Vendedores del Directorio), y
si quitar al último representante de una agencia debería avisar.

### H-021 · Calendario y Lead Management, del prototipo PB-002 v2.6

Pedido del negocio (2026-10-13): «traer del último prototipo lo que hay de Calendario y Lead
Management». Fuente: `prototipos/PB-002-v2.1-shell-de-claro-one` del arnés (contenido v2.6, commit
55554ed): `actividades.jsx/.js`, `capacidad-actividades.js`, `datos-actividades.mock.js`,
`pipeline.jsx` y la capacidad `comercial` de `capacidades.js`.

**Calendario** (Mi espacio › Calendario, `/calendario`). Contrato `actividades` con sus 7 acciones.
Vistas Mes, Semana y Día (Semana compuesta con `Card`: el kit no tiene vista semanal) y Tareas, con las
pestañas Mías, Bandeja, Pedidas y Mi equipo. Incluye cronómetro y exportación a CSV. Tablas `tasks`,
`task_status_history` (append-only), `task_time_entries` y `task_timers`. Ajustes del producto:
- El equipo es el **área de Datos base** (H-018), no un área del kit. Quien gestiona (Manager,
  Coordinator, CEO Level) ve a las personas de su área; con alcance global, a todas.
- La hora del cronómetro la pone el servidor.
- Exportar solo valida el alcance: el CSV se arma en el navegador para no guardar el archivo en el rastro.
- El cronómetro corriendo se borra al detenerlo; lo que queda es su registro de tiempo.

**Lead Management** (Commercial, `/lead-management`; es el Flujo `lead-conversion` del kit y lo ve quien
puede ver ese Flujo). Pestañas Leads, Plan semanal y Ruta diaria; el detalle tiene Resumen, Negocio e
Interacciones. Contrato `comercial`:
- `asignar-lead` y `registrar-resultado-interaccion`, cada una con su sugerencia de IA (IA-2, IA-3)
  que solo **propone**; una persona la revisa con su consecuencia antes de aplicarla.
- Acción nueva `crear-interaccion`: el prototipo la creaba sin contrato.

Tablas `leads` (contacto, fuentes, dirección y Business Information en jsonb mientras el modelo no se
cierre) y `lead_interactions`. Una interacción es la misma fila en el lead, el Plan, la Ruta y el
Calendario de quien la tiene.

**Hipótesis por validar:**
- Roles: los del prototipo («Manager de New Business», «Especialista comercial») se mapearon a los del
  kit. Asignar lo hace un Manager; trabajar lo hacen Doer, Manager o Coordinator; el Administrador
  puede las dos cosas, para operar y probar.
- Qué pasa con el lead al registrar un resultado: hoy no cambia su etapa. Tampoco hay todavía «crear
  lead», «cerrar lead», Onboarding, All Clients ni el Portal del Lead.
- La demo corre las fechas del prototipo (hoy = 2026-09-21) al día en que se carga.

### H-022 · Redes, comisiones y pagos, payment code y Legacy en la agencia

Pedido del negocio (2026-10-15). Campos nuevos en `agencies` (migración 0017), en el formulario de la
agencia (secciones «En línea» y «Comisiones y pagos») y en su ficha:

- **En línea:** página web, LinkedIn y varias redes sociales (enlaces http/https).
- **Tipo de comisión:** el arnés no trae su catálogo (ni en `modelo/` ni en el prototipo). Es un sexto tipo de
  Datos base, `tipo-comision`, **vacío**: el negocio carga sus valores en Configuración › Datos base.
- **Comisión pagada a / Bono pagado a:** la agencia o cada agente.
- **Payment code** (Payment Account · E-051 del arnés): uno por compañía, y **solo de las compañías a las que
  pertenece** la agencia (contrato + CHECK en la base). Al quitarle una compañía, su payment code se va con ella.
  Hipótesis: el arnés modela la cuenta de pago como entidad N..N fechada; aquí es un atributo de la agencia
  hasta que se construya Payments.
- **Legacy sí/no.** Si es legacy, la ficha muestra **Negociaciones especiales Legacy**: agregar (compañía si
  pertenece a las dos, LOB vigente, tasa del agente 0–100 %, cargo administrativo, detalle) y quitar (cierra
  `valid_to`). Tabla `agency_legacy_negotiations`. «Legacy» no es un tipo de `TIPOS_NEGOCIACION` del prototipo
  (Redistribución, Reasignación, Tier, Fee, Bono): se tomaron sus campos. No pasa por la cadena de aprobación
  (Comercial → Finanzas → Gerencia) porque registra un acuerdo que ya existe: **por validar**. No se puede marcar
  como no legacy, ni quitarle una compañía, mientras tenga negociaciones vigentes de ella.

### H-023 · A quién se paga y qué datos de pago exige

Regla del negocio (2026-10-15), en `src/dominio/pagos.ts` y aplicada por el contrato `gestion-de-agencias`:

- «Commission paid» y «Bonus paid» se pagan a **Agencia, Subagencia o Agente**. Se definen **solo en la Master
  Agency**; su jerarquía lo hereda y lo muestra como «Lo define la agencia principal».
- **Agencia:** solo la Master lleva contact payee y payment code (obligatorios). Las subagencias no los tienen ni se ven.
- **Subagencia:** la Master y cada subagencia, contact payee y payment code obligatorios.
- **Agente:** la Master conserva contact payee y payment code obligatorios; las subagencias no los tienen. Cada agente
  necesita payment code por **cada compañía en que produce** (sus compañías, no las de la agencia), y también el
  vendedor sin licencia. El representante que no es agente y el staff no llevan código; el que es agente usa el suyo.
- Si comisión y bono van a niveles distintos, se suman los requisitos.
- **Datos que ya existían:** se marcan «Falta el contact payee / payment code de …» en la ficha y en Organización, y se
  exigen al guardar esa agencia o persona (decisión de la usuaria: avisar y exigir al editar, no bloquear).
- Migración 0018: `subagencia` como valor y payment codes en `agents` y `discount_sellers` (CHECK: solo de sus
  compañías; el vendedor que es agente no lleva código propio).

**Resuelto en H-024:** el agente independiente sí tiene código obligatorio.

### H-024 · Agente independiente y documentos de pago

Decisión del negocio (2026-10-15):
- El **agente independiente** (sin agencia vigente) cobra él mismo: su payment code es obligatorio por cada compañía en
  que produce (`exigeCodigoPersona(..., { esAgente: true })`).
- **Todo el que tiene payment code exigido debe tener sus documentos de pago revisados y aprobados**: W9, Direct
  Deposit y Voided Check. Es la condición dura de Payment Account · E-051 del arnés
  (`PaymentDocumentsVerified__c`). La revisión y la aprobación son del **Onboarding**; el Directorio es posterior y
  **solo muestra** su estado (Pendiente, En revisión, Aprobado, Rechazado) y avisa «Documentos de pago sin aprobar».
- Tabla `payment_documents` (migración 0019): una fila por titular (agente, vendedor sin licencia, agencia) y documento,
  con su estado actual. No tiene acción de escritura en el Directorio: la escribirá el contrato del Onboarding. La demo
  siembra algunos estados para verlos.

**Pendiente:** construir la revisión en el Onboarding (contrato, historial fechado de cada revisión). ¿El vendedor sin
licencia que no tiene agencia (independiente) también cobra él mismo? Hoy su código no es obligatorio.

### H-025 · Importación de leads (Lead Management › Importaciones)

Pedido del negocio (2026-10-15). Carga masiva desde las plantillas del negocio en `public/` (Agency, Agent, Vendor y
Benefit coordinator). **La plantilla es solo la primera fila**; las demás son ejemplos. Por eso «Descargar plantilla»
(`/api/plantillas/[tipo]`) genera un .xlsx con solo los encabezados de cada archivo.

Flujo: elegir tipo → subir el .xlsx → vista previa (`previsualizarImportacion`, solo lectura) con las filas con error
(fila, campo, motivo) y las listas → «Importar N leads» con su consecuencia → contrato `importar-leads` (vuelve a
validar, crea los leads sin responsable y guarda el archivo en `lead_imports` con sus filas rechazadas).

Reglas (`src/dominio/importacion.ts`): lo marcado con * es obligatorio; Line of Business solo de Datos base; Source
On field, Marketing, Google Search, Event o Benefit coordinator (no para un benefit coordinator); State, las iniciales
de un estado de Datos base; Priority High, Medium o Low; teléfonos de 10 dígitos; correos y enlaces válidos; no se
repite un lead con el mismo nombre y teléfono (ni en el archivo ni con los que ya existen). Hasta 2.000 filas y 5 MB.

Técnico: el .xlsx se lee y se escribe con un lector propio sobre `zlib` (`src/server/xlsx.ts`) porque instalar una
dependencia hoy obliga a resolver el kit contra GitHub Packages, que pide el token. Cuando haya token, se puede
cambiar por una librería. `serverActions.bodySizeLimit` subió a 8 MB.

**Supuestos por validar:**
- El nombre es obligatorio en las cuatro; la plantilla de Benefit coordinator no marca nada con *.
- El tipo de lead lo da la plantilla elegida, no la columna «Lead Type» (la de Vendor dice «Agent» en su ejemplo).
- «Status» (por ejemplo «New») se guarda como la disposición del lead.
- «LOB Outside Claro» se guarda tal cual, sin exigir que sea de Datos base.
- ~~Las filas con error no entran y las válidas sí~~ → resuelto en H-026: el archivo entra completo o no entra.

### H-026 · Vista previa, todo o nada, idiomas y eliminar una importación

Reglas del negocio (2026-10-15):
- **Vista previa** al subir un archivo (Modal «Vista previa de la importación»): todas las filas con todas las columnas
  de la plantilla, cada fila «Lista» o «Errores» con el tipo de error, y la celda con error marcada. Total, válidos y
  errores arriba, y «Ver solo errores».
- **Todo o nada:** se importa solo si el 100 % de las filas es válido; el contrato `importar-leads` también lo exige.
  **Excepción a la regla del kit** «el primario nunca va deshabilitado»: el negocio pide que «Importar» no se habilite
  hasta que todo esté bien. Va deshabilitado con un Tooltip y un aviso que dicen por qué. Proponer al kit el patrón.
- **Languages:** solo English, Spanish, Creole, Vietnamese, Korean, Chinese, Arabic, French, Portuguese, Croatian,
  Haitian, Hindi y Hebrew.
- **Status** vacío entra como «New».
- **Eliminar una importación** (acción `eliminar-importacion`): solo si todos sus leads siguen en «New» (y, además,
  sin interacciones). Sus leads se borran porque nunca se trabajaron; la importación queda en el historial como
  «Eliminada», con quién y cuándo (`lead_imports.deleted_at/deleted_by`, migración 0021), y el rastro guarda los
  leads que salieron.

### H-027 · Usuarios por área y campos propios de cada área

Pedido del negocio (2026-10-15): los usuarios de la plataforma se ven en subgrupos por área, y cada área puede pedir
campos propios a sus usuarios para sus procesos.

- **Subgrupos:** en Gestión de Roles y Permisos, una pestaña por área de Datos base (más «Todas» y, si alguien la
  tiene, «Plataforma»), con su número de usuarios. La pestaña activa vive en la URL (`?area=`). Dentro de un área,
  «Crear usuario» ya trae el área elegida.
- **Campos del área:** botón «Campos del área (n)» → Drawer con los campos; agregar o editar en un Modal. Tipos:
  texto, número, fecha, sí/no, lista (una opción) y lista (varias opciones). Las listas toman sus opciones de las
  escritas en el campo o de un catálogo de Datos base (líneas de negocio, carriers, estados), sin copiarlo: lo que se
  agrega en Configuración aparece solo (migración 0023, `area_fields.source`). Cada campo puede ser obligatorio. El
  tipo y la fuente no cambian después de creados.
- **Commercial** pide «Línea de negocio»: lista de varias opciones desde las LOB de Datos base (pedido 2026-10-15).
  Desactivar cierra `valid_to`; no borra.
- **Datos del usuario:** sección «Datos de <Área>» en el perfil, con la fecha desde la que vale cada dato. Los campos
  del área salen como columnas de su pestaña, y la columna «Datos del área» dice «Completo» o «Faltan n» con el motivo.
- Contrato propio `campos-por-area` (`features/roles-permisos/contrato-campos.ts`): agregar, editar, desactivar campo
  y guardar datos. Tablas `area_fields` y `employee_area_values` (migración 0022); cambiar un valor cierra el
  anterior, así la historia de cada dato queda.

**Por validar:**
- Hoy solo el Administrador define campos y llena los datos. ¿El Manager del área o la propia persona deberían llenar
  los suyos?
- Al cambiar a alguien de área, sus datos del área anterior se conservan pero dejan de mostrarse.

### H-028 · Sin pantallas intermedias de confirmación

Decisión de la usuaria (2026-10-15): «no crees este tipo de pantallas intermedias». Crear usuario, asignar y revocar
rol se ejecutan al pulsar, sin el Modal `AccionConConsecuencia` («Cambia / No cambia / Alcance…»). El contrato sigue
validando en el servidor, y el evento y el aviso de resultado siguen igual. Igual que la importación (H-026).
**Excepción al patrón del kit:** el Modal de consecuencia queda solo para bajas que no se deshacen (eliminar usuario,
eliminar importación). Proponer al kit que la confirmación sea opcional por acción.

### H-029 · El header del shell desborda a 390 px

A 390 px el documento mide 440 px en todas las páginas con acciones en el header (Directorio, Datos base, Roles y
Permisos): los botones del header y el avatar quedan fuera. No viene de los cambios de H-027; viene del header del
Shell. Pendiente de corregir acá o en el kit.

### H-030 · Editar el detalle de un usuario

Pedido del negocio (2026-10-15): no había forma de editar a un usuario, y «Ver perfil» sobraba.
- Clic en la persona (su nombre o la fila) abre su detalle. Ya no existe el botón «Ver perfil».
- En el detalle, «Editar» abre un Modal con nombre, correo corporativo, cargo y área (de Datos base). Contrato
  propio `edicion-de-usuarios` (`contrato-edicion.ts`), al lado de PB-002 como la baja. El correo se valida igual
  que al crear (corporativo y único). Solo Administrador, nunca en «Ver como».
- Cargo y área son columnas simples de `empleado`: el cambio se sobrescribe y el valor de antes queda en el rastro
  (evento con de → a). Si el negocio necesita consultar «en qué área estaba el 1 de marzo», hay que fecharlos.

### H-031 · Crear usuario con sus roles y el catálogo de permisos en vivo

Pedido del negocio (2026-10-15): al crear un usuario se ve el catálogo de permisos para activar los que tendrá.
- Los permisos **no se encienden uno por uno**: salen de los roles (unión de todas las asignaciones,
  roles-permisos-spec.md §2). En «Crear usuario» se agregan los roles (rol, alcance, área, LOB) y el catálogo muestra en
  vivo cuáles se encienden.
- Al pulsar «Crear usuario» corren, en orden, `crear-usuario` y un `asignar-rol` por rol: cada uno con su contrato y su
  evento (Miro «Rol interno», pasos 1 y 2). No es atómico: si una asignación se rechaza, la persona queda creada y el
  aviso dice por qué; se le asigna desde su detalle.
- Si el negocio quiere encender o apagar permisos sueltos como excepción a un rol, es un cambio de modelo: va primero al
  kit (y al arnés).

### H-032 · Permisos de Leads por persona, atados a su función

Decisión del negocio (2026-10-15): el catálogo de permisos tiene que ir siendo real y atado a lo que cada permiso
deja hacer.
- **Salen** «Capturar lead», «Calificar lead» y «Convertir lead → account/contact» (catálogo del kit).
- **Entran** «Leads: importar», «Leads: ver», «Leads: editar» y «Leads: convertir». **Se encienden por persona**, no
  por rol, porque cualquier combinación vale (ver sin editar, importar sin ver ni editar, editar sin convertir…).
  En el perfil y en «Crear usuario», casillas que se ejecutan al marcar (sin pantalla intermedia, H-028).
- Contrato `permisos-por-persona` (`definir-permisos`), tabla `employee_permissions` fechada (migración 0024):
  apagar cierra `valid_to`. La migración les dio los cuatro a quienes ya trabajaban leads (rol vigente Doer, Manager,
  Coordinator o Admin), para que nadie perdiera acceso con el cambio.
- **Qué guarda cada uno:**
  - *Ver*: las pestañas Leads, Plan semanal y Ruta diaria, y los datos de los leads.
  - *Importar*: la pestaña Importaciones, la vista previa del archivo, importar y eliminar una importación.
  - *Editar*: asignar/reasignar, registrar resultado, crear interacción y las sugerencias de la IA.
  - *Convertir*: **todavía no hay acción de convertir** en la app; el permiso queda listo para cuando exista.
  - Sin *ver* ni *importar*, Lead Management sale del menú y la página dice que no está en su alcance.
- Se exige en tres lados: el menú, la pantalla (pestañas y botones) y el contrato `comercial`, que rechaza (con evento)
  si quien ejecuta no tiene el permiso. Los roles del contrato siguen pidiéndose también (asignar = Manager o Admin).
- **Puente al kit:** el catálogo vive en el kit; `src/dominio/permisos.ts` lo ajusta mientras tanto. Proponer allá los
  permisos por persona y este catálogo, y borrar el puente cuando llegue.
- Sin *ver* pero con *importar*, el detalle de una importación sí muestra los registros que se subieron.

### H-033 · `RastroDeEventos` del kit avisa en consola

El rastro del kit usa `items.label` / `items.children` de `Timeline`, que antd 6 marca obsoletos (`title` /
`content`). Sale el warning cada vez que un perfil tiene eventos. Corregirlo en el kit.

### H-034 · Un solo punto de edición en el detalle del usuario

Decisión de la usuaria (2026-10-15): había varios puntos de edición sueltos («Editar», «Editar datos», tags cerrables,
«Agregar asignación», casillas de permisos) y dos listas de permisos redundantes.
- **Mirando**, el detalle es de solo lectura: datos, datos del área, roles, **una lista con solo los permisos que tiene**
  («Permisos (n)») y el rastro. El único botón es «Editar».
- **Editando**, el mismo Drawer pasa a formulario: nombre, correo, cargo, área, datos del área (los del área elegida),
  roles (quitar, agregar, Ask Claro) y **todos los permisos con casilla**; los de Leads se marcan, los que salen de un
  rol van deshabilitados y siguen al borrador de roles. Un solo «Guardar».
- «Guardar» corre en orden cada acción con su contrato y su evento: `editar-usuario` → `revocar-asignacion` →
  `asignar-rol` → `guardar-datos-area` → `definir-permisos`. Solo las que cambiaron. Si una se rechaza, se detiene,
  queda en edición y dice por qué; lo anterior ya quedó guardado (no es atómico entre contratos).
- «Crear usuario» usa la misma lista de permisos.
- Componente: `features/roles-permisos/components/DetalleUsuario.tsx`.

### H-035 · Por ahora ningún permiso sale de un rol

Decisión de la usuaria (2026-10-15): los permisos por rol del kit (`ROLE_PERMISOS`) son de prueba, no reales. Hasta que
el negocio levante los permisos por defecto de cada rol y cargo (p. ej. «Doer de X cargo → permisos X»):
- **Todos los permisos del catálogo se marcan por persona**, en «Editar» del detalle y en «Crear usuario». Ningún rol
  suma permisos (`src/dominio/permisos.ts` ya no usa `ROLE_PERMISOS`).
- Los roles siguen existiendo para lo demás: el alcance (qué áreas y Flujos ve), quién ejecuta cada contrato y el menú.
- Las personas conservan solo los permisos que se les marcaron (hoy, los de Leads de H-032). Los que antes «salían» de
  su rol ya no cuentan: eran de prueba y ninguno protegía una función real.
- **Pendiente:** cuando el negocio defina los permisos por defecto por rol y cargo, entran como punto de partida al
  asignar el rol (y se proponen al kit).

**Ajuste (2026-10-15) · «Agregar asignación»:** cada control lleva su etiqueta (Rol, Alcance, Área del alcance, Línea de
negocio). El área del alcance arranca en la de sus asignaciones; si no tiene, se elige (antes arrancaba en «CEO», la
primera del catálogo, porque el área de la persona viene de Datos base y no coincide con las del kit). La línea de
negocio se ofrece siempre, opcional («Todas»), con las LOB vigentes de Datos base (antes: solo en Comercial y con
tres valores escritos en el código). **Por resolver:** el área del alcance usa las áreas del kit (`AREAS`) y el área de
la persona usa las de Datos base (H-018); conviene unificarlas.

### H-036 · El alcance lo da el rol, en el área de la persona

Decisiones de la usuaria (2026-10-15):
- **La LOB vive solo en los datos del área** (Commercial › «Línea de negocio», H-027). «Agregar asignación» ya no la pide
  y los roles no la muestran. Las asignaciones viejas guardan la suya, pero ya no se usa.
- **El alcance no se elige: lo da el rol.** CEO Level y Administrador → toda la empresa; Manager → su área;
  Coordinator → su sub-área; Doer → lo suyo. «Agregar asignación» queda solo con el **Rol** y explica qué alcance da.
- **El área es la de la persona**, una de las 8 estándar de Datos base. Las etiquetas dicen «Manager · Commercial» o
  «Administrador · Toda la empresa».

Puente al kit (`src/dominio/areas.ts`): el kit decide qué Flujos ve cada persona con su árbol de 25 áreas. Cada área
estándar se guarda como la rama del kit que la cubre: BOB & Commissions → `bob-commissions`, Service →
`broker-support`, Contracting → `contracting-telco`, Quality → `quality`, Finance → `vpf`, Strategy → `vp-strategy`,
Commercial → `ceo-commercial`. **Legal no tiene rama en el kit** (ningún Flujo es de Legal). Validar el mapa y proponer
al kit las 8 áreas.

**Pendientes:**
- Coordinator: no hay sub-áreas en Datos base; por ahora cubre el área entera.
- Si una persona cambia de área, sus roles siguen en el área de antes. Hay que decidir si se mueven solos.
- Un área nueva en Datos base no tiene rama en el kit hasta que se agregue al puente.

### H-037 · Territorios en Datos base

Pedido del negocio (2026-10-15): Configuración › Datos base tiene una pestaña **Territorios**, cada uno con su estado y
sus ZIP codes.
- Columnas: nombre, estado (EE. UU.), ZIP codes (cuántos y la lista, completa en el tooltip), vigencia y acciones.
  La búsqueda encuentra por nombre, por ZIP (o el comienzo de uno) y por código de estado.
- Agregar / editar en Modal: nombre, estado (de los vigentes en Datos base) y los ZIP, pegados o escritos, separados por
  coma, espacio, punto y coma o renglón. Muestra en vivo cuántos ZIP válidos lleva y cuáles no tienen 5 dígitos.
- Reglas del contrato `baselines`: estado vigente, al menos un ZIP, todos de 5 dígitos (sin repetir, ordenados).
  **Supuesto:** un ZIP no puede estar en dos territorios vigentes a la vez. Desactivar no borra; reactivar vuelve a
  revisar que sus ZIP no estén ya en otro.
- Columnas `baselines.state` y `baselines.zips` (migración 0025). Editar los ZIP deja en el rastro cuáles entraron y
  cuáles salieron.
- **Por definir:** la carga masiva de territorios desde una plantilla (como «Territory Template» / «Upload
  Territories» de la referencia) y dónde se usan los territorios (asignar agentes o leads por ZIP).

### H-038 · Los cargos deciden el área y los roles

Lista del negocio (2026-10-15). Migración 0026.
- **Áreas con sub-áreas** (`baselines.parent`, dos niveles): Operations (Service, BOB & Commissions, Contracting,
  Telecomunicaciones, Quality), Commercial (Growth, New Business), Strategy (Marketing, Technology, Product), Finance y
  Management CEO. **Legal deja de ser área** (se cerró) y pasa a ser un cargo de CEO Level en Management CEO.
- **Cada cargo dice su rol y su área o sub-áreas** (`baselines.areas`), tal cual la lista. Salieron «Agente AtoZ» y
  «Operational Contracting Specialist (Torre de control)». Entraron «Operational Contracting Coordinator» y «Legal».
  «Quality Coordinator» pasó a Coordinator; «Administrative & Accounting Professional» y «Financial Professional
  (Commission Advance)» quedaron solo como Manager.
- **Una persona tiene uno o varios cargos** (`empleado.cargos`; `puesto` = el primero, por el kit). De ellos salen,
  sin elegirlos a mano: su área y sub-área (la principal se guarda en `area_id`) y **sus roles**, cada uno con el
  alcance que da (H-036) en el área de su cargo. «Agregar asignación» manual ya no existe.
- Al guardar el detalle, los roles se ajustan a los cargos: se revocan los que ya no dan y se asignan los que faltan,
  cada uno con su contrato y su evento. Las personas de antes tienen roles viejos (con LOB y áreas del kit): se ajustan
  la primera vez que se guarda su detalle.
- Gestión de Roles y Permisos agrupa por **área principal**; quien tiene cargos en dos áreas sale en las dos. Los
  campos por área (H-027) se definen por área principal.
- Datos base: las áreas muestran «Pertenece a»; los cargos, «Área o sub-áreas».
- Puente al kit (`src/dominio/areas.ts`): Operations → `coo`, Service → `broker-support`, BOB & Commissions →
  `bob-commissions`, Contracting y Telecomunicaciones → `contracting-telco`, Quality → `quality`, Finance → `vpf`,
  Commercial → `ceo-commercial`, New Business → `new-business`, Growth → `gr`, Strategy / Marketing / Technology →
  `vp-strategy`, Product → `product`, Management CEO → `ceo`.

**Por validar:**
- Con este mapa, alguien de **Growth** no ve Lead Management (en el kit es de New Business). ¿Growth trabaja leads?
- Carlos Mora («Business Process Liaison») y el usuario Product Claro One no tienen un cargo de la lista.

**Ajuste (2026-10-15):** en usuarios se ve el **Rol** que dan sus cargos (Doer, Coordinator…), solo lectura, como el
área y la sub-área: en el detalle, en el formulario y como columna de la tabla.

### H-039 · Carga masiva de territorios

Pedido del negocio (2026-10-15), con la plantilla `Public/territory_template.csv`: Territory Name, Region,
Subregion, Zip Codes.
- En la pestaña Territorios: «Descargar plantilla» (solo el encabezado, sin las filas de ejemplo; sale de la misma
  lista de columnas que valida la carga), «Subir territorios» y «Agregar territorio».
- **Subir:** un .csv de la plantilla (hasta 500 filas, 2 MB). Vista previa con cada fila «Lista» o «Con errores» y por
  qué; total, listas y con errores; «Ver solo errores». **Solo se importa si el 100 % está bien** (como leads, H-026;
  misma excepción al kit: el primario va deshabilitado con el motivo).
- Reglas por fila: nombre nuevo (ni en Datos base ni repetido en el archivo); Region = un estado vigente, por nombre
  (Florida) o por sus 2 letras (FL); ZIP de 5 dígitos, que no estén en otro territorio vigente ni en otra fila.
- La misma validación (`src/dominio/territorios.ts`) corre en el navegador y en el contrato (`importar-territorios`,
  todo o nada). Cada territorio importado queda en el rastro con el nombre del archivo.
- **Subregión** (el condado): campo nuevo del territorio, opcional (`baselines.subregion`, migración 0027).

**Ajuste (2026-10-15):** se quitó el aviso verde «Asignar rol / Assignment · hipótesis…» de Gestión de Roles y Permisos.
Al guardar no sale aviso (el cambio se ve); los rechazos salen en el formulario del detalle o, al crear y eliminar,
en un mensaje corto.

### H-040 · Campos condicionales: On field, Territorios y tipo de clientes

Reglas del negocio (2026-10-15): a quien tenga **Doer en New Business o Growth** se le pregunta si es **On field**; si
responde Sí, sus **Territorios** (multiselección de Datos base). Además, **qué tipo de clientes atiende**: Agente,
Agencias, Vendedor sin NPN, Benefit coordinator (multiselección).
- Los campos por área (H-027) ahora pueden pedirse solo a algunos: **«Solo para»** (roles, y opcionalmente sub-áreas
  del área) y **«Solo si»** (otro campo Sí/No de la misma área vale Sí o No). Las listas pueden tomar sus opciones de
  **Territorios** de Datos base. Todo se configura en «Campos del área», columna «A quién se le pide».
- Los tres campos quedaron creados en Commercial (migraciones 0028 y 0029), obligatorios para quien aplican:
  «On field» (Sí/No), «Territorios» (solo si On field = Sí) y «Tipo de clientes que atiende».
- A quien no se le pide un campo, ni lo ve ni se le exige (la tabla muestra una raya). Si deja de aplicarle (p. ej.
  pasa a On field = No), su valor se cierra al guardar.
- Columnas `area_fields.for_roles`, `for_subareas`, `depends_on`, `depends_value`.

### H-041 · Los estados filtran los territorios

Regla del negocio (2026-10-15): On field = Sí → **Estados** → **Territorios**, y los territorios que se ofrecen son
solo los de los estados elegidos.
- Campo nuevo en Commercial: «Estados» (multiselección de Datos base, obligatorio, mismo «Solo para» y «Solo si On
  field = Sí»), entre «On field» y «Territorios» (migración 0030).
- Los campos por área tienen **«Filtrar opciones por»** (`area_fields.filter_by`): una lista de territorios se filtra
  por un campo de estados de la misma área. Se configura en «Campos del área»; la columna Tipo dice «filtrado por».
- Al editar: sin estados, Territorios dice «Elige primero los estados». Si se quita un estado, los territorios de ese
  estado salen solos de lo elegido. El contrato también rechaza un territorio que no sea de los estados elegidos.

### H-042 · Territorio de los leads por ZIP y asignación a Doer de New Business

Pedido del negocio (2026-10-15). Decisiones de la usuaria: **sin IA externa por ahora**, desempate por **menor carga**,
y **botón masivo + asignar por lead**.
- **Al importar**, cada lead con ZIP queda con el territorio de Datos base que contiene ese ZIP (`leads.territory`
  guarda el código del territorio; antes era texto libre).
- **En Leads:** columna «Territorio» (el territorio, «Por asignar: X», «ZIP … sin territorio» o «Sin ZIP»).
  - Si hay leads cuyo ZIP ya está en un territorio sin tenerlo asignado: «Asignar territorios» (acción
    `asignar-territorios`).
  - Si hay ZIP en ningún territorio: «Resolver con Ask Claro» (`sugerir-territorios`, la IA propone, deja evento).
    Por cada ZIP propone un territorio existente con su **confianza** y su **motivo** (zona postal de 3 dígitos,
    ciudad de otros leads, ZIP vecino) o **uno nuevo con el estado del lead** (los ZIP de una misma ciudad comparten el
    nuevo). Se puede cambiar el destino y el nombre. «Aplicar» lo hace un Administrador: agrega los ZIP al territorio
    o crea el nuevo con el contrato de Datos base (la página compone las dos features), y luego asigna por ZIP.
- **Asignar:** «Asignar leads (n)» (masivo, `asignar-leads`) y «Asignar» de cada lead (la sugerencia usa la misma
  regla). Se habilitan **cuando ningún lead tiene un ZIP sin territorio**. La regla: **Doer de New Business** que
  atiende el **tipo** del lead (campo «Tipo de clientes que atiende»), cubre **todas sus LOB** («Línea de negocio») y
  su **territorio** («Territorios»). Sin territorio se ignora el territorio; sin LOB, la LOB; sin ninguno, solo el
  tipo. Entre varios, el de **menos leads abiertos** (crece con cada asignación del lote, así se reparte). Los que no
  tienen a nadie quedan sin asignar y el mensaje dice cuáles.
- Lógica pura en `src/dominio/territorioLeads.ts`. Los datos del Doer salen de los campos de Commercial: la lista con
  fuente LOB, la de territorios y el campo «Tipo de clientes que atiende» (por su nombre).

**Por validar:**
- Hoy no hay ningún usuario con un cargo de Doer de New Business: la asignación no encontrará a nadie hasta que existan.
- Un Doer de New Business con On field = No no tiene territorios: no recibe leads que tengan territorio.
- La regla local es una aproximación; con una clave de Anthropic se cambia por un modelo de verdad.

**Ajuste (2026-10-15) · H-033 y detalle del usuario:** el rastro del detalle usa `src/components/RastroDeEventos.tsx`,
igual al del kit pero con `title` / `content` de antd 6: ya no salen los avisos de `Timeline` («2 Issues»). Cuando
el kit lo corrija, se vuelve al suyo y se borra este. Además, el título del detalle muestra solo el nombre (los cargos
ya están en «Cargos») y «Asignaciones activas» ya no se repite: con cargos, los roles se ven en «Roles activos»; solo
quien no tiene cargos del catálogo ve sus asignaciones guardadas.

### H-043 · Territorio y asignación, desde la importación

Decisión de la usuaria (2026-10-15): la validación del territorio y la asignación de los leads se hacen **en la vista
de Importaciones**; a la pestaña Leads tienen que llegar ya asignados.
- Al expandir una importación, junto a «Importados / Errores»: el resumen («Territorio: 1 de 1 con ZIP · Asignados:
  0 de 1») y, para los leads de **ese archivo**: «Asignar territorio por ZIP (n)», «Resolver n ZIP con Ask Claro» y
  «Asignar leads (n)» (habilitado cuando sus leads con ZIP tienen territorio).
- La columna Territorio del detalle dice el territorio, «Por asignar», «ZIP … sin territorio» o «Sin ZIP».
- Las acciones `asignar-territorios`, `sugerir-territorios` y `asignar-leads` reciben `importacionId` y actúan
  solo sobre los leads de esa importación (la carga que desempata sigue contando todos los leads abiertos).
- La pestaña Leads ya no tiene esos avisos ni el botón masivo: muestra el territorio y el responsable. El «Asignar» de
  cada lead sigue, para casos puntuales.

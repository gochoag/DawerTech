# Registro de decisiones

Decisiones que debe conocer todo el equipo. Formato: «D-NNN · fecha · decisión», seguido de «Por qué:» y, si existe, «Detalle:». Una decisión no se borra: se marca como sustituida y se añade otra.

## D-001 · 2026-11-01 · Las reglas para agentes viven en `AGENTS.md` y `CLAUDE.md`, copias idénticas y versionadas

Por qué: cada herramienta de IA carga su archivo automáticamente (`AGENTS.md` para Codex y la mayoría de agentes, `CLAUDE.md` para Claude Code); copias completas evitan depender de importaciones que no todas las herramientas entienden.

Detalle: sustituyen a `.agents/PROJECT_RULES.md` (y a su copia temporal `docs/PROJECT_RULES.md`). La especificación completa sigue en `docs/reglas_de_desarrollo_y_ux.md`.

## D-002 · 2026-11-01 · Mapa del código con Graphify, local y sin IA

Por qué: los agentes ubican código con consultas al grafo en vez de abrir decenas de archivos, sin coste de tokens ni envío de código fuera del equipo.

Detalle: `graphify-out/` no se versiona (salvo los nombres de subsistemas, si algún día se generan) y se regenera con `GRAPHIFY_BACKEND=none graphify update .`. Sin nombres con IA para los subsistemas.

## D-003 · 2026-11-01 · Las credenciales del admin local se mantienen en las reglas

Por qué: decisión del usuario; son de la base de desarrollo local y los agentes las necesitan para probar en el navegador. El repositorio es público, así que son visibles.

## D-004 · 2026-11-01 · La base de datos es PostgreSQL (`dawer-bd`); SQLite queda retirado

Por qué: el usuario compró un VPS donde usará PostgreSQL y no se seguirá usando SQLite. Sustituye la regla 2 anterior, que fijaba `backend/inventory.sqlite3`.

Detalle: la URL va en `DAWERTECH_DATABASE_URL` de `backend/.env` (fuera de Git). Los datos se copiaron con `backend/scripts/sqlite_a_postgres.py`; la migración `0003` pone al día el esquema que antes creaba la app al arrancar. `flask respaldar` usa `pg_dump`. Cada movimiento bloquea la fila del repuesto (`SELECT ... FOR UPDATE`) para que el stock no quede negativo con dos movimientos a la vez. `docs/despliegue.md` (PythonAnywhere con SQLite) queda desactualizado hasta el paso al VPS.

## D-005 · 2026-11-01 · DawerTech completo (web y API) se muda a un VPS compartido con el dominio `dawer.cfd`

Por qué: el usuario compró un VPS (Hostinger, Ubuntu 24.04) que compartirá con otro programador, y el dominio `dawer.cfd` (Spaceship). Sustituye a PythonAnywhere (API) y a Cloudflare Pages (web). `dawer.cfd` es **temporal** y no se renueva: en unos 6 meses se comprará el dominio oficial en Hostinger (por ejemplo `tecnomovil.com`), también con DNS en Cloudflare, y DawerTech pasará a un subdominio (por ejemplo `dawer.tecnomovil.com`) antes de que caduque `dawer.cfd`.

Detalle: web en `https://dawer.cfd` (nginx sirve los estáticos), API en `https://api.dawer.cfd/api/v1` (contenedor Docker con gunicorn), base `dawertech` en un PostgreSQL compartido (una base y un usuario por proyecto). Todo dominio del VPS pasa por Cloudflare con proxy; el puerto 443 solo acepta a Cloudflare y el SSH solo va por Tailscale. GitHub Actions despliega cada merge a `main` sin cortes (azul/verde) y vuelve atrás solo si la versión nueva falla. La descarga del APK desde la web (`functions/download-apk.js`) pasa a una ruta de Flask. No hay límites de RAM, CPU ni disco por proyecto: cada dev optimiza y mide su proyecto (guía del otro dev y `docs/vps/02-preparar-dawertech.md`); el servidor solo protege a Postgres ante falta de memoria, avisa por Telegram de RAM, swap o disco altos, y el CI informa el consumo y solo bloquea si la app se cae. La caché de listas se prueba primero en DawerTech; en la guía es una recomendación opcional que el dev evalúa con su LLM. El repositorio público `infra-vps-tecnomovil` contiene solo lo que usa el otro dev (guía, `vps-check`, plantillas, flujo de Actions, `projects.yml`); lo del admin (configuración del VPS, emergencias) está en `docs/vps/` y los scripts internos del servidor en `vps/`. Lo propio de DawerTech va en `docs/vps/` y en la carpeta `deploy/` (`deploy-dev` y `deploy-produccion`, estructura obligatoria en todo proyecto del VPS). Producción sigue en PythonAnywhere hasta el corte descrito en `docs/vps/03-subir-dawertech.md`.

## D-006 · 2026-11-02 · `deploy-dev` con Docker en el PC y `test_api.py` en GitHub Actions

Por qué: todo proyecto del VPS tiene `deploy/deploy-dev` para probar en el PC la misma imagen que irá a producción, y la regla 2 prohibía servidores secundarios.

Detalle: excepción a la regla 2 para `deploy/deploy-dev/`: la API en Docker en el PC del dev (otro puerto, por ejemplo 8000), a la vez que el backend principal si se quiere, siempre conectada a la base local `dawer-bd` fuera de Docker; nunca crea bases ni contenedores de Postgres. El VPS no usa esa carpeta. `backend/tests/test_api.py` se ejecuta solo en GitHub Actions, sobre un Postgres desechable del runner (hay que adaptarlo de SQLite a Postgres); en el PC del equipo sigue sin ejecutarse.

## D-007 · 2026-11-02 · La administración del VPS sale de DawerTech a un repo privado compartido

Por qué: el VPS es de los dos admins y no debe depender del repositorio personal de DawerTech; además, así los scripts y la documentación del servidor no son públicos.

Detalle: la carpeta `vps/` (scripts, compose de Postgres y Uptime Kuma, temporizadores, sudoers) y `docs/vps/01-configuracion-vps.md` y `04-operacion-y-recuperacion.md` pasan al repo privado `JuanRZAR/vps-tecnomovil-admin` (cuenta compartida). En el VPS se clona en `/opt/vps/admin-repo` con una deploy key de solo lectura y `/opt/vps/admin` apunta a él. En DawerTech quedan `docs/vps/02-preparar-dawertech.md` y `03-subir-dawertech.md`. Sustituye lo dicho en D-005 sobre `vps/` y `docs/vps/`.

# 2. Preparar DawerTech para el VPS

Cambios en este repositorio para que DawerTech (API + web) se despliegue en el VPS con `dawer.cfd`. Las reglas generales que debe cumplir cualquier proyecto están en `infra-vps-tecnomovil/guia/02-preparar-proyecto.md`; aquí solo lo concreto de DawerTech.

Resultado:

| Pieza | Dónde queda |
|---|---|
| Web (Angular) | `https://dawer.cfd`, archivos estáticos servidos por nginx (`www.dawer.cfd` redirige) |
| API (Flask) | `https://api.dawer.cfd/api/v1`, contenedor con gunicorn |
| Descarga del APK desde la web | `https://dawer.cfd/download-apk`, atendida por la API |
| Base | `dawertech` en el PostgreSQL compartido del VPS |
| Fotos | `/srv/apps/dawertech/data/media` |
| APK | Sigue publicándose en GitHub Releases; apunta a `https://api.dawer.cfd/api/v1` |

## Decisiones tomadas (D-006)

1. **`deploy/deploy-dev`**: levanta la API en Docker en el PC (por ejemplo en el puerto 8000), a la vez que `flask run` si el dev quiere, conectada a la base local `dawer-bd` que corre fuera de Docker (`host.docker.internal`). No crea bases ni Postgres en Docker. Es una excepción expresa a la regla 2.
2. **`backend/tests/test_api.py` corre en GitHub Actions** sobre un Postgres desechable del runner; en este equipo sigue sin ejecutarse. Hoy usa SQLite temporal y su prueba de respaldo espera un `.sqlite3`, pero `flask respaldar` usa `pg_dump` desde D-004: hay que adaptarlo a Postgres.

## Paso 2.1 Contenedor de la API

**`backend/Dockerfile`** (nuevo), multi-etapa con uv:
- Etapa de build: `python:3.12-slim` + `uv` (copiado de la imagen oficial `ghcr.io/astral-sh/uv`), `uv sync --frozen --no-dev` con `pyproject.toml` y `uv.lock`.
- Etapa final: `python:3.12-slim`, copia `/app` (código + `.venv`), `PATH` con `.venv/bin`, `EXPOSE 8000`.
- Arranque: `gunicorn --bind 0.0.0.0:8000 --workers 2 --threads 4 --worker-class gthread --timeout 60 --graceful-timeout 20 wsgi:application` (la entrada ya existe en `backend/wsgi.py`).
- Sin `.env` dentro de la imagen.

**`backend/.dockerignore`** (nuevo): `.venv`, `__pycache__`, `.pytest_cache`, `tests`, `media`, `backups`, `.env*`, `*.sqlite3*`, `dawertech_api.egg-info`.

**`backend/pyproject.toml`**: añadir `gunicorn` (`uv add gunicorn`, que actualiza `uv.lock`).

**Pool de conexiones** (`backend/dawertech/shared/infrastructure/database.py`, función `make_engine`): hoy usa el valor por defecto de SQLAlchemy (5 + 10 de desborde = hasta 15 conexiones por proceso). Con 2 workers y las dos versiones conviviendo durante el despliegue serían 60, y el usuario de Postgres admite 20. Cambio: `pool_size=3, max_overflow=2` (2 workers × 5 × 2 versiones = 20).

**Comprobar**: `docker build -t dawertech-api:prueba backend` termina; la imagen pesa menos de 500 MB.

## Paso 2.2 Descarga del APK en Flask

Hoy la hace `functions/download-apk.js` en Cloudflare Pages. Se porta a una ruta de Flask `GET /download-apk?code=<versionCode>` (sin el prefijo `/api/v1`, para que el frontend conserve su valor por defecto `/download-apk` y no cambie nada en Angular):

- Mismas validaciones que la función actual: `code` entero positivo hasta 2.100.000.000; repositorio de `DAWERTECH_APK_REPOSITORY` (por defecto `gochoag/DawerTech`) con formato `cuenta/repo`; la release `android-v<code>` existe, no es borrador ni prerelease; el asset se llama `dawertech-release.apk`, está subido, pesa entre 1 byte y 64 MiB; su URL es de `github.com` y su ruta es exactamente la esperada.
- Transmite el archivo por partes (sin cargarlo entero en memoria), con `Content-Type: application/vnd.android.package-archive`, `Content-Disposition: attachment`, `X-APK-Size`, `Access-Control-Expose-Headers: X-APK-Size`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Errores con mensaje en español: «No se pudo descargar el APK. Inténtalo de nuevo.» (400, 404 o 502, como hoy).
- Solo biblioteca estándar (`urllib.request`), sin dependencias nuevas; tiempo máximo de 15 s para consultar la release.
- Prueba nueva `backend/tests/test_apk_download.py` para las validaciones (códigos inválidos, release borrador, asset con otro nombre o URL ajena), con la llamada a GitHub simulada: sin red ni bases temporales.

## Paso 2.3 Carpeta `deploy/` (hecho)

```
deploy/
├─ deploy-dev/            prueba en el PC de la imagen de producción (D-006)
│  ├─ compose.yml         build de backend/, red del host (WSL «mirrored»), puerto 8000, base dawer-bd de Windows
│  └─ .env.example
└─ deploy-produccion/
   ├─ compose.yml         app (solo lectura, /tmp en memoria, usuario 10001, healthcheck con Python) y migrate (alembic)
   ├─ .env.example
   ├─ nginx/dawertech-web-descarga-apk.conf    location /download-apk hacia la API, sin búfer
   └─ README.md
```

- Los sitios nginx los genera `vps-new-project` desde las plantillas de `infra-vps-tecnomovil`; el proyecto solo aporta el extra de `/download-apk`, que el admin instala en `/etc/nginx/vps-extra/`.
- El límite de subida de nginx (10 MB) ya supera el de Flask (`MAX_CONTENT_LENGTH`, 5 MiB): no hace falta ajuste para la API.
- `deploy-dev` se ejecuta desde una terminal de WSL (`docker compose up --build` en `deploy/deploy-dev`): Docker corre en WSL y los volúmenes necesitan rutas de Linux.
- Comprobado: `vps-check` aprueba el compose; la imagen (298 MB) arranca en solo lectura y `/health` responde.

## Paso 2.4 Web (hecho)

Sin cambios de código en Angular. En el VPS, la web se compila con `DAWERTECH_API_URL=https://api.dawer.cfd/api/v1` y usa `/download-apk` del mismo dominio (ruta de Flask del paso 2.2, publicada por nginx). Los valores de GitHub Releases quedan por defecto.

## Paso 2.5 Workflow `.github/workflows/deploy.yml` (hecho)

- **`pruebas`**: `check_rules.py`; backend con `uv run pytest -q` (incluye `test_api.py` sobre un PostgreSQL 17 desechable del runner, con cliente 17 para `pg_dump`/`pg_restore`); frontend con `typecheck`, `test:session` y `build`; sube la web como artefacto `web`.
- **`vps`**: llama a `JuanRZAR/infra-vps-tecnomovil/.github/workflows/deploy.yml@v1` (`proyecto: dawertech`, `dockerfile: backend/Dockerfile`, `contexto: backend`, `web: web`, `url_salud: https://api.dawer.cfd/health`). Para la prueba de consumo arranca la imagen con una clave y una URL de base ficticias (sin base, `/health` responde igual).
- En un PR solo prueba; en push a `main` despliega. No despliega si el push solo cambia `docs/` o archivos `.md`.
- Pruebas que necesitan base: `test_api.py` se salta si no existe `DAWERTECH_TEST_DATABASE_URL` (solo GitHub Actions la define); `test_device_search.py` y `test_part_name_matches.py` hacen solo `SELECT` sobre la base principal en modo solo lectura (`tests/conftest.py`). Ninguna crea bases ni archivos SQLite en el PC.
- `pages-deployment.yml`, `functions/`, su prueba (`frontend/tests/apk-proxy.test.mjs`) y `docs/pythonanywhere-wsgi.py` se eliminaron; `docs/despliegue.md` describe el VPS. `android-release.yml` no cambia: el día del corte solo cambia la variable `DAWERTECH_API_URL` (ver `03-subir-dawertech.md`).

## Paso 2.6 Rendimiento y consumo de DawerTech (medido el 2026-11-02)

Imagen de producción (solo lectura, usuario 10001, 2 workers × 4 hilos) en `deploy-dev` contra `dawer-bd`, con 10 clientes simultáneos durante 30 s por ruta:

| Medida | Valor |
|---|---|
| Memoria en reposo | 127-145 MiB (2 workers) |
| `GET /parts` (página de 20) | 118 req/s, p50 79 ms, p95 142 ms, 0 errores |
| `GET /devices` (página de 20) | 132 req/s, p50 71 ms, p95 128 ms, 0 errores |
| `GET /parts?q=samsung` | 112 req/s, p50 85 ms, p95 146 ms, 0 errores |
| Memoria tras las cargas y una vista previa de Excel | 146 MiB: no crece |
| Imagen | 298 MB |

La medición destapó un fallo previo: `GET /parts` abría sesiones sin cerrarlas y agotaba el pool de 3+2 conexiones (error 500 tras unas decenas de peticiones). Corregido en `inventory/presentation/routes.py` (`with db_session()`) y cubierto por `test_list_parts_returns_connections_to_the_pool` en `test_api.py`.

Pendiente de medir con datos reales en el VPS: el pico al subir una foto grande (Pillow) y al importar un Excel grande (openpyxl). Después del corte, revisa `sudo vps-status` de vez en cuando.

## Paso 2.7 Listas sin consultas repetidas (se prueba primero en DawerTech)

Hoy, al volver a una lista (repuestos, celulares, movimientos), el frontend repite la consulta a la API aunque nada haya cambiado: `ApiService` no guarda nada en caché. Se implementa aquí primero para ver cómo funciona antes de recomendarlo con más fuerza en la guía:

- **Frontend** (lo que ahorra consultas a la base): las páginas de listas muestran al instante la última respuesta guardada para esos mismos filtros y página, y la refrescan en segundo plano solo si pasaron más de 30 s. Crear, editar, borrar o registrar un movimiento invalida la caché afectada. La caché vive en memoria (no en `localStorage`) y se borra al cerrar sesión, sin tocar la sesión guardada (regla 12).
- **API** (opcional, ahorra transferencia, no consultas): `ETag` en las respuestas de listas con `response.add_etag()` y `make_conditional()` de Flask; si nada cambió, la API responde `304` sin cuerpo.
- **Medir**: contar en la pestaña Red del navegador las peticiones al recorrer repuestos > detalle > repuestos > movimientos > repuestos, antes y después.
- **Prueba** de la lógica de caducidad e invalidación en el frontend, siguiendo el patrón de `pnpm run test:session`.

## Lista de verificación

- [ ] Imagen de la API construida (ideal menos de 500 MB), arranca y `/health` responde.
- [ ] Consumo medido y anotado (paso 2.6).
- [ ] Caché de listas implementada, medida y con su prueba (paso 2.7).
- [ ] Pool de conexiones limitado.
- [ ] `/download-apk` en Flask con su prueba en verde.
- [ ] Carpeta `deploy/` completa y aprobada por `vps-check`.
- [ ] `python scripts/check_rules.py`, `pnpm run typecheck`, `pnpm run test:session` y `pnpm run build` en verde.
- [ ] `docs/arquitectura.md` y `docs/api.md` mencionan `/download-apk` en Flask.

Sigue con [03-subir-dawertech.md](03-subir-dawertech.md).

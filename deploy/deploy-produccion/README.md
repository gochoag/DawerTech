# DawerTech en el VPS

Qué despliega GitHub Actions (`.github/workflows/deploy.yml`) en cada merge a `main`:

- **API**: imagen `ghcr.io/gochoag/dawertech:<sha>` construida desde `backend/Dockerfile` (gunicorn, 2 workers × 4 hilos, usuario 10001), con `compose.yml`. Antes de cada versión nueva se ejecuta `migrate` (`alembic upgrade head`) y el VPS guarda un volcado de la base.
- **Web**: `frontend/www/browser`, compilada con `DAWERTECH_API_URL=https://api.dawer.cfd/api/v1`; la sirve nginx en `https://dawer.cfd`.

| En el VPS | Qué es |
|---|---|
| `/srv/apps/dawertech/.env` | Variables de `.env.example` con sus valores reales (600, dueño `deploy`) |
| `/srv/apps/dawertech/data/media/` | Fotos (dueño 10001) |
| Base `dawertechbd` del Postgres compartido | Datos; respaldo diario en `/srv/backups/dawertech/` |
| `/etc/nginx/vps-extra/dawertech-web-descarga-apk.conf` | Copia de `nginx/dawertech-web-descarga-apk.conf`: `dawer.cfd/download-apk` lo atiende la API |

Variables: ver `.env.example`. Migraciones: siempre compatibles con la versión anterior (durante unos segundos conviven las dos; ver la guía de `infra-vps-tecnomovil`, 2.8).

Alta, carga de datos y corte desde PythonAnywhere: `docs/vps/03-subir-dawertech.md`.

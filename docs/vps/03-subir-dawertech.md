# 3. Subir DawerTech al VPS (día del corte)

Cómo pasar DawerTech de PythonAnywhere y Cloudflare Pages al VPS con **un solo push a `main`**. Requisitos: el VPS configurado (`docs/01-configuracion-vps.md` del repo privado `JuanRZAR/vps-tecnomovil-admin`) y DawerTech preparado ([02-preparar-dawertech.md](02-preparar-dawertech.md)).

Hasta el día del corte, **producción sigue en PythonAnywhere**. El corte deja la app sin servicio unos 30-45 minutos: elige una hora sin uso del taller y avisa antes.

---

## A. Antes del día del corte (sin push a `main`)

### A1. Comprobaciones en el PC

- [ ] `python scripts/check_rules.py`, `cd backend; uv run pytest -q` y en `frontend`: `pnpm run typecheck`, `pnpm run test:session`, `pnpm run build`.
- [ ] `deploy/deploy-dev` levanta la API en `http://localhost:8000` contra `dawer-bd` y `/health` responde.
- [ ] Recomendado: sube los cambios a una **rama** y abre un PR (sin merge). GitHub Actions ejecuta todas las pruebas, `test_api.py`, el build de la imagen, Trivy, `vps-check` y la prueba de consumo **sin desplegar ni publicar APK** (eso solo ocurre en `main`).

### A2. GitHub: secretos de despliegue de DawerTech

En `gochoag/DawerTech` > Settings > Secrets and variables > Actions:

| Secreto | De dónde sale |
|---|---|
| `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | Tailscale > Settings > Trust credentials > OAuth, permiso **Auth Keys: Write**, etiqueta `tag:ci`. Uno solo para DawerTech |
| `VPS_SSH_KEY` | Clave solo para este CI: `ssh-keygen -t ed25519 -C "ci-dawertech" -f "$env:USERPROFILE\.ssh\ci-dawertech"` (sin frase de paso). Aquí va la **privada**; bórrala del PC después |
| `VPS_HOST` | `tecnomovil-vps.taild3e1c2.ts.net` |
| `VPS_KNOWN_HOSTS` | Salida de `ssh-keyscan -t ed25519 tecnomovil-vps.taild3e1c2.ts.net` (ejecutado en el VPS) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | Token del bot y `-5565466132` |

Los secretos `ANDROID_*` siguen igual. **No** actives todavía el ruleset de `main` (exigir PR): el push del día del corte va directo a `main`.

### A3. VPS

Con `sudo -v` primero:

```bash
# Clave del CI (la pública ci-dawertech.pub) con comando forzado: solo puede desplegar dawertech
sudo nano /home/deploy/.ssh/authorized_keys
#   command="/opt/vps/admin/bin/vps-deploy dawertech",restrict ssh-ed25519 AAAA... ci-dawertech

# Carpeta de fotos y descarga del APK desde la web (pega deploy/deploy-produccion/nginx/dawertech-web-descarga-apk.conf)
sudo install -d -o 10001 -g 10001 -m 750 /srv/apps/dawertech/data/media
sudo nano /etc/nginx/vps-extra/dawertech-web-descarga-apk.conf
sudo nginx -t && sudo systemctl reload nginx

# Variables de producción (ya existe vacío, 600, dueño deploy), a partir de deploy/deploy-produccion/.env.example
sudo nano /srv/apps/dawertech/.env
```

En el `.env`: la URL de `dawertechbd` (guardada en tu gestor de contraseñas, con `postgresql+psycopg://` al inicio) y una `DAWERTECH_SECRET_KEY` nueva (`openssl rand -base64 48`). Guarda una copia del `.env` en el gestor de contraseñas.

---

## B. Día del corte

1. **Copia final de PythonAnywhere** (consola Bash):

   ```bash
   source /home/holorey123/.virtualenvs/dawertech/bin/activate
   cd /home/holorey123/DawerTech/backend
   flask respaldar /home/holorey123/backups
   ```

   Descarga el SQLite respaldado y la carpeta `media/` completa.
2. **Detén PythonAnywhere**: Web > **Disable** (desde aquí nadie puede cambiar datos; empieza el corte). Mejor deshabilitar que borrar: si algo sale mal se puede volver a activar. Se borra en la sección C.
   Borra también el proyecto `dawertech` de Cloudflare Pages (en la otra cuenta): la web pasa a `https://dawer.cfd`.
3. **GitHub** (`gochoag/DawerTech` > Settings > Secrets and variables > Actions):
   - variable `DAWERTECH_API_URL` = `https://api.dawer.cfd/api/v1` (**antes del push**: el APK se compila con este valor);
   - borra los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` y la variable `CLOUDFLARE_PAGES_PROJECT` si existe.
4. **El push a `main`.** Se ejecutan dos workflows a la vez:
   - **Desplegar**: pruebas, imagen, migración (crea las tablas en `dawertechbd`), API y web en el VPS;
   - **Publicar APK Android**: APK nuevo en GitHub Releases, ya con `api.dawer.cfd`.

   Espera a que **Desplegar** termine en verde: `https://dawer.cfd` muestra el inicio de sesión.
5. **Cargar los datos.** La app crea al arrancar las categorías y variantes por defecto (`seed_catalog_metadata`), y el script de copia exige tablas vacías; la copia trae las suyas. En el VPS:

   ```bash
   sudo docker exec postgres psql -U postgres -d dawertechbd -c "TRUNCATE categories, variants RESTART IDENTITY"
   ```

   En PuTTY, abre la sesión `tecnomovil` con el túnel `15432` → `127.0.0.1:5432` (Connection > SSH > Tunnels). Desde `backend/`, en PowerShell:

   ```powershell
   uv run python scripts/sqlite_a_postgres.py "<ruta>\inventory.sqlite3" "postgresql+psycopg://dawertechbd:<clave>@127.0.0.1:15432/dawertechbd"
   ```

   El script copia todo en una transacción, imprime las filas por tabla y se detiene sin copiar nada si algo no cuadra. No hace falta `flask crear-admin` ni `flask cargar-celulares`: usuarios y catálogo vienen en la copia.
6. **Subir las fotos.** Con WinSCP, arrastra los `.webp` de `media/` a `/tmp/` del VPS. Luego, en PuTTY:

   ```bash
   sudo mv /tmp/*.webp /srv/apps/dawertech/data/media/ && sudo chown 10001:10001 /srv/apps/dawertech/data/media/*.webp
   ```

7. **Comprobar** en `https://dawer.cfd`:
   - [ ] Iniciar sesión con una cuenta de PythonAnywhere (las contraseñas viajan en la copia).
   - [ ] Inventario, detalle de un repuesto con su foto, catálogo de celulares.
   - [ ] Crear un repuesto con foto y registrar una entrada y una salida.
   - [ ] Importar un Excel y un CSV.
   - [ ] Usuarios y Mi cuenta.
   - [ ] Descargar el APK desde la web: barra de progreso y archivo completo.
   - [ ] `Ctrl+Shift+R` en una ruta interna: sin 404 y la sesión se mantiene.
   - [ ] En un celular con el APK viejo: aparece la actualización, se instala y, tras iniciar sesión una vez, funciona contra `api.dawer.cfd`.
8. **Avisa a los usuarios**: abrir `https://dawer.cfd` o actualizar el APK cuando lo ofrezca, e iniciar sesión una vez (servidor nuevo).

**Si algo sale mal antes del paso 5**: vuelve a activar PythonAnywhere (Web > Enable) y, en GitHub, devuelve `DAWERTECH_API_URL` a la URL de PythonAnywhere. Los celulares que ya se hayan actualizado apuntan al VPS: publica otro APK con la URL vieja o termina el corte otro día.

Si alguien actualiza el APK entre el push y la carga de datos, verá la app vacía hasta terminar el paso 5.

---

## C. Después del corte (1-2 semanas, con todo estable)

1. PythonAnywhere: guarda la última copia fuera del servidor y **borra** la web app.
2. Uptime Kuma: añade `https://dawer.cfd` y `https://api.dawer.cfd/health`.
3. Cloudflare: evalúa **Bot Fight Mode** probando la web, el APK y un despliegue.
4. GitHub: ruleset de `main` (exigir PR y que pasen `pruebas` y `vps`; bloquear force push).
5. Quita de `PROJECT_MEMORY.md` el pendiente del paso al VPS.

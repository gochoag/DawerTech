# Despliegue y operación

## Antes de publicar

Para publicar en Internet, necesitas una cuenta de PythonAnywhere y un proyecto de Cloudflare Pages. Define un dominio real para la API y la web y usa HTTPS. En la red local del taller se admite HTTP con la IP privada del PC. Mantén fuera del repositorio la clave JWT, la base, las imágenes, los respaldos y el keystore Android.

## PythonAnywhere

1. Sube el proyecto al espacio de tu cuenta. Crea un entorno virtual Python 3.12 e instala `backend/` con `pip install -e .` desde esa carpeta.
2. Crea `/home/TU_USUARIO/dawertech-data/media` y una clave privada en `/home/TU_USUARIO/.dawertech-secret` (al menos 32 bytes aleatorios). Por ejemplo, en Bash: `python -c 'import secrets; print(secrets.token_urlsafe(48))' > ~/.dawertech-secret` y luego `chmod 600 ~/.dawertech-secret`.
3. En la consola Bash del servidor, desde `backend/`, exporta `DAWERTECH_DATABASE_URL=sqlite:////home/TU_USUARIO/dawertech-data/inventory.sqlite3`, `DAWERTECH_MEDIA_DIR=/home/TU_USUARIO/dawertech-data/media`, `DAWERTECH_SECRET_KEY="$(cat ~/.dawertech-secret)"` y `FLASK_APP=dawertech`. Ejecuta `python -m alembic upgrade head`; después `flask cargar-celulares` y `flask crear-admin`. El propietario se crea una sola vez.
4. Crea una web app manual con Flask/WSGI. Configura el virtualenv y copia el ejemplo [`pythonanywhere-wsgi.py`](pythonanywhere-wsgi.py) al archivo WSGI de PythonAnywhere. Sustituye `TU_USUARIO` y el origen exacto de Cloudflare Pages. Recarga la web app.
5. Verifica `https://TU_USUARIO.pythonanywhere.com/health` y entra desde la web. El endpoint de salud solo confirma que Flask responde; inicia sesión para verificar base y permisos.

En las actualizaciones: realiza un respaldo, sube código, instala dependencias, ejecuta `python -m alembic upgrade head`, comprueba el seed si cambió el catálogo y recarga la app. No sustituyas la base SQLite por el repositorio.

## Cloudflare Pages

Para publicar en una cuenta de Cloudflare distinta de la vinculada a GitHub, usa Direct Upload con el workflow [pages-deployment.yml](../.github/workflows/pages-deployment.yml). El token identifica la cuenta de destino; no requiere instalar la aplicación de Cloudflare en GitHub.

En GitHub, abre **Settings > Secrets and variables > Actions**. Crea los secretos `CLOUDFLARE_API_TOKEN` (permiso **Account > Cloudflare Pages > Edit**, limitado a la cuenta de destino) y `CLOUDFLARE_ACCOUNT_ID`. En **Variables**, configura `DAWERTECH_API_URL` con la URL HTTPS de la API terminada en `/api/v1`. Puedes definir `CLOUDFLARE_PAGES_PROJECT`; si se omite, se usa `dawertech`. La primera publicación requiere que el código local esté subido a GitHub.

Si aún no existe el proyecto Pages, sube el primer commit del workflow con `[skip ci]` en el mensaje. Después abre **Actions > Publicar frontend en Cloudflare Pages > Run workflow**, selecciona `main` y marca **Crear el proyecto Pages**. Esto crea el proyecto y publica `frontend/www/browser`. En ejecuciones posteriores deja esa opción desmarcada. Si el proyecto ya existe, omite su creación. Si la creación tuvo éxito pero la publicación falló, reintenta sin marcar la creación.

El workflow compila con Node.js 26 e instala pnpm 11.13.1 directamente con npm, usa el lockfile y rechaza una API ausente o sin HTTPS. Los siguientes pushes a `main` que modifiquen el frontend o el workflow publican automáticamente. Los cambios exclusivos del backend requieren actualizar y recargar PythonAnywhere por separado.

Toma el dominio real que Cloudflare muestra al publicar (puede incluir un sufijo si el nombre está ocupado). Agrégalo a `DAWERTECH_CORS_ORIGINS` en el `.env` del backend y recarga PythonAnywhere. Por ejemplo: `DAWERTECH_CORS_ORIGINS=https://dawertech.pages.dev,https://localhost`. Si el WSGI establece esta variable directamente, actualiza allí su valor: una variable del proceso tiene prioridad sobre `.env`. Verifica el inicio de sesión, el inventario vacío y el catálogo de celulares desde Pages; `/health` por sí solo no verifica estos flujos.

Documentación oficial: [Direct Upload con GitHub Actions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) y [crear un proyecto Pages con Wrangler](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Si prefieres la integración nativa de Pages con GitHub en una cuenta compatible:

Configura el directorio raíz como `frontend`, el comando de compilación `pnpm install && pnpm run build` y el directorio de salida `www/browser`. Define la variable de compilación `DAWERTECH_API_URL=https://TU_USUARIO.pythonanywhere.com/api/v1`. Agrega el origen HTTPS exacto de Pages a `DAWERTECH_CORS_ORIGINS` en PythonAnywhere; para Android incluye también `https://localhost`. Recompila la web cuando cambie la URL API. Las rutas internas se resuelven con el fallback SPA de Pages.

## Android y APK firmado

Desde `frontend`, ejecuta `pnpm install`, `pnpm run build:android` y genera los iconos con `scripts/generate-android-icons.ps1` si cambias el logo. En Android Studio abre `frontend/android`. El ID es `com.dawertech.inventory`; incrementa `versionCode` y `versionName` en `android/app/build.gradle` en cada actualización.

Para un APK de instalación directa, ejecuta una sola vez `scripts/prepare-release-signing.ps1` en PowerShell. Crea un keystore y `android/key.properties`, ambos ignorados por Git. **Respalda ambos archivos fuera del equipo antes de distribuir el APK**: las actualizaciones deben firmarse con la misma clave. Después, desde `frontend/android`, ejecuta `./gradlew assembleRelease` (Windows: `.\gradlew.bat assembleRelease`). El APK firmado queda en `android/app/build/outputs/apk/release`. También puedes usar Android Studio y el mismo keystore.

Para el taller, `pnpm run android:generate` detecta la IP local del PC y genera el APK en `frontend/apk-release/dawertech-release.apk`. Arranca el backend con `uv run flask run` desde `backend`; `.flaskenv` configura `0.0.0.0:5000`. El celular debe estar en la misma red y el firewall debe permitir este puerto en la red privada. Si la detección encuentra más de una interfaz física, define `DAWERTECH_ANDROID_API_URL=http://IP_DEL_PC:5000/api/v1` en `frontend/.env`. Para Internet, define `DAWERTECH_API_URL` y `DAWERTECH_ANDROID_API_URL` con `https://TU_USUARIO.pythonanywhere.com/api/v1` en el archivo de entorno antes de compilar. Puedes separar entornos usando `DAWERTECH_ENV_FILE=.env.production`. Solo estas URLs públicas se incluyen en los assets; no pongas claves ni contraseñas en las variables del frontend.

Al primer ingreso en Android usa correo y contraseña. La sesión se guarda siempre mediante Android Keystore, aunque no actives biometría. En **Mi cuenta** puedes activar la protección del acceso después de 7 días de inactividad; admite huella, rostro y el PIN, patrón o contraseña del dispositivo según lo configurado en Android. Una apertura reciente no solicita desbloqueo. El botón Atrás confirma la salida de la app y conserva la sesión; **Cerrar sesión** confirma la eliminación del acceso guardado y obliga a volver a usar correo y contraseña. La sesión recordada de Android no caduca por fecha; sigue sujeta a revocación por cierre de sesión, cambio de contraseña o desactivación de la cuenta. La web mantiene una renovación de 365 días. Comprueba el desbloqueo y el botón Atrás en un Android físico antes de distribuir el APK.

Si cambias la IP del PC, actualiza `DAWERTECH_ANDROID_API_URL` en `frontend/.env` y vuelve a ejecutar `pn android:dev`. Para evitar cambios, configura una reserva DHCP en el router. Los iconos adaptativos usan `dt-app-foreground.svg` con margen para las máscaras de Android; `dt-mark.svg` sigue siendo el logo de la interfaz.

## Respaldo y restauración

Haz una copia **diaria manual fuera de PythonAnywhere**, y otra antes de cada migración. En el servidor ejecuta `flask respaldar /home/TU_USUARIO/backups` con las variables de entorno configuradas. Descarga tanto `inventory-*.sqlite3` como `media-*.zip` a un medio independiente y elimina copias antiguas del alojamiento si el espacio escasea.

Para restaurar: detén o deshabilita la web app; conserva una copia del estado actual; copia el archivo SQLite respaldado a la ruta configurada; extrae las fotos en el directorio `media`; ejecuta `PRAGMA integrity_check` y `python -m alembic upgrade head` si el código es posterior al respaldo; recarga la web app y comprueba acceso, inventario y una foto. Nunca copies un archivo SQLite activo mediante `cp` como método de respaldo: el comando CLI usa la API de respaldo consistente de SQLite.

En el alojamiento gratuito, revisa cada semana CPU, espacio y errores; **renueva mensualmente** la web app según las condiciones vigentes de PythonAnywhere. La carga real de cinco usuarios debe probarse antes de uso operativo; si aparecen bloqueos de escritura o los límites del alojamiento se vuelven insuficientes, migra a un plan y motor de base adecuados.

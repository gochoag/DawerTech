# Despliegue y operación

## Antes de publicar

Necesitas una cuenta de PythonAnywhere y un proyecto de Cloudflare Pages. Define un dominio real para la API y la web. La API y el APK requieren HTTPS. Mantén fuera del repositorio la clave JWT, la base, las imágenes, los respaldos y el keystore Android.

## PythonAnywhere

1. Sube el proyecto al espacio de tu cuenta. Crea un entorno virtual Python 3.12 e instala `backend/` con `pip install -e .` desde esa carpeta.
2. Crea `/home/TU_USUARIO/dawertech-data/media` y una clave privada en `/home/TU_USUARIO/.dawertech-secret` (al menos 32 bytes aleatorios). Por ejemplo, en Bash: `python -c 'import secrets; print(secrets.token_urlsafe(48))' > ~/.dawertech-secret` y luego `chmod 600 ~/.dawertech-secret`.
3. En la consola Bash del servidor, desde `backend/`, exporta `DAWERTECH_DATABASE_URL=sqlite:////home/TU_USUARIO/dawertech-data/inventory.sqlite3`, `DAWERTECH_MEDIA_DIR=/home/TU_USUARIO/dawertech-data/media`, `DAWERTECH_SECRET_KEY="$(cat ~/.dawertech-secret)"` y `FLASK_APP=dawertech`. Ejecuta `python -m alembic upgrade head`; después `flask cargar-celulares` y `flask crear-admin`. El propietario se crea una sola vez.
4. Crea una web app manual con Flask/WSGI. Configura el virtualenv y copia el ejemplo [`pythonanywhere-wsgi.py`](pythonanywhere-wsgi.py) al archivo WSGI de PythonAnywhere. Sustituye `TU_USUARIO` y el origen exacto de Cloudflare Pages. Recarga la web app.
5. Verifica `https://TU_USUARIO.pythonanywhere.com/health` y entra desde la web. El endpoint de salud solo confirma que Flask responde; inicia sesión para verificar base y permisos.

En las actualizaciones: realiza un respaldo, sube código, instala dependencias, ejecuta `python -m alembic upgrade head`, comprueba el seed si cambió el catálogo y recarga la app. No sustituyas la base SQLite por el repositorio.

## Cloudflare Pages

Configura el directorio raíz como `frontend`, el comando de compilación `pnpm install && pnpm run build` y el directorio de salida `www/browser`. Define la variable de compilación `DAWERTECH_API_URL=https://TU_USUARIO.pythonanywhere.com/api/v1`. Agrega el origen HTTPS exacto de Pages a `DAWERTECH_CORS_ORIGINS` en PythonAnywhere; para Android incluye también `https://localhost`. Recompila la web cuando cambie la URL API. Las rutas internas se resuelven con el fallback SPA de Pages.

## Android y APK firmado

Desde `frontend`, ejecuta `pnpm install`, `pnpm run build:android` y genera los iconos con `scripts/generate-android-icons.ps1` si cambias el logo. En Android Studio abre `frontend/android`. El ID es `com.dawertech.inventory`; incrementa `versionCode` y `versionName` en `android/app/build.gradle` en cada actualización.

Para un APK de instalación directa, ejecuta una sola vez `scripts/prepare-release-signing.ps1` en PowerShell. Crea un keystore y `android/key.properties`, ambos ignorados por Git. **Respalda ambos archivos fuera del equipo antes de distribuir el APK**: las actualizaciones deben firmarse con la misma clave. Después, desde `frontend/android`, ejecuta `./gradlew assembleRelease` (Windows: `.\gradlew.bat assembleRelease`). El APK firmado queda en `android/app/build/outputs/apk/release`. También puedes usar Android Studio y el mismo keystore.

Al primer ingreso en Android escribe `https://TU_USUARIO.pythonanywhere.com/api/v1`, correo y contraseña. La URL se conserva localmente; el token de renovación se guarda mediante Android Keystore al activar biometría. Comprueba el desbloqueo en un Android físico antes de distribuir el APK.

## Respaldo y restauración

Haz una copia **diaria manual fuera de PythonAnywhere**, y otra antes de cada migración. En el servidor ejecuta `flask respaldar /home/TU_USUARIO/backups` con las variables de entorno configuradas. Descarga tanto `inventory-*.sqlite3` como `media-*.zip` a un medio independiente y elimina copias antiguas del alojamiento si el espacio escasea.

Para restaurar: detén o deshabilita la web app; conserva una copia del estado actual; copia el archivo SQLite respaldado a la ruta configurada; extrae las fotos en el directorio `media`; ejecuta `PRAGMA integrity_check` y `python -m alembic upgrade head` si el código es posterior al respaldo; recarga la web app y comprueba acceso, inventario y una foto. Nunca copies un archivo SQLite activo mediante `cp` como método de respaldo: el comando CLI usa la API de respaldo consistente de SQLite.

En el alojamiento gratuito, revisa cada semana CPU, espacio y errores; **renueva mensualmente** la web app según las condiciones vigentes de PythonAnywhere. La carga real de cinco usuarios debe probarse antes de uso operativo; si aparecen bloqueos de escritura o los límites del alojamiento se vuelven insuficientes, migra a un plan y motor de base adecuados.

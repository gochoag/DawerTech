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

Para la cuenta `holorey123`, después del `git push` local, abre una consola Bash de PythonAnywhere. Si solo cambió el frontend, no necesitas actualizar PythonAnywhere. Si cambió el backend:

```bash
source /home/holorey123/.virtualenvs/dawertech/bin/activate
cd /home/holorey123/DawerTech/backend
flask respaldar /home/holorey123/backups
git pull --ff-only origin main
pip install -e .
python -m alembic upgrade head
```

Después abre **Web > holorey123.pythonanywhere.com > Reload**. No vuelvas a crear el administrador ni borres o reemplaces la base. La instalación de dependencias puede omitirse cuando no cambió `backend/pyproject.toml`; `alembic upgrade head` no repite migraciones ya aplicadas. Descarga los respaldos y administra las copias antiguas para no llenar los 512 MiB del plan gratuito. El despliegue del backend sigue siendo manual; los workflows siguientes automatizan la web y el APK.

## Cloudflare Pages

Para publicar en una cuenta de Cloudflare distinta de la vinculada a GitHub, usa Direct Upload con el workflow [pages-deployment.yml](../.github/workflows/pages-deployment.yml). El token identifica la cuenta de destino; no requiere instalar la aplicación de Cloudflare en GitHub.

En GitHub, abre **Settings > Secrets and variables > Actions**. Crea los secretos `CLOUDFLARE_API_TOKEN` (permiso **Account > Cloudflare Pages > Edit**, limitado a la cuenta de destino) y `CLOUDFLARE_ACCOUNT_ID`. En **Variables**, configura `DAWERTECH_API_URL` con la URL HTTPS de la API terminada en `/api/v1`. Puedes definir `CLOUDFLARE_PAGES_PROJECT`; si se omite, se usa `dawertech`. La primera publicación requiere que el código local esté subido a GitHub.

Si aún no existe el proyecto Pages, sube el primer commit del workflow con `[skip ci]` en el mensaje. Después abre **Actions > Publicar frontend en Cloudflare Pages > Run workflow**, selecciona `main` y marca **Crear el proyecto Pages**. Esto crea el proyecto y publica `frontend/www/browser`. En ejecuciones posteriores deja esa opción desmarcada. Si el proyecto ya existe, omite su creación. Si la creación tuvo éxito pero la publicación falló, reintenta sin marcar la creación.

El workflow compila con Node.js 26 e instala pnpm 11.13.1 directamente con npm, usa el lockfile y rechaza una API ausente o sin HTTPS. Los pasos de Cloudflare usan explícitamente npm para instalar y ejecutar Wrangler 4.149.0; así la detección del gestor del frontend no afecta la instalación de la herramienta de despliegue. Los siguientes pushes a `main` que modifiquen el frontend, las funciones de Pages o el workflow publican automáticamente. Los cambios exclusivos del backend requieren actualizar y recargar PythonAnywhere por separado.

Toma el dominio real que Cloudflare muestra al publicar (puede incluir un sufijo si el nombre está ocupado). Agrégalo a `DAWERTECH_CORS_ORIGINS` en el `.env` del backend y recarga PythonAnywhere. Por ejemplo: `DAWERTECH_CORS_ORIGINS=https://dawertech.pages.dev,https://localhost`. Si el WSGI establece esta variable directamente, actualiza allí su valor: una variable del proceso tiene prioridad sobre `.env`. Verifica el inicio de sesión, el inventario vacío y el catálogo de celulares desde Pages; `/health` por sí solo no verifica estos flujos.

Documentación oficial: [Direct Upload con GitHub Actions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) y [crear un proyecto Pages con Wrangler](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Si prefieres la integración nativa de Pages con GitHub en una cuenta compatible:

Configura el directorio raíz como `frontend`, el comando de compilación `pnpm install && pnpm run build` y el directorio de salida `www/browser`. Define la variable de compilación `DAWERTECH_API_URL=https://TU_USUARIO.pythonanywhere.com/api/v1`. Agrega el origen HTTPS exacto de Pages a `DAWERTECH_CORS_ORIGINS` en PythonAnywhere; para Android incluye también `https://localhost`. Recompila la web cuando cambie la URL API. Las rutas internas se resuelven con el fallback SPA de Pages.

## Android y APK firmado

El login y el sidebar de la web descargan con progreso mediante `DAWERTECH_APK_WEB_DOWNLOAD_URL`; `DAWERTECH_APK_DOWNLOAD_URL` configura el enlace alternativo. El APK consulta `DAWERTECH_RELEASE_API_URL`, sin credenciales del inventario, para ofrecer nuevas versiones y descargar el archivo publicado. Los valores predeterminados apuntan a GitHub Releases de `gochoag/DawerTech`; los binarios se guardan en GitHub y no consumen almacenamiento de PythonAnywhere. Puedes cambiar estas variables públicas en el entorno del frontend y en las variables de GitHub Actions.

El workflow [`android-release.yml`](../.github/workflows/android-release.yml) genera, firma y publica un APK automáticamente con cada push a `main` que cambie el frontend, el propio workflow o las notas Android. Los cambios exclusivos de pruebas, documentación del frontend o `.gitignore` no generan APK. Compila el `main` más reciente y omite la publicación si ese mismo commit ya tiene un APK completo publicado; reintentar un workflow antiguo no publica código anterior.

La versión inicial se define en [`frontend/app-release.json`](../frontend/app-release.json). En el runner, el workflow aumenta automáticamente `versionCode` por encima de todos los tags Android existentes y aumenta el último número de `version`, por ejemplo `1.1.0` → `1.1.1`. Gradle y los assets reciben exactamente esos valores. No tienes que modificar la versión para cada cambio: el archivo del repositorio conserva la base. Si quieres lanzar una versión mayor o menor, coloca una versión superior, por ejemplo `2.0.0`, en ese archivo. Puedes actualizar [`android-release-notes.md`](android-release-notes.md) para explicar los cambios.

La publicación crea el tag `android-vVERSION_CODE`, el título `DawerTech VERSION` y el archivo `dawertech-release.apk`. Primero sube el archivo a una release en borrador; solo después la publica como la última. Un intento incompleto reserva su código y el siguiente intento usa uno nuevo.

El SDK se prepara con `android-actions/setup-android@v4.0.4`, command-line tools `15859902` y el paquete explícito `platform-tools`; después se instalan Android API 36 y build-tools 36.0.0. No uses el antiguo paquete `tools`: Google lo retiró y la configuración predeterminada de `setup-android@v3` falla al intentar instalarlo. Después de corregir un workflow, haz commit y push para ejecutar su nueva configuración; **Re-run jobs** sobre la ejecución antigua conserva el workflow del commit anterior. También puedes usar **Run workflow > main** tras subir el cambio. [Documentación de setup-android](https://github.com/android-actions/setup-android#the-deprecated-tools-package).

Configura una sola vez estos cuatro secretos en **GitHub > Settings > Secrets and variables > Actions > New repository secret**, antes de hacer el push que activa la automatización:

| Secreto | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | El mismo keystore existente, convertido a Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` de `frontend/android/key.properties` |
| `ANDROID_KEY_ALIAS` | `keyAlias` del mismo archivo |
| `ANDROID_KEY_PASSWORD` | `keyPassword` del mismo archivo |

El campo `storeFile` indica el keystore, con ruta relativa a `frontend/android`. Para la clave ya creada en este equipo, desde la raíz del proyecto, copia su Base64 al portapapeles con PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath 'frontend/android/signing/dawertech-release.jks').Path)) | Set-Clipboard
```

Pega el resultado directamente en `ANDROID_KEYSTORE_BASE64`. Copia los otros tres valores desde `frontend/android/key.properties` a sus secretos correspondientes. Mantén la variable de Actions `DAWERTECH_API_URL=https://holorey123.pythonanywhere.com/api/v1`; el APK y la web usarán esa API. No hace falta otro token de GitHub: el workflow utiliza `GITHUB_TOKEN` con permiso `contents: write`. Reutiliza la misma clave en todas las versiones y conserva un respaldo del keystore y de `key.properties` fuera del equipo.

Después guarda los cambios, haz commit y push a `main`. En **Actions > Publicar APK Android** puedes seguir la compilación. No tienes que compilar ni adjuntar el archivo desde tu PC, ni publicar la primera release manualmente. Si configuraste los secretos después del push o necesitas reintentar, usa **Run workflow > main**. También puedes publicar manualmente un APK local, pero debes usar un código superior al último tag Android, la misma firma y el nombre de archivo `dawertech-release.apk`.

El APK compara el código publicado con `App.getInfo()`, comprueba al abrirse, al retomar y periódicamente mientras está activo, y limita las consultas a una cada 6 horas. **Más tarde** oculta el aviso de esa versión durante 24 horas. El menú permite comprobar manualmente. Un cambio del frontend empaquetado requiere un APK nuevo; publicar la web no reemplaza los archivos de una app ya instalada.

Dentro del APK, **Actualizar** usa el gestor de descargas de Android y muestra porcentaje, bytes y una barra. Puedes cancelar y la transferencia puede continuar en segundo plano. Al completarse, la app comprueba tamaño, SHA-256 cuando GitHub lo proporciona, paquete, versión y firma; después abre el instalador cuando DawerTech está en primer plano. La primera vez Android requiere permitir **Instalar aplicaciones desconocidas** desde DawerTech. Al regresar de esos ajustes, se abre el instalador si otorgaste el permiso. Si cancelas la instalación, puedes volver a pulsar **Instalar APK** sin descargar de nuevo. La app guarda únicamente el estado de esa descarga en preferencias separadas de la sesión y elimina su APK temporal tras reconocer la versión instalada.

En el login y sidebar de la web, la descarga muestra progreso y cancelación antes de entregar `dawertech-release.apk` al navegador. El navegador controla el archivo guardado; desde una web no se puede abrir directamente el instalador de Android. En Android, abre el archivo desde las descargas del navegador y confirma su instalación. La función [`functions/download-apk.js`](../functions/download-apk.js) transmite el APK público de GitHub a través de Pages, sin almacenarlo ni usar PythonAnywhere. Wrangler la incluye al ejecutar el despliegue desde la raíz del repositorio. Solo acepta códigos Android válidos y archivos públicos del repositorio configurado. Si cambias el repositorio, configura la variable pública `DAWERTECH_APK_REPOSITORY` en Cloudflare Pages; por defecto usa `gochoag/DawerTech`.

`DAWERTECH_APK_WEB_DOWNLOAD_URL` permite cambiar la URL pública de ese proxy en el frontend y Actions; vacío usa `/download-apk` en el mismo sitio. Para probar desde localhost después de publicar la función, puedes definir `DAWERTECH_APK_WEB_DOWNLOAD_URL=https://dawertech.pages.dev/download-apk` y reiniciar el frontend. La descarga alternativa sigue apuntando al APK público en GitHub si no se puede completar la transferencia con progreso.

La primera actualización desde un APK anterior a esta mejora seguirá abriendo el navegador: instala esa release mediante el flujo anterior y las siguientes ya usarán la descarga integrada. La actualización de una release con la misma firma conserva los datos. El comprobador y el instalador no eliminan ni renuevan las credenciales de la sesión. Un cambio del backend local a PythonAnywhere requiere iniciar sesión una vez con la cuenta del servidor nuevo.

Desde `frontend`, ejecuta `pnpm install`, `pnpm run build:android` y genera los iconos con `scripts/generate-android-icons.ps1` si cambias el logo. En Android Studio abre `frontend/android`. El ID es `com.dawertech.inventory`; para una publicación manual modifica la versión en `frontend/app-release.json`, que también utiliza Gradle.

Para un APK de instalación directa, ejecuta una sola vez `scripts/prepare-release-signing.ps1` en PowerShell. Crea un keystore y `android/key.properties`, ambos ignorados por Git. **Respalda ambos archivos fuera del equipo antes de distribuir el APK**: las actualizaciones deben firmarse con la misma clave. Después, desde `frontend/android`, ejecuta `./gradlew assembleRelease` (Windows: `.\gradlew.bat assembleRelease`). El APK firmado queda en `android/app/build/outputs/apk/release`. También puedes usar Android Studio y el mismo keystore.

Para el taller, `pnpm run android:generate` detecta la IP local del PC y genera el APK en `frontend/apk-release/dawertech-release.apk`. Arranca el backend con `uv run flask run` desde `backend`; `.flaskenv` configura `0.0.0.0:5000`. El celular debe estar en la misma red y el firewall debe permitir este puerto en la red privada. Si la detección encuentra más de una interfaz física, define `DAWERTECH_ANDROID_API_URL=http://IP_DEL_PC:5000/api/v1` en `frontend/.env`. Para Internet, define `DAWERTECH_API_URL` y `DAWERTECH_ANDROID_API_URL` con `https://TU_USUARIO.pythonanywhere.com/api/v1` en el archivo de entorno antes de compilar. Puedes separar entornos usando `DAWERTECH_ENV_FILE=.env.production`. Solo estas URLs públicas se incluyen en los assets; no pongas claves ni contraseñas en las variables del frontend.

Al primer ingreso en Android usa correo y contraseña. La sesión se guarda siempre mediante Android Keystore. Si Android tiene huella, rostro o PIN disponible, la protección se activa automáticamente al ingresar y no solicita desbloqueo en ese momento: lo pedirá después de 7 días completos de inactividad. En **Mi cuenta** puedes desactivarla; la preferencia se conserva para esa cuenta y servidor en ese celular, incluso al cerrar sesión e ingresar de nuevo. Sin bloqueo del dispositivo disponible, el ingreso con credenciales sigue funcionando. Las sesiones guardadas de versiones anteriores conservan su configuración; la activación automática se aplica al nuevo ingreso con credenciales. Una apertura reciente no solicita desbloqueo. El botón Atrás confirma la salida de la app y conserva la sesión; **Cerrar sesión** confirma la eliminación del acceso guardado y obliga a volver a usar correo y contraseña. La sesión recordada de Android no caduca por fecha; sigue sujeta a revocación por cierre de sesión, cambio de contraseña o desactivación de la cuenta. La web mantiene una renovación de 365 días. Comprueba el desbloqueo y el botón Atrás en un Android físico antes de distribuir el APK.

Si cambias la IP del PC, actualiza `DAWERTECH_ANDROID_API_URL` en `frontend/.env` y vuelve a ejecutar `pn android:dev`. Para evitar cambios, configura una reserva DHCP en el router. Los iconos adaptativos usan `dt-app-foreground.svg` con margen para las máscaras de Android; `dt-mark.svg` sigue siendo el logo de la interfaz.

## Respaldo y restauración

Las fotos se optimizan en el navegador antes del envío y en el servidor al guardarse. El servidor aplica orientación EXIF, elimina metadatos, conserva transparencia y guarda WebP con hasta 1200 px de lado y un máximo de 250 KiB. Usa un nivel de compresión con menor coste de CPU y reduce dimensiones si la imagen supera ese tamaño. La cuota incluye todas las fotos existentes y el nuevo archivo; se configura con `DAWERTECH_MEDIA_QUOTA_MB=100` en el `.env` del backend. Las fotos reemplazadas se eliminan después de confirmar el cambio de registro.

Para consultar el uso, ejecuta `flask estado-almacenamiento`. `flask limpiar-imagenes` revisa WebP sin referencia en repuestos o celulares y con más de 24 horas; no borra nada por defecto. Después de respaldar, `flask limpiar-imagenes --aplicar` elimina esas fotos huérfanas. Las imágenes previas conservan sus archivos; la optimización nueva se aplica a las siguientes subidas. Al desplegar este cambio ejecuta `git pull --ff-only` en PythonAnywhere desde `~/DawerTech` y recarga la web; no necesita migración de esquema.

Haz una copia **diaria manual fuera de PythonAnywhere**, y otra antes de cada migración. En el servidor ejecuta `flask respaldar /home/TU_USUARIO/backups` con las variables de entorno configuradas. Descarga tanto `inventory-*.sqlite3` como `media-*.zip` a un medio independiente y elimina copias antiguas del alojamiento si el espacio escasea.

Para restaurar: detén o deshabilita la web app; conserva una copia del estado actual; copia el archivo SQLite respaldado a la ruta configurada; extrae las fotos en el directorio `media`; ejecuta `PRAGMA integrity_check` y `python -m alembic upgrade head` si el código es posterior al respaldo; recarga la web app y comprueba acceso, inventario y una foto. Nunca copies un archivo SQLite activo mediante `cp` como método de respaldo: el comando CLI usa la API de respaldo consistente de SQLite.

En el alojamiento gratuito, revisa cada semana CPU, espacio y errores; **renueva mensualmente** la web app según las condiciones vigentes de PythonAnywhere. La carga real de cinco usuarios debe probarse antes de uso operativo; si aparecen bloqueos de escritura o los límites del alojamiento se vuelven insuficientes, migra a un plan y motor de base adecuados.

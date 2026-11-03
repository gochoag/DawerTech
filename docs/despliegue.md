# Despliegue y operación

## Dónde corre

| Pieza | Dónde | URL |
|---|---|---|
| Web | VPS compartido (nginx sirve los estáticos) | `https://dawer.cfd` |
| API | VPS, contenedor Docker con gunicorn | `https://api.dawer.cfd/api/v1` |
| Base de datos | PostgreSQL compartido del VPS, base `dawertechbd` | solo dentro del VPS |
| APK | GitHub Releases (`android-v<código>`) | se descarga desde la app o la web |

Todo el tráfico pasa por Cloudflare. Detalles y razones: [D-005](decisiones.md). Preparación del proyecto: [vps/02-preparar-dawertech.md](vps/02-preparar-dawertech.md); alta y paso desde PythonAnywhere: [vps/03-subir-dawertech.md](vps/03-subir-dawertech.md). La configuración del servidor y las emergencias están en el repo privado `JuanRZAR/vps-tecnomovil-admin` (solo admins). Mantén fuera del repositorio la clave JWT, la base, las imágenes, los respaldos y el keystore Android.

## Publicar un cambio

1. Rama y PR a `main`. El workflow [`deploy.yml`](../.github/workflows/deploy.yml) ejecuta las reglas del proyecto, las pruebas del backend (incluido `test_api.py` sobre un PostgreSQL desechable), las del frontend, la compilación de la web y, en el flujo compartido del VPS, el build de la imagen, el escaneo de vulnerabilidades, `vps-check` y una prueba de consumo. Nada se despliega en un PR.
2. Merge a `main`: lo mismo, más el despliegue sin cortes (la versión nueva arranca junto a la anterior y solo recibe tráfico cuando `/health` responde). Antes de migrar la base, el VPS guarda un volcado. Si algo falla, la versión anterior sigue sirviendo y llega un aviso al grupo de Telegram.
3. Las migraciones deben funcionar con la versión anterior durante unos segundos (añadir columnas que admitan nulos, renombrar en dos despliegues; ver la guía de `infra-vps-tecnomovil`, 2.8).

Los cambios que solo tocan `docs/` o archivos `.md` no despliegan. Para volver a desplegar `main` (por ejemplo, tras cambiar una variable del `.env` del VPS): **Actions > Desplegar > Run workflow**. Volver a la versión anterior: en el VPS, `vps-rollback dawertech`. Ver logs: `vps-logs dawertech`. Estado y consumo: `sudo vps-status`.

Para probar en tu PC la misma imagen que irá al VPS: [`deploy/deploy-dev`](../deploy/deploy-dev/compose.yml) (D-006).

## Android y APK firmado

El login y el sidebar de la web descargan con progreso mediante `DAWERTECH_APK_WEB_DOWNLOAD_URL`; `DAWERTECH_APK_DOWNLOAD_URL` configura el enlace alternativo. El APK consulta `DAWERTECH_RELEASE_API_URL`, sin credenciales del inventario, para ofrecer nuevas versiones y descargar el archivo publicado. Los valores predeterminados apuntan a GitHub Releases de `gochoag/DawerTech`; los binarios se guardan en GitHub, no en el VPS. Puedes cambiar estas variables públicas en el entorno del frontend y en las variables de GitHub Actions.

El workflow [`android-release.yml`](../.github/workflows/android-release.yml) genera, firma y publica un APK automáticamente con cada push a `main` que cambie el frontend, el propio workflow o las notas Android. Los cambios exclusivos de pruebas, documentación del frontend o `.gitignore` no generan APK. Compila el `main` más reciente y omite la publicación si ese mismo commit ya tiene un APK completo publicado; reintentar un workflow antiguo no publica código anterior.

La versión inicial se define en [`frontend/app-release.json`](../frontend/app-release.json). En el runner, el workflow aumenta automáticamente `versionCode` por encima de todos los tags Android existentes y aumenta el último número de `version`, por ejemplo `1.1.0` → `1.1.1`. Gradle y los assets reciben exactamente esos valores. No tienes que modificar la versión para cada cambio: el archivo del repositorio conserva la base. Si quieres lanzar una versión mayor o menor, coloca una versión superior, por ejemplo `2.0.0`, en ese archivo. Puedes actualizar [`android-release-notes.md`](android-release-notes.md) para explicar los cambios.

La publicación crea el tag `android-vVERSION_CODE`, el título `DawerTech VERSION` y el archivo `dawertech-release.apk`. Primero sube el archivo a una release en borrador; solo después la publica como la última. Un intento incompleto reserva su código y el siguiente intento usa uno nuevo.

El SDK se prepara con `android-actions/setup-android@v4.0.4`, command-line tools `15859902` y el paquete explícito `platform-tools`; después se instalan Android API 36 y build-tools 36.0.0. No uses el antiguo paquete `tools`: Google lo retiró y la configuración predeterminada de `setup-android@v3` falla al intentar instalarlo. Después de corregir un workflow, haz commit y push para ejecutar su nueva configuración; **Re-run jobs** sobre la ejecución antigua conserva el workflow del commit anterior. También puedes usar **Run workflow > main** tras subir el cambio. [Documentación de setup-android](https://github.com/android-actions/setup-android#the-deprecated-tools-package).

Configura una sola vez estos cuatro secretos en **GitHub > Settings > Secrets and variables > Actions > New repository secret**:

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

Pega el resultado directamente en `ANDROID_KEYSTORE_BASE64`. Copia los otros tres valores desde `frontend/android/key.properties` a sus secretos correspondientes. La variable de Actions `DAWERTECH_API_URL` debe ser `https://api.dawer.cfd/api/v1`: es la API que se incorpora al APK. No hace falta otro token de GitHub: el workflow utiliza `GITHUB_TOKEN` con permiso `contents: write`. Reutiliza la misma clave en todas las versiones y conserva un respaldo del keystore y de `key.properties` fuera del equipo.

En **Actions > Publicar APK Android** puedes seguir la compilación. No tienes que compilar ni adjuntar el archivo desde tu PC. Si necesitas reintentar, usa **Run workflow > main**. También puedes publicar manualmente un APK local, pero debes usar un código superior al último tag Android, la misma firma y el nombre de archivo `dawertech-release.apk`.

El APK compara el código publicado con `App.getInfo()`, comprueba al abrirse, al retomar y periódicamente mientras está activo, y limita las consultas a una cada 6 horas. **Más tarde** oculta el aviso de esa versión durante 24 horas. El menú permite comprobar manualmente. Un cambio del frontend empaquetado requiere un APK nuevo; publicar la web no reemplaza los archivos de una app ya instalada. La comprobación y la descarga hablan con GitHub, no con la API: un APK que apunte a un servidor caído sigue encontrando y descargando la versión nueva.

Dentro del APK, **Actualizar** usa el gestor de descargas de Android y muestra porcentaje, bytes y una barra. Puedes cancelar y la transferencia puede continuar en segundo plano. Al completarse, la app comprueba tamaño, SHA-256 cuando GitHub lo proporciona, paquete, versión y firma; después abre el instalador cuando DawerTech está en primer plano. La primera vez Android requiere permitir **Instalar aplicaciones desconocidas** desde DawerTech. Al regresar de esos ajustes, se abre el instalador si otorgaste el permiso. Si cancelas la instalación, puedes volver a pulsar **Instalar APK** sin descargar de nuevo. La app guarda únicamente el estado de esa descarga en preferencias separadas de la sesión y elimina su APK temporal tras reconocer la versión instalada.

En el login y sidebar de la web, la descarga muestra progreso y cancelación antes de entregar `dawertech-release.apk` al navegador. El navegador controla el archivo guardado; desde una web no se puede abrir directamente el instalador de Android. En Android, abre el archivo desde las descargas del navegador y confirma su instalación. La ruta `GET /download-apk?code=<código>` de la API ([`apk_download.py`](../backend/dawertech/shared/presentation/apk_download.py)) transmite el APK público de GitHub sin guardarlo; en el VPS, nginx la publica en el mismo dominio de la web (`https://dawer.cfd/download-apk`). Solo acepta códigos Android válidos y archivos públicos del repositorio configurado en `DAWERTECH_APK_REPOSITORY` (por defecto `gochoag/DawerTech`).

`DAWERTECH_APK_WEB_DOWNLOAD_URL` permite cambiar esa URL en el frontend y Actions; vacío usa `/download-apk` en el mismo sitio. Para probar desde localhost puedes definir `DAWERTECH_APK_WEB_DOWNLOAD_URL=https://dawer.cfd/download-apk` y reiniciar el frontend. La descarga alternativa sigue apuntando al APK público en GitHub si no se puede completar la transferencia con progreso.

La actualización de una release con la misma firma conserva los datos. El comprobador y el instalador no eliminan ni renuevan las credenciales de la sesión. Pasar a un servidor nuevo (otra URL de API) requiere iniciar sesión una vez con la cuenta de ese servidor.

Si una release anterior muestra **Los datos de la actualizacion no son validos** antes de descargar, instala esta corrección desde **Descargar APK** en la web, sobre la app existente, sin desinstalarla. El fallo se debía a leer el tamaño JSON como `Long` cuando Capacitor lo recibe como `Integer`; la lectura corregida conserva los bytes. El workflow ejecuta la regresión Java antes de publicar. Los fallos nativos nuevos registran un código sin credenciales ni datos de sesión, consultable con `adb logcat -d -s DawerTechUpdates:W '*:S'`, como `APK_INVALID_SIZE`, `APK_INVALID_DIGEST`, `APK_INVALID_URL` o `APK_NOT_NEWER`.

Desde `frontend`, ejecuta `pnpm install`, `pnpm run build:android` y genera los iconos con `scripts/generate-android-icons.ps1` si cambias el logo. En Android Studio abre `frontend/android`. El ID es `com.dawertech.inventory`; para una publicación manual modifica la versión en `frontend/app-release.json`, que también utiliza Gradle.

Para un APK de instalación directa, ejecuta una sola vez `scripts/prepare-release-signing.ps1` en PowerShell. Crea un keystore y `android/key.properties`, ambos ignorados por Git. **Respalda ambos archivos fuera del equipo antes de distribuir el APK**: las actualizaciones deben firmarse con la misma clave. Después, desde `frontend/android`, ejecuta `./gradlew assembleRelease` (Windows: `.\gradlew.bat assembleRelease`). El APK firmado queda en `android/app/build/outputs/apk/release`. También puedes usar Android Studio y el mismo keystore.

Para el taller, `pnpm run android:generate` detecta la IP local del PC y genera el APK en `frontend/apk-release/dawertech-release.apk`. Arranca el backend con `uv run flask run` desde `backend`; `.flaskenv` configura `0.0.0.0:5000`. El celular debe estar en la misma red y el firewall debe permitir este puerto en la red privada. Si la detección encuentra más de una interfaz física, define `DAWERTECH_ANDROID_API_URL=http://IP_DEL_PC:5000/api/v1` en `frontend/.env`. Para Internet, define `DAWERTECH_API_URL` y `DAWERTECH_ANDROID_API_URL` con `https://api.dawer.cfd/api/v1` en el archivo de entorno antes de compilar. Puedes separar entornos usando `DAWERTECH_ENV_FILE=.env.production`. Solo estas URLs públicas se incluyen en los assets; no pongas claves ni contraseñas en las variables del frontend.

Al primer ingreso en Android usa correo y contraseña. La sesión se guarda siempre mediante Android Keystore. Si Android tiene huella, rostro o PIN disponible, la protección se activa automáticamente al ingresar y no solicita desbloqueo en ese momento: lo pedirá después de 7 días completos de inactividad. En **Mi cuenta** puedes desactivarla; la preferencia se conserva para esa cuenta y servidor en ese celular, incluso al cerrar sesión e ingresar de nuevo. Sin bloqueo del dispositivo disponible, el ingreso con credenciales sigue funcionando. Las sesiones guardadas de versiones anteriores conservan su configuración; la activación automática se aplica al nuevo ingreso con credenciales. Una apertura reciente no solicita desbloqueo. El botón Atrás confirma la salida de la app y conserva la sesión; **Cerrar sesión** confirma la eliminación del acceso guardado y obliga a volver a usar correo y contraseña. La sesión recordada de Android no caduca por fecha; sigue sujeta a revocación por cierre de sesión, cambio de contraseña o desactivación de la cuenta. La web mantiene una renovación de 365 días. Comprueba el desbloqueo y el botón Atrás en un Android físico antes de distribuir el APK.

Si cambias la IP del PC, actualiza `DAWERTECH_ANDROID_API_URL` en `frontend/.env` y vuelve a ejecutar `pn android:dev`. Para evitar cambios, configura una reserva DHCP en el router. Los iconos adaptativos usan `dt-app-foreground.svg` con margen para las máscaras de Android; `dt-mark.svg` sigue siendo el logo de la interfaz.

## Fotos, respaldos y restauración

Las fotos se optimizan en el navegador antes del envío y en el servidor al guardarse. El servidor aplica orientación EXIF, elimina metadatos, conserva transparencia y guarda WebP con hasta 1200 px de lado y un máximo de 250 KiB. Usa un nivel de compresión con menor coste de CPU y reduce dimensiones si la imagen supera ese tamaño. La cuota incluye todas las fotos existentes y el nuevo archivo; se configura con `DAWERTECH_MEDIA_QUOTA_MB=100` en el `.env` del backend. Las fotos reemplazadas se eliminan después de confirmar el cambio de registro. Para consultar el uso, ejecuta `flask estado-almacenamiento`. `flask limpiar-imagenes` revisa WebP sin referencia en repuestos o celulares y con más de 24 horas; no borra nada por defecto. Después de respaldar, `flask limpiar-imagenes --aplicar` elimina esas fotos huérfanas.

En el VPS, los respaldos son automáticos: un volcado diario de `dawertechbd` en `/srv/backups/dawertech/` (7 días), otro antes de cada migración y los snapshots de Hostinger. Las fotos están en `/srv/apps/dawertech/data/media/`. Para una copia fuera del VPS, descarga esos archivos con WinSCP. La restauración (`pg_restore`) está en la guía de emergencias del repo de administración.

En el PC, `flask respaldar <carpeta>` guarda un volcado de `dawer-bd` (`pg_dump`, formato custom) y un ZIP de las fotos; necesita la carpeta `bin` de PostgreSQL en el `PATH`.

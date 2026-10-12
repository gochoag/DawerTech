# DawerTech

Inventario para un taller de reparación de celulares: API Flask/SQLite, web Ionic Angular y app Android Capacitor. La primera versión permite hasta cinco cuentas activas y trabaja en línea con un solo local.

## Estructura

- `backend/`: API JSON `/api/v1`, migraciones Alembic, catálogo de celulares, CLI y pruebas.
- `frontend/`: interfaz Ionic Angular + Tailwind, recursos SVG y proyecto Android.
- `docs/`: plan, API y guía de despliegue/operación.

## Inicio local

Requiere Python 3.12, Node.js compatible con Angular 22, [uv](https://docs.astral.sh/uv/) y [pnpm](https://pnpm.io/). En PowerShell:

```powershell
cd backend
uv sync
Copy-Item .env.example .env
uv run alembic upgrade head
uv run flask cargar-celulares
uv run flask crear-admin
uv run flask run --debug
```

> **Sobre la configuración y comandos**:
> - Las variables se configuran en `backend/.env` (creado a partir de `.env.example`). Si no existe `.env`, la aplicación y las migraciones te pedirán crearlo antes de continuar.
> - La aplicación Flask se detecta automáticamente (mediante `.flaskenv`), por lo que no necesitas indicar el nombre de la app ni variables adicionales en la consola.
> - `crear-admin` crea el administrador inicial pidiendo correo, nombre y contraseña en la terminal.
> - `cambiar-clave` permite restablecer la contraseña del administrador.
> - `cargar-celulares` carga o actualiza el catálogo de celulares base.
> - `respaldar` genera una copia de seguridad de la base de datos y fotos (`uv run flask respaldar`).
> - En ejecuciones posteriores, solo necesitas ejecutar `uv run flask run --debug` (o `uv run flask run`) para iniciar el servidor.


En otra terminal:

```powershell
cd frontend
pnpm install
Copy-Item .env.example .env
pnpm start
```

Abre `http://localhost:4200`. Flask escucha en `0.0.0.0:5000` y el frontend en `0.0.0.0:4200`, por lo que también puedes abrir `http://IP_DEL_PC:4200` desde la misma red. La web se conecta al backend del equipo desde el que se sirve la página, en el puerto 5000. La configuración pública del frontend está en `frontend/.env`: `DAWERTECH_API_URL` para la web y `DAWERTECH_ANDROID_API_URL` para el APK. Si las dejas vacías, se usa el backend local automáticamente. Puedes seleccionar otro archivo con `DAWERTECH_ENV_FILE=.env.production`; las variables de la terminal o del alojamiento tienen prioridad. Reinicia ambos servidores después de actualizar su configuración.

## Comprobación

```powershell
cd backend
uv run pytest tests/test_session_policy.py -q
cd ..\frontend
pnpm run typecheck
pnpm run test:session
pnpm run build
```

Las comprobaciones anteriores de sesión no crean bases de datos ni levantan otro backend. Las pruebas de `test_api.py` crean bases temporales y no deben ejecutarse sobre este entorno de trabajo, que exige usar únicamente la base principal.

Para Android: `pnpm run android:generate` genera `frontend/apk-release/dawertech-release.apk`. La compilación detecta la IP del PC en la red local y la incorpora al APK; no requiere un túnel ADB para conectarse. Si tienes varias interfaces físicas, selecciona la correcta antes de compilar:

```powershell
# En frontend/.env: DAWERTECH_ANDROID_API_URL=http://192.168.100.49:5000/api/v1
pnpm run android:generate
```

El PC y el celular deben estar en la misma red y el firewall del PC debe permitir el puerto 5000 en la red privada. Si cambia la IP, modifica `DAWERTECH_ANDROID_API_URL` en `frontend/.env` y regenera el APK; utiliza una reserva DHCP para mantener estable la dirección del PC. Usa `pnpm run build:android` si solo necesitas compilar la web y sincronizar Android, o `pnpm run android:dev` para compilar e instalar por ADB.

La sesión web se conserva en el navegador y se renueva por 365 días. Android guarda siempre la sesión en almacenamiento seguro y la renueva sin caducidad por fecha. En **Mi cuenta** puedes activar la protección con la huella, rostro o PIN de bloqueo de Android, que se solicita después de 7 días sin usar la app. Salir con el botón Atrás conserva la sesión; **Cerrar sesión** elimina el acceso guardado y requiere nuevamente correo y contraseña. Cambiar la contraseña o desactivar una cuenta también revoca sus sesiones. La guía de firma y actualización está en [despliegue](docs/despliegue.md).

## Operación

Consulta [arquitectura](docs/arquitectura.md), [API](docs/api.md), [despliegue y respaldos](docs/despliegue.md) y [plan inicial](docs/plan-dawertech.md). No subas claves, bases de datos ni keystores al repositorio.

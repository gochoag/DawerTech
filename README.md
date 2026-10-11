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
pnpm start
```

Abre `http://localhost:4200`. La web usa `http://localhost:5000/api/v1` de forma predeterminada. Para otro servidor, establece `DAWERTECH_API_URL` antes de compilar o iniciar el frontend.

## Comprobación

```powershell
cd backend
uv run pytest -q
cd ..\frontend
pnpm run typecheck
pnpm run build
```

Para Android: `pnpm run build:android`; abre `frontend/android` en Android Studio o compila con Gradle. La pantalla de inicio permite indicar la URL HTTPS de la API terminada en `/api/v1`. La primera entrada usa contraseña; el desbloqueo biométrico es opcional. La guía completa de firma y actualización está en [despliegue](docs/despliegue.md).

## Operación

Consulta [arquitectura](docs/arquitectura.md), [API](docs/api.md), [despliegue y respaldos](docs/despliegue.md) y [plan inicial](docs/plan-dawertech.md). No subas claves, bases de datos ni keystores al repositorio.

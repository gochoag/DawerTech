# Antes de cualquier tarea (obligatorio)

1. Lee `PROJECT_MEMORY.md` completo (si el hook de inicio de sesión ya lo inyectó en tu contexto, no lo vuelvas a abrir) y `docs/decisiones.md`. En tu primera respuesta de la sesión, indica en una línea la fecha de «Estado actual» que leíste. Si `PROJECT_MEMORY.md` no existe, créalo con la plantilla de «Memoria y contexto».
2. Si la petición contradice una decisión registrada, avísalo y pregunta antes de cambiar nada.
3. Para ubicar código, consulta el mapa de `graphify-out/` antes de buscar o abrir archivos (ver «Mapa del código»).
4. Trabaja en modo Ponytail (ver «Ponytail»).

# Archivos de reglas

`CLAUDE.md` y `AGENTS.md` tienen el mismo contenido completo. Quien cambie uno copia el cambio al otro en el mismo cambio, aunque no sea de su herramienta. Si una herramienta (por ejemplo, el instalador de Graphify) escribe en uno de ellos, el cambio se revisa y se copia al otro. Las reglas solo se modifican cuando el usuario lo pide o aprueba una regla propuesta.

# Memoria y contexto

- `PROJECT_MEMORY.md` es la memoria de este equipo: está fuera de Git y la comparten los agentes que trabajan en esta máquina. Secciones: «El proyecto en breve», «Estado actual», «Decisiones vigentes», «Pendientes» y «Lecciones». En Claude Code, un hook `SessionStart` (`.claude/settings.json`) la inyecta al empezar cada sesión.
- **Al terminar** una tarea en la que cambió el estado, se tomó una decisión, queda algo pendiente o descubriste cómo funciona algo en esta máquina (servidores, puertos, Docker, rutas), actualízala:
  - reescribe «Estado actual», sin acumular;
  - añade decisiones con fecha y porqué;
  - marca o añade pendientes.
- Nunca credenciales. No copies lo que ya cuentan Git, el README o `docs/`: enlázalo. Una decisión que deba conocer todo el equipo va además a `docs/decisiones.md` (versionado), con el siguiente número.

# Mapa del código

- Usa `graphify-out/GRAPH_REPORT.md` para orientarte por subsistemas, y consultas sobre nombres concretos para el detalle:
  - `graphify explain "Nombre"`: dónde está algo y quién lo usa;
  - `graphify affected "Nombre"`: qué se rompe si lo cambias;
  - `graphify path "A" "B"`: cómo se relacionan dos piezas.
- Las preguntas en lenguaje natural (`graphify query "…"`) no son fiables: buscan por palabras, no por significado. Úsalas solo con nombres concretos.
- Abre archivos solo en las líneas que el mapa o una lectura anterior ya ubicaron.
- Puntos ciegos del mapa en este proyecto:
  - Frontend y backend se comunican por HTTP: `ApiService` (`frontend/src/app/core/services/`) llama a rutas `/api/v1/...` de los blueprints Flask (`backend/dawertech/modules/*/presentation/routes.py`). El mapa no une ambos lados; búscalos por la URL.
  - Plugins de Capacitor: `registerPlugin('ApkInstaller')` en TypeScript se une con `@CapacitorPlugin(name = "ApkInstaller")` en Java solo por nombre (igual `ExternalLinks`).
  - Blueprints registrados con `url_prefix` en `backend/dawertech/__init__.py` y comandos CLI de Flask (`flask crear-admin`, `cargar-celulares`…) que se invocan por nombre.
  - Configuración en tiempo de ejecución: `frontend/scripts/write-config.mjs` genera `assets/config.json` desde `frontend/.env`; el backend lee `backend/.env`.
  - Los `build.gradle` de Android no se analizan (sin símbolos).
- Si `graphify-out/` no existe, o el commit que figura al inicio de `GRAPH_REPORT.md` («Built from commit») no es el actual (`git rev-parse HEAD`), regenéralo sin IA ni coste:
  - Git Bash: `GRAPHIFY_BACKEND=none graphify update .`
  - PowerShell: `$env:GRAPHIFY_BACKEND="none"; graphify update .`
- Después de modificar código, ejecuta ese mismo comando. Los hooks de Git (`post-commit`, `post-checkout`, `post-merge`, `post-rewrite`) lo hacen tras cada commit o cambio de rama; después de un `git pull`, ejecútalo a mano.
- No ejecutes `graphify label`, `graphify cluster-only` (sin `--no-label`), `graphify extract` sin `--code-only` ni `/graphify` sin permiso del usuario: gastan tokens.

# Ponytail

- En toda tarea de código (escribir, corregir, refactorizar, revisar o elegir dependencias) trabaja con la skill Ponytail, nivel `full` salvo que el usuario pida otro: el cambio más pequeño que resuelve la tarea completa, reutilizando lo que ya existe en el proyecto.
- Si no está instalada en tu herramienta, instálala según https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md, pidiendo permiso antes.
- Ponytail nunca recorta lo que estas reglas exigen: validación, seguridad, accesibilidad, pruebas ni los pasos de verificación.

# Git

- Los agentes no ejecutan comandos de Git que cambien el repositorio local o el remoto (`add`, `commit`, `push`, `pull`, `fetch`, `checkout`, `switch`, `reset`, `restore`, `merge`, `rebase`, `stash`, `tag`, `clone`, `init`...), ni en este repositorio ni en otros. Cuando haga falta, dan al usuario los comandos exactos y él los ejecuta.
- Sí pueden usar los de solo lectura (`status`, `diff`, `log`, `show`, `rev-parse`, `check-ignore`).

# El proyecto

Inventario para un taller de reparación de celulares (ver `README.md`):

- `backend/`: API Flask 3 + SQLAlchemy + Alembic sobre PostgreSQL (base `dawer-bd`; la URL va en `DAWERTECH_DATABASE_URL` de `backend/.env`), en `http://localhost:5000/api/v1`. Python 3.12 con uv.
- `frontend/`: Angular 22 + Ionic 9 + Tailwind 4, en `http://localhost:4200`; app Android con Capacitor 8 en `frontend/android/`. pnpm.
- `deploy/`: despliegue en el VPS (`deploy-produccion`) y prueba local de la imagen (`deploy-dev`). CI en `.github/workflows/` (`deploy.yml` despliega API y web; `android-release.yml` publica el APK).
- Documentación: `docs/arquitectura.md`, `docs/api.md`, `docs/despliegue.md` y la especificación completa de reglas en `docs/reglas_de_desarrollo_y_ux.md`.

## Verificación

```powershell
python scripts/check_rules.py            # obligatorio antes de terminar cualquier tarea
cd backend; uv run pytest tests/test_session_policy.py -q
cd ..\frontend; pnpm run typecheck; pnpm run test:session; pnpm run build
```

No ejecutes `backend/tests/test_api.py` en este entorno: crea bases temporales (regla 2).

# Reglas del proyecto DawerTech

Especificación completa: `docs/reglas_de_desarrollo_y_ux.md`.

1. **CERO EMOJIS**: Jamás uses emojis (ni en botones, textos, toasts ni markdown de UI). Usa únicamente `<dt-icon>`.
2. **UN SOLO SERVIDOR Y BD (TRABAJAR SOBRE LO EXISTENTE)**: Trabajar directamente sobre el backend principal (`http://localhost:5000`) y la base PostgreSQL `dawer-bd`. NO crear servidores secundarios, bases de datos de prueba ni archivos SQLite.
   - **Excepción:** `deploy/deploy-dev/` puede levantar la API de DawerTech en Docker en el PC del dev (en otro puerto, por ejemplo 8000) al mismo tiempo que el backend principal, para probar la misma imagen que irá a producción. Siempre se conecta a la base local `dawer-bd` (fuera de Docker): no crea bases de datos ni contenedores de Postgres.
3. **NEOBRUTALISM PURO**: Bordes negros duros, sombras sólidas, alto contraste. Sin DaisyUI.
4. **FORMULARIOS CENTRADOS**: Todos los formularios van centrados en pantalla (`max-w-3xl mx-auto` o `max-w-4xl mx-auto`).
5. **MODAL SCROLL LOCK OBLIGATORIO**: Al abrir cualquier modal o drawer, inyectar y usar `ModalLockService`:
   - `this.modalLock.lock()` al abrir, `this.modalLock.unlock()` al cerrar o en `ngOnDestroy()`.
   - Bloquea `document.documentElement`, `document.body` y el contenedor `<main>`.
   - En el backdrop del overlay incluir: `(wheel)="$event.stopPropagation(); $event.preventDefault()"` y `(touchmove)="$event.stopPropagation(); $event.preventDefault()"`.
6. **HOOK MANDATORIO DE REGLAS (RULE CHECKER)**: Ejecutar siempre `python scripts/check_rules.py` (o `pnpm --prefix frontend run check:rules`) antes de dar por terminada cualquier tarea. El pre-commit hook de Git (`.git/hooks/pre-commit`) bloquea cualquier commit que viole las reglas de emojis, scroll lock o base de datos única.
7. **RESPONSIVIDAD**: Sin superposiciones; soporte móvil, tablet y escritorio.
8. **SOPORTE EXCEL (.xlsx) Y CSV**: Para importaciones de catálogo.
9. **SUBIDA DE IMÁGENES**: Disponible en creación y edición de repuestos y celulares.
10. **MENSAJES EN ESPAÑOL CLAROS**: Sin errores silenciosos ni textos genéricos.
11. **CREDENCIALES DEL ADMIN LOCAL**: Para autenticarse en pruebas de navegador o peticiones, usar el admin local existente:
    - Correo: `admin@local.com`
    - Contraseña: `root12345678`
12. **PERSISTENCIA Y RESPETO DE LA SESIÓN DEL USUARIO**: Jamás cerrar la sesión activa del usuario. No revocar tokens ni limpiar `localStorage` en recargas (`Ctrl+Shift+R`). Mantener tiempos de token y tolerancia de rotación altos.
13. **TIPOGRAFÍA SÓLIDA DE ALTO CONTRASTE (CERO LETRAS OPACAS)**: Los textos sobre tarjetas de acento (`#FFE600`, `#38BDF8`, `#F87171`) deben ser negro puro `#000000` con `font-black`/`font-bold`, 100% opacos. Cero opacidades reducidas que generen textos deslavados u opacos.

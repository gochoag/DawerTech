# Especificación Técnica y Arquitectura del Sistema: Control de Repuestos y Compatibilidad

## 1. Visión General del Dominio y Reglas del Negocio

El sistema resuelve un cuello de botella crítico en el mostrador del taller de reparaciones: **la latencia de respuesta al cliente**. Cuando un cliente llega con un dispositivo averiado, el técnico necesita saber en segundos:

1. Si existe repuesto disponible en stock físico.
2. Dónde está ubicado y a qué precio se cotiza.
3. Si un repuesto genérico o de otro modelo es compatible con ese equipo.

### Reglas de Dominio:
* **Relación N a M (Muchos a Muchos):** Un repuesto físico puede ser compatible con múltiples modelos de dispositivos (por ejemplo, una mica que funciona para Xiaomi Redmi Note 11, Note 11S e Infinix).
* **Repuesto Exclusivo (1 a 1):** Un repuesto diseñado únicamente para un modelo exacto.
* **Repuesto Universal / General (Afinidad Nula):** Insumos que no dependen de un modelo de teléfono (ej. alcohol isopropílico, cinta capton, estaño, herramientas).
* **Control de Stock y Costos:** Cada repuesto registra precio de compra, precio de venta, cantidad en stock y alertas de existencia mínima.

---

## 2. Procedencia del Catálogo Inicial

Los modelos Android de `android_devices.json` se seleccionaron de [bsthen/device-models](https://github.com/bsthen/device-models), repositorio distribuido bajo licencia Apache 2.0. Se conservaron marca, nombre y código del dispositivo; `backend/scripts/build_android_seed.py` documenta el filtro de marcas y exclusiones. La lista de iPhone se curó para DawerTech `iphone_devices.json`. El seed es una instantánea inicial editable mediante la API, no una garantía de compatibilidad de repuestos.

El script de sembrado (`seed`) se ejecuta mediante el entorno de `uv` durante el aprovisionamiento inicial para poblar la base de datos SQLite sin necesidad de carga manual modelo por modelo.

---

## 3. Buenas Prácticas y Principios de Diseño Aplicados

Para garantizar que el software sea mantenible, escalable y limpio sin sobreingeniería, el proyecto aplica explícitamente los siguientes principios:

* **DRY (*Don't Repeat Yourself*):** 
  * *Backend:* Las reglas de cálculo de stock, validaciones de compatibilidad y serialización de modelos se centralizan en casos de uso y esquemas de validación compartidos; nunca se duplican filtros SQL entre endpoints.
  * *Frontend:* DaisyUI y Tailwind evitan escribir CSS redundante. Los estados de carga, alertas de error y lógica de formateo monetario se encapsulan en servicios e interceptores reutilizables.
* **KISS (*Keep It Simple, Stupid*):** Se utiliza SQLite embebido y almacenamiento de imágenes en el disco local de PythonAnywhere en lugar de servicios en la nube complejos (como S3 o clústeres de base de datos) que encarecen o complican el mantenimiento del taller.
* **YAGNI (*You Aren't Gonna Need It*):** No se implementan microservicios ni brokers de mensajería asíncrona; una API REST monolítica modular en Flask satisface completamente la demanda operativa.
* **SRP (*Single Responsibility Principle*):** Los controladores HTTP solo reciben parámetros y devuelven JSON; no tocan la base de datos ni validan reglas de negocio complejas. Esa labor recae exclusivamente en los casos de uso (`Application Layer`).

---

## 4. Backend: Flask Modular con SQLite y `uv`

### 4.1. Configuración de Entorno y Paquetes (`uv`)
El proyecto prescinde del `requirements.txt` tradicional y utiliza **`uv`** por su velocidad extrema y resolución declarativa y bloqueada de dependencias mediante `pyproject.toml` y `uv.lock`.

```toml
# pyproject.toml
[project]
name = "dawertech-repuestos-backend"
version = "0.1.0"
description = "API REST de repuestos y compatibilidad para taller de celulares"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "flask>=3.0.0",
    "flask-sqlalchemy>=3.1.0",
    "flask-cors>=4.0.0",
    "flask-migrate>=4.0.0",
    "marshmallow>=3.20.0",
    "pillow>=10.0.0",
    "python-dotenv>=1.0.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
]
```

### 4.2. Estructura de Directorios del Backend

```text
backend/
├── data/
│   ├── android_devices.json           # Modelos base filtrados
│   └── iphone_devices.json            # Modelos iPhone curados
├── instance/
│   └── workshop.db                    # Base de datos SQLite
├── migrations/                        # Migraciones con Flask-Migrate (Alembic)
├── scripts/
│   └── build_android_seed.py          # Script generador/sembrador del catálogo
├── src/
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py                # Rutas absolutas para SQLite y carpeta de uploads
│   ├── shared/
│   │   ├── domain/
│   │   │   └── exceptions.py          # Excepciones de negocio personalizadas
│   │   └── infrastructure/
│   │       ├── database.py            # Instancia SQLAlchemy
│   │       └── local_storage.py       # Almacenamiento y compresión local de imágenes
│   ├── modules/
│   │   ├── devices/                   # Catálogo de teléfonos
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   ├── infrastructure/
│   │   │   └── presentation/
│   │   └── inventory/                 # Repuestos y compatibilidades
│   │       ├── application/
│   │       │   ├── dtos.py
│   │       │   ├── register_part_use_case.py
│   │       │   └── search_compatibility_use_case.py
│   │       ├── domain/
│   │       │   ├── models.py
│   │       │   └── repositories.py
│   │       ├── infrastructure/
│   │       │   ├── orm_models.py
│   │       │   └── sqlite_repositories.py
│   │       └── presentation/
│   │           ├── controllers.py
│   │           └── routes.py
│   └── app.py                         # Application Factory: create_app()
├── pyproject.toml
├── uv.lock
└── wsgi.py                            # Punto de entrada para PythonAnywhere
```

### 4.3. Implementación de Casos de Uso y SQLite

#### Configuración de Base de Datos y Almacenamiento Local
```python
# src/config/settings.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dawertech-dev-key")
    # Base de datos SQLite en carpeta instance
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{BASE_DIR / 'instance' / 'workshop.db'}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Directorio de subida local compatible con PythonAnywhere
    UPLOAD_FOLDER = BASE_DIR / "uploads"
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # Máximo 5MB por imagen
```

#### Repositorio con Soporte para SQLite (Búsqueda por Texto y Compatibilidad)
```python
# src/modules/inventory/infrastructure/sqlite_repositories.py
from sqlalchemy import or_
from src.modules.inventory.domain.repositories import SparePartRepository
from src.modules.inventory.infrastructure.orm_models import SparePartORM, SparePartCompatibilityORM
from src.shared.infrastructure.database import db

class SqliteSparePartRepository(SparePartRepository):
    def find_by_device_and_query(self, device_id=None, search_term=None):
        query = db.session.query(SparePartORM)

        # Si se filtra por un dispositivo en mostrador
        if device_id:
            query = query.outerjoin(SparePartCompatibilityORM).filter(
                or_(
                    SparePartCompatibilityORM.device_id == device_id,
                    SparePartORM.is_universal == True
                )
            )

        # Búsqueda textual insensible a mayúsculas en SQLite
        if search_term:
            clean_term = f"%{search_term.strip()}%"
            query = query.filter(
                or_(
                    SparePartORM.name.ilike(clean_term),
                    SparePartORM.sku.ilike(clean_term)
                )
            )

        return query.distinct().all()
```

---

## 5. Frontend: Ionic + DaisyUI / Tailwind con `pnpm`

### 5.1. Configuración de Entorno (`pnpm` + DaisyUI)
La aplicación frontend utiliza **pnpm** para una gestión ultra rápida y eficiente del espacio en disco de dependencias. Para el diseño de componentes rápidos y responsivos se combinan los controladores de navegación de **Ionic** con las clases semánticas de **DaisyUI** y **Tailwind CSS**.

```json
// package.json (fragmento)
{
  "name": "dawertech-repuestos-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "ionic serve",
    "build": "ionic build --prod"
  },
  "dependencies": {
    "@ionic/angular": "^7.5.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.16",
    "daisyui": "^4.6.0",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "~5.2.0"
  }
}
```

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "corporate"],
  },
};
```

### 5.2. Estructura de Directorios del Frontend

```text
frontend/
├── src/
│   ├── app/
│   │   ├── core/                          # Servicios singleton y configuración HTTP
│   │   │   ├── http/
│   │   │   │   ├── api-url.interceptor.ts # Asigna la URL del backend según ambiente
│   │   │   │   └── error.interceptor.ts   # Manejo global de excepciones (DRY)
│   │   │   └── services/
│   │   │       └── toast.service.ts
│   │   ├── features/                      # Funcionalidades de negocio
│   │   │   ├── lookup/                    # PANTALLA PRINCIPAL DE BÚSQUEDA RÁPIDA
│   │   │   │   ├── components/
│   │   │   │   │   └── part-card.component.html # Diseñado con tarjetas DaisyUI
│   │   │   │   ├── pages/
│   │   │   │   │   ├── lookup.page.html
│   │   │   │   │   └── lookup.page.ts
│   │   │   │   └── services/
│   │   │   │       └── lookup.facade.ts   # Reactividad y debounce (RxJS)
│   │   │   └── spare-parts/               # REGISTRO Y GESTIÓN DE PRODUCTOS
│   │   │       ├── pages/
│   │   │       │   ├── part-form.page.html
│   │   │       │   └── part-form.page.ts
│   │   │       └── services/
│   │   │           └── spare-part.service.ts
│   │   ├── shared/                        # Modales y formateadores reusables
│   │   ├── app-routing.module.ts
│   │   └── app.component.ts
│   ├── assets/
│   ├── environments/
│   │   ├── environment.ts                 # Dev: http://localhost:5000/api/v1
│   │   └── environment.prod.ts            # Prod: https://usuario.pythonanywhere.com/api/v1
│   ├── global.scss                        # Importa Tailwind y DaisyUI
├── pnpm-lock.yaml
└── capacitor.config.ts
```

### 5.3. Interfaz de Usuario con DaisyUI (Vista del Técnico)

Uso de componentes ágiles de DaisyUI (`card`, `badge`, `input-bordered`, `loading-spinner`):

```html
<!-- src/app/features/lookup/pages/lookup.page.html -->
<ion-content class="p-4 bg-base-200">
  <div class="max-w-4xl mx-auto space-y-4">
    <!-- Barra de búsqueda con DaisyUI -->
    <div class="card bg-base-100 shadow-md p-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text font-bold">Buscar por modelo o repuesto:</span>
        </label>
        <div class="input-group flex gap-2">
          <input 
            type="text" 
            placeholder="Ej: Mica 9D, Redmi Note 11, Conector tipo C..." 
            class="input input-bordered w-full focus:input-primary" 
            [formControl]="searchInput"
          />
        </div>
      </div>
    </div>

    <!-- Lista de resultados -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div *ngFor="let part of parts$ | async" class="card card-side bg-base-100 shadow-xl border border-base-300">
        <figure class="w-32 h-32 flex-shrink-0">
          <img [src]="part.imageUrl || 'assets/placeholder.webp'" alt="Repuesto" class="object-cover w-full h-full" />
        </figure>
        <div class="card-body p-4 justify-between">
          <div>
            <h2 class="card-title text-base">{{ part.name }}</h2>
            <p class="text-xs text-base-content/70">SKU: {{ part.sku }}</p>
          </div>
          
          <div class="flex items-center justify-between mt-2">
            <span class="text-lg font-bold text-success">${{ part.salePrice | number:'1.2-2' }}</span>
            <span class="badge" [ngClass]="part.stockQuantity > 0 ? 'badge-success' : 'badge-error'">
              Stock: {{ part.stockQuantity }}
            </span>
          </div>

          <div class="card-actions justify-end mt-2">
            <div *ngIf="part.isUniversal" class="badge badge-outline badge-primary text-xs">Universal</div>
            <div *ngIf="!part.isUniversal" class="badge badge-outline badge-secondary text-xs">
              {{ part.compatibleCount }} modelos
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</ion-content>
```

---

## 6. Despliegue y Conexión Operativa

### 6.1. Backend: PythonAnywhere
* **Archivo WSGI:** En la consola de PythonAnywhere se configura el archivo `/var/www/usuario_pythonanywhere_com_wsgi.py` para instanciar la aplicación desde `wsgi.py`.
* **Entorno Virtual con `uv`:** En la consola Bash de PythonAnywhere:
  ```bash
  uv venv --python 3.11
  source .venv/bin/activate
  uv pip sync pyproject.toml
  # Sembrar el catálogo inicial
  uv run python scripts/build_android_seed.py
  ```
* **Manejo de Imágenes Estáticas:** En la pestaña **Web** de PythonAnywhere se mapea una ruta de archivos estáticos:
  * *URL:* `/uploads/`
  * *Directorio:* `/home/usuario/dawertech-repuestos-backend/uploads/`
  Esto permite que las imágenes se sirvan de forma nativa a nivel del servidor web sin pasar por la ejecución de Python.

### 6.2. Frontend: Cloudflare Pages
* **Compilación:**
  ```bash
  pnpm install
  pnpm run build
  ```
* **Configuración en Cloudflare Pages:**
  * *Framework Preset:* None / Angular
  * *Build Command:* `pnpm run build`
  * *Build Output Directory:* `www` (o `dist`)
* **Redirección SPA (Evitar 404 en refresh):** Se incluye un archivo `_routes.json` o `_redirects` en la carpeta `src/assets`:
  ```text
  /*    /index.html   200
  ```
* **CORS:** El backend en Flask tiene configurado `flask-cors` admitiendo el dominio generado por Cloudflare Pages (`https://dawertech-repuestos.pages.dev`).
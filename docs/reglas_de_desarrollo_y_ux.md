# Reglas Mandatorias de Desarrollo, UX y Arquitectura - DawerTech

Este documento consolida las reglas, estándares y restricciones obligatorias para cualquier desarrollador o agente de IA que trabaje en el proyecto DawerTech. **Deben cumplirse rigurosamente en cada cambio.**

---

## 1. Reglas Visuales y de Interfaz (UI / UX)

### 1.1. Prohibición Total de Emojis
* **Regla:** Queda **estrictamente prohibido** el uso de emojis en cualquier parte de la aplicación (botones, textos, títulos, modales, alertas toast o respuestas).
* **Solución:** Utilizar exclusivamente iconos SVG vectoriales a través del componente `<dt-icon [name]="'...'"></dt-icon>`.
* **Hooks de verificación:** Buscar `⚡`, `⚠️`, `✅`, `❌`, `🔥` o cualquier carácter emoji antes de finalizar cualquier tarea.

### 1.2. Sistema de Diseño Neobrutalism Puro (Sin DaisyUI)
* **Regla:** No se utiliza DaisyUI ni librerías de componentes prefabricados.
* **Tokens obligatorios:**
  * Bordes sólidos negros de `2.5px` a `3.5px` (`border-2`, `border-[2.5px]`, `border-[3px]`, `border-black`).
  * Sombras duras de bloque sin difuminado (`nb-shadow`, `nb-shadow-sm`, `nb-shadow-lg`, `nb-shadow-xl`).
  * Paleta de colores de alto contraste:
    * Fondo principal: `#F8F6EE`
    * Acento Amarillo taller: `#FFE600` (hover: `#FFD700`)
    * Acento Cian: `#38BDF8`
    * Verde éxito / entradas: `#4ADE80`
    * Rojo coral / salidas / errores: `#FF5A5F`
    * Negro puro: `#000000` / `#111111`
  * Tipografías de peso extra negro (`font-black`, `font-bold`).

### 1.3. Formularios Centrados y Proporcionados
* **Regla:** Todos los formularios de la aplicación (ficha de repuestos, gestión de cuentas, configuración, importaciones) deben presentarse **centrados horizontalmente** en la pantalla (`max-w-3xl mx-auto` o `max-w-4xl mx-auto`).
* **Motivo:** Evita que los formularios queden estirados de forma asimétrica hacia el margen izquierdo en monitores de alta resolución.

### 1.4. Bloqueo de Scroll al Abrir Modales (Modal Scroll Lock)
* **Regla:** Siempre que se abra cualquier ventana modal o drawer interactivo, el scroll del fondo debe bloquearse **completamente** a través del servicio centralizado `ModalLockService`:
  ```typescript
  readonly modalLock = inject(ModalLockService);

  openModal(): void {
    this.modalLock.lock();
  }

  closeModal(): void {
    this.modalLock.unlock();
  }

  ngOnDestroy(): void {
    this.modalLock.reset();
  }
  ```
* **Contenedores bloqueados:** Debido a la arquitectura de Shell de DawerTech (sidebar y header fijos con viewport interior), `ModalLockService` bloquea simultáneamente `document.documentElement`, `document.body` y el `<main class="overflow-y-auto">` mediante la clase `.modal-open` y `style.overflowY = 'hidden'`.
* **Intercepción de eventos de rueda/touch:** Para evitar que la rueda del mouse o gestos táctiles sobre el fondo oscuro (`fixed inset-0`) hagan scroll en el contenedor subyacente, el elemento overlay debe contener:
  ```html
  <div
    class="fixed inset-0 bg-black/60 z-50 ..."
    (wheel)="$event.stopPropagation(); $event.preventDefault()"
    (touchmove)="$event.stopPropagation(); $event.preventDefault()"
  >
  ```

### 1.5. Hook Automatizado de Verificación de Reglas (check_rules.py)
* **Regla:** Ningún cambio puede ser comiteado o aceptado sin pasar el validador automático de reglas:
  ```bash
  python scripts/check_rules.py
  # O alternativamente:
  npm --prefix frontend run check:rules
  ```
* **Git Hook Pre-commit:** Configurado en `.git/hooks/pre-commit`, bloquea automáticamente el commit si detecta:
  1. Emojis en código fuente (`frontend/src` o `backend/dawertech`).
  2. Modales o overlays sin inyección ni invocación de `ModalLockService`.
  3. Bases de datos SQLite temporales ajenas a `inventory.sqlite3`.

### 1.5. Responsividad Impecable en Todas las Pantallas
* **Regla:** Ningún elemento flotante o barra debe superponerse al contenido ni tapar campos de formulario.
* El diseño debe adaptarse fluidamente a móvil (`<640px`), tablet (`640px - 1024px`) y escritorio (`>1024px`).
* Las tablas con muchas columnas deben incorporar contenedor con `overflow-x-auto`.

### 1.6. Tipografía Sólida, Alto Contraste y Cero Letras Opacas o Deslavadas
* **Regla:** En el estilo Neobrutalista, las tarjetas de métricas y componentes con fondos de acento vibrantes (`#FFE600`, `#38BDF8`, `#F87171`, `#4ADE80`) deben utilizar siempre **texto negro sólido (`#000000`) 100% opaco** con pesos fuertes (`font-black`, `font-extrabold`).
* **Prohibición de opacidades bajas:** No aplicar `text-black/70`, `text-black/80`, `rgba(0, 0, 0, 0.75)` ni textos blancos deslavados sobre fondos vibrantes; las letras no deben verse opacas, transparentes ni descoloridas.
* **Modo Oscuro con Alto Contraste:** En modo oscuro, los textos secundarios sobre fondos de superficie oscura deben utilizar tonos claros de alta legibilidad (`#D1D5DB` o `#F3F4F6`), evitando grises tenues que degraden el contraste por debajo del estándar WCAG AAA.

---

## 2. Reglas del Backend, Pruebas y Manejo de Sesiones

### 2.1. Un Solo Servidor Backend y Base de Datos Local (Trabajar sobre lo Existente)
* **Regla:** Se trabaja **directamente sobre el servidor backend en ejecución (`http://localhost:5000`) y la base de datos principal (`backend/inventory.sqlite3`)**.
* **Prohibición de servidores y BD secundarias:** No crear servidores de backend secundarios en otros puertos (ej. 5001) ni bases de datos SQLite temporales de prueba, para evitar errores de conexión y duplicidad de estado.
* **Credenciales del Administrador Local para Pruebas y Validación:**
  * **Correo:** `admin@local.com`
  * **Contraseña:** `root12345678`
* Para cualquier prueba de interfaz con el navegador (`agent-browser`), llamadas API o verificaciones funcionales, utilizar directamente este usuario administrador local existente.

### 2.2. Persistencia Ininterrumpida de la Sesión del Usuario
* **Regla:** La sesión de trabajo activa del usuario (`admin@local.com`) debe persistir sin interrupciones.
* **Vigencia y Gracia:** El token de acceso posee una duración extendida (`ACCESS_MINUTES = 720` / 12 horas) y la rotación del token de refresco posee un margen de gracia de 5 minutos (`SESSION_ROTATION_GRACE_SECONDS = 300`) para tolerar peticiones concurrentes sin invalidar la sesión.
* **Tolerancia a Recargas:** Al presionar `Ctrl+Shift+R` o experimentar micro-cortes, el frontend no debe cerrar la sesión ni enviar inmediatamente al login si los datos de sesión y refresh token existen en el almacenamiento local. La sesión solo se finaliza si el servidor devuelve expresamente un código `401 Unauthorized` o `403 Forbidden` confirmando la revocación.

### 2.3. Comandos CLI en Español, Simples y Basados en `.env`
* **Regla:** Todos los comandos CLI de Flask deben ser en español y no requerir parámetros kilométricos:
  * `flask crear-admin`
  * `flask cambiar-clave`
  * `flask cargar-celulares`
  * `flask respaldar`
* Toda la configuración (URL de BD, Secret Key, CORS) se carga automáticamente desde el archivo `.env`.

### 2.4. Mensajes de Error Descriptivos en Español
* **Regla:** La API jamás debe devolver errores genéricos o silenciosos.
* Cada excepción `ApiProblem` debe incluir un código semántico y un mensaje en español comprensible para el usuario (ej. `"Este modelo ya existe en el catálogo"`, `"Credenciales incorrectas"`, etc.).

---

## 3. Catálogo, Archivos y Compatibilidad

### 3.1. Soporte de Plantilla Excel (`.xlsx`) y CSV
* **Regla:** Para la importación masiva de repuestos, ofrecer descarga de plantilla tanto en **Excel formateado (`.xlsx`)** con cabeceras estilizadas y filas de ejemplo, como en formato `.csv` plano.
* El cargador de archivos debe admitir ambas extensiones (`.xlsx` y `.csv`).

### 3.2. Carga de Imágenes en Repuestos y Celulares
* **Regla:** El usuario debe poder subir fotografías tanto al momento de **crear** como de **editar** un repuesto o celular.
* Debe presentarse vista previa inmediata de la fotografía seleccionada.

---

## 4. Identidad de Marca y Logotipo

### 4.1. Monograma DawerTech
* El isotipo oficial del proyecto es el vector SVG ubicado en `frontend/src/assets/dt-mark.svg` (Monograma D con cruz de servicio interior, colores `#2a2f63` y `#5fb0c9`).
* Todos los archivos gráficos derivados (`dt-wordmark.svg`, `dt-app-icon.svg`) deben mantener concordancia matemática exacta con este vector.


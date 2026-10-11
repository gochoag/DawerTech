# Plan de desarrollo de DawerTech

## Resumen

Construir una app de inventario para un local de reparación de celulares, con una interfaz Ionic Angular compartida entre web y Android, una API Flask y SQLite. La primera versión cubrirá repuestos, modelos compatibles, existencias y movimientos. Trabajará siempre en línea y admitirá hasta cinco cuentas activas.

La web se publicará en **Cloudflare Pages** y la API en **PythonAnywhere gratuito**. Vercel Hobby no se usará en producción porque su plan limita el uso a proyectos personales no comerciales: [documentación de Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Identidad y experiencia de uso

- Crear un logo vectorial **“Dt”** de trazos simples, sin degradados ni iconos genéricos de herramientas. Entregar SVG para web, favicon y versiones del icono adaptativo de Android; comprobar su lectura en tamaño pequeño.
- Usar la paleta dada: `#E3F6F5` como fondo, `#A7E0DB` para superficies suaves, `#5FB0C9` como acento, `#3E6D9C` para acciones secundarias y `#2A2F63` para texto y acciones principales. Preparar variantes claras y oscuras del logo; la interfaz v1 usará tema claro.
- Usar **Ionic + Tailwind**, sin DaisyUI. Definir componentes y tokens propios para mantener una identidad consistente. En PC, presentar tablas y filtros; en móvil, tarjetas, búsqueda inmediata y selección de modelos en una pantalla buscable, evitando listas desplegables largas.
- Diseñar estados vacíos, de carga y de error con instrucciones claras; verificar contraste, navegación por teclado y controles táctiles cómodos.

## Funcionalidad y arquitectura

- Organizar un monorepositorio con frontend, API, recursos de marca y documentación. La API será un monolito modular con capas de dominio, casos de uso, persistencia y HTTP. Usar repositorios y una unidad de trabajo para que cada movimiento de stock sea una transacción; evitar abstracciones duplicadas.
- Modelar usuarios, modelos de celular, repuestos, compatibilidades y movimientos. Cada repuesto tendrá SKU único, nombre, variante, categoría, cantidad calculada desde movimientos, costo y precio vigentes, mínimo de stock y una foto opcional. Guardar importes en centavos de USD y fechas en UTC; mostrarlas en hora de Ecuador.
- Permitir entradas, salidas y ajustes con motivo, autor y fecha. Conservar el costo de compra en cada entrada y el precio aplicado en cada salida. Impedir existencias negativas y editar movimientos históricos; una corrección será un nuevo ajuste.
- Relacionar un repuesto con varios celulares. Si no tiene modelos asociados, mostrar **“sin compatibilidad registrada”**; no se asumirá compatibilidad universal.
- Incluir búsqueda por nombre, SKU y celular compatible, alertas de stock bajo, historial de movimientos y carga inicial por formulario o CSV con vista previa, errores por fila y confirmación. La cantidad importada generará movimientos de entrada.
- Cargar una instantánea reproducible de un [catálogo amplio de modelos Android con licencia Apache 2.0](https://github.com/bsthen/device-models), depurando duplicados y equipos que no sean celulares; añadir una lista curada de iPhone. El seed será idempotente y conservará los modelos añadidos por usuarios. Meta: superar **1.000 modelos utilizables**.
- Exponer una API JSON versionada bajo `/api/v1` para autenticación, usuarios, celulares, repuestos, imágenes, movimientos, importación y resumen. Usar SQLAlchemy y migraciones Alembic; la base de datos y las fotos vivirán fuera del repositorio.

## Acceso, despliegue y operación

- Crear por CLI la única cuenta propietaria. Esta podrá gestionar inventario y crear, desactivar o restablecer coadministradores; los coadministradores solo gestionarán inventario. No habrá registro público y se limitarán las cuentas activas a cinco.
- Usar contraseñas con hash Argon2id, HTTPS, control de intentos de acceso y JWT de acceso de corta duración. Mantener sesiones revocables en el servidor. En web, guardar la sesión solo en memoria. En Android, el primer ingreso será con contraseña; después, la biometría podrá desbloquear una sesión guardada en almacenamiento cifrado del dispositivo. Cerrar sesión, desactivar una cuenta o cambiar su contraseña invalidará las sesiones correspondientes.
- Desplegar Flask mediante WSGI y entorno virtual en PythonAnywhere; aplicar migraciones y seed por CLI antes de recargar la app. Publicar la compilación estática de Angular en Cloudflare Pages y configurar en la API únicamente los orígenes web autorizados. Consultar las guías de [Angular en Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/) y [rutas SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/).
- Generar un APK Android de lanzamiento firmado, con número de versión e instrucciones de instalación y actualización manual. Probar la biometría en un dispositivo físico.
- Documentar la renovación mensual de PythonAnywhere gratuito, la revisión de espacio y CPU, y una copia **diaria manual** de SQLite y las fotos fuera del servidor, además de una copia antes de cada migración. Usar la [API de respaldo de SQLite](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup) y probar una restauración. PythonAnywhere ofrece un trabajador y 512 MiB en el plan gratuito y [desaconseja SQLite para producción](https://help.pythonanywhere.com/pages/KindsOfDatabases/); la salida a operación dependerá de superar pruebas reales con cinco usuarios.

## Entregas y aceptación

1. **Marca y prototipo:** logo final, tokens visuales y pantallas de inventario, detalle, movimiento e inicio de sesión en móvil y PC.
2. **API y datos:** migraciones, seed, CLI de administración, autenticación, inventario, CSV y respaldos.
3. **Web y APK:** flujos completos, foto opcional comprimida, adaptación móvil y desbloqueo biométrico Android.
4. **Verificación y publicación:** pruebas de permisos y sesiones; entradas simultáneas sin pérdida de stock; CSV inválido sin cambios parciales; migración y restauración; revisión visual en móvil, tableta y PC; prueba del APK firmado; despliegue y guía operativa.

## Supuestos fijados

- Un solo local y una sola existencia total por repuesto.
- Moneda USD e interfaz en español.
- Sin trabajo offline, reparaciones, clientes, facturación ni ventas completas en v1.
- SQLite se mantendrá mientras las pruebas de concurrencia y el uso real resulten aceptables. PythonAnywhere gratuito tiene un trabajador, 512 MiB y vencimiento mensual; su documentación no recomienda SQLite como base de producción: [límites actuales del plan gratuito](https://help.pythonanywhere.com/pages/FreeAccountsFeatures/).

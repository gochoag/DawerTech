# Arquitectura de DawerTech

El proyecto es un monolito modular para un local y hasta cinco cuentas. Se separan los límites que protegen inventario y seguridad sin crear servicios distribuidos.

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Dominio | `backend/src/modules/*/domain/`, `src/shared/domain/` | Entidades y reglas de negocio puras (`calculate_movement_delta`, compatibilidad N:M y universal); sin dependencias de frameworks |
| Casos de uso | `backend/src/modules/*/application/` | Orquestación de lógica: registro de repuestos, búsqueda por compatibilidad, movimientos y seed |
| Persistencia e Infraestructura | `backend/src/modules/*/infrastructure/`, `src/shared/infrastructure/` | SQLAlchemy ORM, repositorios SQLite (`SqliteSparePartRepository`), almacenamiento y compresión local de imágenes (`LocalStorageService`) |
| Presentación HTTP | `backend/src/modules/*/presentation/`, `src/shared/presentation/` | Controladores y blueprints modulares (`auth_bp`, `devices_bp`, `inventory_bp`), validación y respuestas JSON |
| Frontend | `frontend/src/app` | Aplicación Ionic Angular con Tailwind CSS, vista de búsqueda rápida para mostrador y gestión de inventario |

La existencia se obtiene con `SUM(quantity_delta)`, nunca se edita como campo estático. La unidad de trabajo serializa cada escritura SQLite mediante `BEGIN IMMEDIATE`: leer existencia, verificar la regla y registrar el movimiento ocurren en una sola transacción consistente.

Los repuestos soportan tres tipos de afinidad: exclusivos (1 a 1), multimodelo (relación N a M mediante `part_devices`) y universales (`is_universal = True` para insumos de taller o repuestos genéricos que aplican a cualquier teléfono).


El frontend restaura la sesión antes de habilitar las rutas protegidas. En Android, los tokens y los datos de sesión se guardan cifrados mediante Android Keystore y se asocian a la URL de la API. En web se conservan en localStorage y la renovación se extiende por 365 días. Android solicita una sesión recordada sin caducidad por fecha. La protección opcional del perfil bloquea el acceso local después de 7 días sin actividad y usa biometría o las credenciales del dispositivo; la renovación automática no cuenta como actividad. Salir de la app conserva la sesión y cerrar sesión elimina el acceso guardado. La API consulta el estado de la sesión en cada petición y el cierre explícito revoca el token sin margen de gracia; la rotación ordinaria conserva el margen de 5 minutos.

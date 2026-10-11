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


El frontend conserva el JWT de acceso en memoria. En Android, la sesión de renovación se guarda cifrada mediante Android Keystore y se asocia a la URL de la API. En web no se persiste el token. La API consulta el estado de la sesión en cada petición, por lo que una revocación tiene efecto inmediato.

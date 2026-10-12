# API DawerTech v1

Prefijo: `/api/v1`. Todas las peticiones y respuestas de datos usan JSON. Los endpoints privados exigen `Authorization: Bearer <access_token>`. Las cuentas coadministradoras pueden gestionar inventario; solo la propietaria administra usuarios. Una contraseña temporal bloquea el inventario hasta cambiarla.

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/auth/login` | Correo y contraseña; entrega JWT de 12 horas y token de renovación. `remember_device: true` recuerda Android sin caducidad por fecha; la web renueva por 365 días |
| POST | `/auth/refresh` | Rota el token de renovación con 5 minutos de margen para peticiones concurrentes. Conserva la sesión recordada; `remember_device: true` permite actualizar una sesión anterior de Android |
| POST | `/auth/logout` | Revoca la sesión identificada por `refresh_token`, o por el Bearer de acceso si se envía `{}` |
| GET | `/auth/me` | Cuenta actual |
| POST | `/auth/password` | Cambia clave y revoca todas las sesiones |
| GET/POST | `/users` | Listar/crear coadministradores (propietario) |
| PATCH | `/users/:id` | Cambiar nombre, estado o clave (propietario) |
| GET/POST | `/devices` | Buscar/listar y crear modelos de celular |
| GET/POST | `/parts` | Buscar/listar y crear repuestos |
| GET | `/parts/name-matches` | Aviso de nombres repetidos: `name`, `page`, `limit` y `exclude_id` opcional; incluye SKU, calidad, categoría y estado archivado |
| GET/PATCH | `/parts/:id` | Detalle y edición; `archived` retira una referencia de la lista |
| GET/POST | `/parts/:id/image` | Imagen opcional autenticada |
| GET/POST | `/movements` | Historial y entrada, salida o ajuste |
| GET | `/dashboard` | Totales, alertas y actividad |
| GET | `/imports/template` | Plantilla CSV |
| POST | `/imports/preview` | Validación de archivo UTF-8, máximo 500 filas |
| POST | `/imports/commit` | Confirmación atómica de filas validadas |

`GET /devices?q=...` combina palabras entre marca, modelo y código, sin distinguir mayúsculas ni el orden: `samsung a02` y `a02 samsung` encuentran Samsung Galaxy A02. Cada palabra debe coincidir y los caracteres `%` y `_` se buscan literalmente; `ids=1,2` recupera seleccionados. `GET /parts?q=...&device_id=...` filtra por texto y compatibilidad. Las listas usan `page` y `limit` (máximo 100).

### Repuesto

`GET /parts/name-matches?name=...` compara el nombre completo ignorando mayúsculas, tildes y espacios extra. Incluye otras calidades y registros archivados para que se puedan revisar antes de crear. Es un aviso: el nombre no es único y se permite crear otra referencia después de revisarlo. El SKU sigue siendo único y un SKU repetido devuelve `duplicate_sku` (409).

En la tabla, **Foto** abre la imagen autenticada sin entrar a la ficha y muestra **Sin foto** cuando no existe. **Precio venta** y **Precio compra** se muestran juntos; el SKU se copia con el icono junto al nombre.

```json
{
  "sku": "DISP-001",
  "name": "Display OLED",
  "variant": "Negro",
  "category": "Displays",
  "purchase_cents": 2550,
  "sale_cents": 4200,
  "min_stock": 1,
  "initial_stock": 3,
  "device_ids": [1, 2]
}
```

`device_ids: []` significa **sin compatibilidad registrada**. El stock se calcula a partir de movimientos. En la creación, `initial_stock` genera una entrada; en la edición, la cantidad no se cambia directamente.

### Movimiento

```json
{"part_id": 1, "kind": "exit", "quantity": 1, "reason": "Uso en reparación"}
```

Para ajustar un conteo: `{"part_id":1,"kind":"adjustment","target_stock":4,"reason":"Conteo físico"}`. Las existencias negativas se rechazan. Los movimientos anteriores no se editan ni borran: se registra otro ajuste. Importes son centavos enteros de USD y las fechas salen en UTC.

### Errores

Las respuestas de error usan `{"error":{"code":"...","message":"..."}}`. Una importación inválida incluye `details` con número de fila. El servidor limita cargas a 2 MiB y las imágenes se convierten a WebP.

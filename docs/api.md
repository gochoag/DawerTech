# API DawerTech v1

Prefijo: `/api/v1`. Todas las peticiones y respuestas de datos usan JSON. Los endpoints privados exigen `Authorization: Bearer <access_token>`. Las cuentas coadministradoras pueden gestionar inventario; solo la propietaria administra usuarios. Una contraseña temporal bloquea el inventario hasta cambiarla.

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/auth/login` | Correo y contraseña; entrega JWT de 15 minutos y token de renovación |
| POST | `/auth/refresh` | Rota el token de renovación; el anterior queda inválido |
| POST | `/auth/logout` | Revoca la sesión actual |
| GET | `/auth/me` | Cuenta actual |
| POST | `/auth/password` | Cambia clave y revoca todas las sesiones |
| GET/POST | `/users` | Listar/crear coadministradores (propietario) |
| PATCH | `/users/:id` | Cambiar nombre, estado o clave (propietario) |
| GET/POST | `/devices` | Buscar/listar y crear modelos de celular |
| GET/POST | `/parts` | Buscar/listar y crear repuestos |
| GET/PATCH | `/parts/:id` | Detalle y edición; `archived` retira una referencia de la lista |
| GET/POST | `/parts/:id/image` | Imagen opcional autenticada |
| GET/POST | `/movements` | Historial y entrada, salida o ajuste |
| GET | `/dashboard` | Totales, alertas y actividad |
| GET | `/imports/template` | Plantilla CSV |
| POST | `/imports/preview` | Validación de archivo UTF-8, máximo 500 filas |
| POST | `/imports/commit` | Confirmación atómica de filas validadas |

`GET /devices?q=...` busca por marca, modelo o código; `ids=1,2` recupera seleccionados. `GET /parts?q=...&device_id=...` filtra por texto y compatibilidad. Las listas usan `page` y `limit` (máximo 100).

### Repuesto

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

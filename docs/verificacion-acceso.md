# Revisión del acceso y la interfaz web/Android

Fecha: 11 de octubre de 2026. Dispositivo: Infinix X6831, conectado por ADB Wi-Fi. WebView: 360 × 744 píxeles CSS; pantalla física: 1080 × 2460. Se utilizó el backend principal en `192.168.100.49:5000` y la base existente `backend/inventory.sqlite3`.

## Diseño compartido

Se conserva el monograma y la identidad del taller: crema `#F8F6EE`, negro `#000000`, amarillo `#FFE600`, cian `#38BDF8`, verde `#4ADE80` y coral `#FF5A5F`. Se mantiene la tipografía del sistema, con encabezados fuertes y texto de formularios de 16 px.

En móvil la cabecera contiene menú, marca y perfil. Crear repuestos queda en las pantallas correspondientes; cambiar el tema está en el perfil y en el drawer. En escritorio se conservan los accesos rápidos. Espaciado y tipografía usan tamaños compartidos y `clamp`, con controles de al menos 44 px y áreas seguras del dispositivo.

Los paneles comparten `DialogSurfaceDirective`: nombre accesible, foco inicial, recorrido con Tab, restauración del foco y Escape para cerrar el panel actual. El alto se adapta al viewport visible y al teclado. El fondo queda bloqueado con `ModalLockService`, mientras el panel permite desplazamiento táctil y con rueda.

## Pantallas y estados revisados

| Vista | Resultado y cambios |
| --- | --- |
| Login y desbloqueo | Rótulo cian «Gestión de Repuestos y Taller» restaurado. Formulario sin configuración del servidor ni checkbox biométrico. Ancho y contraste revisados en ambos temas; la acción de ingreso cabe en 320 × 568. En horizontal se permite desplazamiento vertical. |
| Cabecera, perfil y drawer | Corregido el recorte del perfil en el teléfono. Menús con controles táctiles y límite de altura; drawer desplazable en horizontal. Botón de contraer la barra lateral dentro de su área, sin recortes. |
| Panel de control | Encabezados y contenido se ajustan al ancho. Texto negro sobre el coral para corregir el contraste de los movimientos negativos. |
| Repuestos | Registros como tarjetas con etiquetas en móvil y tabla en escritorio. Orden por nombre, precio y stock en ambos formatos. Filtro por celular limitado al ancho visible. |
| Nuevo repuesto y ficha | Formularios centrados, campos con etiquetas accesibles y acciones táctiles. Corregido el desbordamiento de los atajos de cantidad a 1024 px. Toggle universal asociado a su campo. Revisadas listas de categorías/variantes y formulario de ajuste de stock. |
| Categoría y variante | Ambos modales caben en pantallas pequeñas, permiten desplazamiento y cierran con Escape restaurando el foco. |
| Kardex rápido | Revisados entrada/salida, cantidades, motivos y cancelación. En Android se abrió el teclado: el panel quedó dentro del alto visible y respondió al swipe sin desplazar el fondo. No se confirmó ningún movimiento. |
| Celulares | Catálogo, búsqueda, registro y selector anidado de foto revisados en Android. Se cancelaron todas las operaciones. |
| Movimientos | Registros con etiquetas en móvil; filtros distribuidos en varias líneas. Se conservan los campos de fecha, operador, motivo y variación. |
| Importación | Dos columnas en escritorio y una en móvil. Plantillas, selector de archivo, vista previa y errores revisados; la vista previa se preparó solo en memoria del navegador de prueba. No se importó inventario. |
| Mi cuenta | Protección de acceso únicamente en Android dentro del perfil. Campos de contraseña con etiquetas y controles para mostrarla. No se cambió la contraseña ni la protección del usuario. |
| Usuarios | Lista, registro, restablecimiento y confirmación de estado revisados. Corregido el bloqueo del desplazamiento al cancelar la confirmación. Restablecimiento y cambio de estado se abrieron solo en memoria del navegador aislado. No se modificó ninguna cuenta. |
| Más opciones | Tarjetas y texto se ajustan a móvil, tablet y escritorio. |
| Salir y cerrar sesión | Ambos diálogos verificados en Android. Cerrar sesión se canceló en el teléfono. Se confirmó Cerrar app y se abrió de nuevo: apareció el panel sin correo, contraseña ni biometría. El cierre de sesión completo se probó únicamente en la sesión independiente del navegador. |

## Evidencia

- 70 mediciones de las diez rutas autenticadas en 320 × 568, 360 × 740, 390 × 844, 667 × 375, 768 × 1024, 1024 × 768 y 1440 × 900: sin desbordamientos horizontales.
- Axe-core con etiquetas WCAG 2 A/AA: cero violaciones detectadas en las diez vistas en ambos temas, 17 comprobaciones de modales a tres tamaños, 17 variantes del login/desbloqueo y diez estados adicionales.
- Once comprobaciones de modales y menús en el WebView físico de la APK final: cero violaciones detectadas. Capturas y medidas de las diez pantallas obtenidas por el canal CDP reenviado con ADB.
- `pn run typecheck`, 15 pruebas de sesión/configuración y `python scripts/check_rules.py`: correctos. Las pruebas no crean otra base ni levantan otro backend.
- `pn android:dev`: compilación Angular, sincronización Capacitor, Gradle `assembleDebug`, instalación `adb install -r` y apertura correctas. La sesión guardada sobrevivió a la actualización.
- APK instalada: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Capturas y resultados locales: `frontend/.angular/ux-review/`, ignorados por Git.

El auditor automático se acompañó de inspección visual del login, cabecera, registros y diálogos, y pruebas táctiles con el teclado real. El login nativo se revisó en el navegador con la disposición del componente Android, para mantener intacta la sesión del teléfono. Huella, rostro y PIN después de siete días siguen cubiertos por pruebas de lógica; no se introdujo el PIN del usuario ni se forzó el bloqueo real del dispositivo. Tampoco se tomó ni subió una fotografía.

## Variables de entorno

`frontend/.env` se carga al iniciar o compilar. El ejemplo está en `frontend/.env.example`:

- `DAWERTECH_API_URL`: URL pública para la web; también sirve de respaldo para Android.
- `DAWERTECH_ANDROID_API_URL`: URL específica del APK.
- `DAWERTECH_ENV_FILE`: selección de otro archivo desde la terminal o el entorno de compilación, por ejemplo `.env.production`.

Si las URLs quedan vacías, la web utiliza el host de la página y el puerto 5000; al compilar Android se detecta la IP física del PC. Para desplegar, establece las URLs HTTPS y recompila. Las variables de la terminal o del alojamiento tienen prioridad sobre el archivo. Ya no hay una dirección almacenada desde el login que pueda sobrescribir esta configuración.

Las skills `antislop` y `antislop-*` se eliminaron de `.agents/skills` y de `skills-lock.json` del proyecto.

## Refinamiento de Repuestos

Se unificaron búsqueda, disponibilidad y celular dentro de un solo bloque. La cabecera de la página se compactó y se retiraron los botones sueltos de stock y ordenamiento. En escritorio se ordena con los encabezados de las columnas; en móvil se usa un selector dentro del encabezado del listado, con nombre, precio y stock en ambos sentidos.

La separación entre registros se define explícitamente con un borde superior de 2 px para cada fila después de la primera. En móvil se evita mezclar estos bordes con `divide-y`; son negros en claro y blancos en oscuro. Se aplican también al listado de Movimientos, que comparte la presentación de registros.

Verificación: 28 combinaciones de Repuestos y Movimientos, siete tamaños y dos temas, sin desbordamientos ni violaciones detectadas por axe-core. Comprobados los seis órdenes, búsqueda por nombre, filtro sin resultados y restablecimiento de filtros. Inspección visual por ADB de los tres registros en la APK instalada; ambos separadores visibles. `pn android:dev` compiló e instaló correctamente, conservando la sesión. Capturas y medidas locales en `frontend/.angular/parts-compact-review/`.

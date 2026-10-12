# Revisión de colores y selectores

11 de octubre de 2026. Se revisó la web y la APK de DawerTech en el Infinix X6831 conectado por ADB. Se conservó la sesión del teléfono y su preferencia de modo oscuro.

Se mantiene la identidad del taller. El fondo oscuro usa `#101114`, los paneles `#181A20`, los campos `#21242C` y el texto principal `#F9FAFB`. Los acentos amarillo, cian, verde y coral conservan texto negro. Los controles neutros usan bordes `#8F97A8` para distinguirse del fondo.

## Problemas corregidos

| Hallazgo | Corrección |
| --- | --- |
| Flecha nativa pegada al borde del selector | Flecha SVG con posición fija a 14 px del extremo y 32 px reservados para evitar que se superponga al texto. El control mantiene el menú nativo y la interacción por teclado. Se comprobó que «Bajo stock» cabe a 320 px. |
| Cerrar sesión con contraste insuficiente en el submenú | El texto rojo sobre el panel oscuro tenía relación 3,64:1. Ahora se utiliza un rojo claro y un fondo oscuro coherente durante el hover. |
| Bordes tenues en botones, sidebar, paneles y submenús | Se aumentó el contraste de los contornos y separadores. Los bordes de los botones neutros medidos tienen relación 5,29:1 respecto a su fondo. |
| Iconos y etiquetas anidados perdían su color | Se sustituyeron reglas que forzaban todos los descendientes por variables de color de cada superficie. Se recuperaron el sol amarillo, el avatar, las etiquetas negras y los iconos de cámara/galería. |
| Alertas de importación con texto blanco sobre amarillo | Las filas de validación ahora usan el amarillo del taller con texto negro, también en modo oscuro. |
| Repuesto agotado con texto negro sobre gris | Se evitaron las clases simultáneas de bajo stock y agotado. La etiqueta de cero existencias usa un fondo neutro y texto claro. |
| Mensajes de categoría/variante y acciones rojas con fondos claros en modo oscuro | Se adaptaron las superficies de error y sus textos, incluyendo estados de hover. |
| Iconos de estados vacíos casi invisibles | Los iconos secundarios usan un gris claro en modo oscuro. |
| Color de selección y foco inconsistente | La navegación activa conserva amarillo y negro durante el hover; los contornos de foco toman el color adecuado para cada superficie. |
| Cambio de tema con colores transitorios mezclados | El cambio se aplica sin transiciones durante los primeros fotogramas. El color del navegador se sincroniza con el tema desde el arranque. |

## Recorrido

| Área | Vistas y estados inspeccionados |
| --- | --- |
| Login | Web y disposición nativa, error de conexión, desbloqueo y ambos temas. |
| Panel de control | Indicadores de colores, cajas de iconos, movimientos, estado vacío y errores. |
| Repuestos | Filtros, ordenamiento, filas, stock agotado, estado sin resultados y Kardex rápido. |
| Nuevo repuesto y ficha | Campos, selectores, desplegables de categoría/variante, toggle universal, movimiento y mensajes de validación. |
| Celulares | Catálogo, búsqueda, estado vacío, registro y selector de fotografía. |
| Movimientos | Tipos, cantidades, tabla y tarjetas, errores y estado vacío. |
| Importación | Selector de archivo, instrucciones, vista previa y errores por fila. |
| Cuenta | Contraseña, coincidencia de claves y sección nativa de protección del acceso. |
| Usuarios | Lista, creación, restablecimiento y confirmación de estado. |
| Más opciones | Tarjetas y hover de los tres accesos. |
| Navegación | Sidebar desplegado y contraído, enlace activo, hover, drawer y submenú del perfil. |
| Diálogos y avisos | Salida, cierre de sesión, categoría, variante, usuario, celular, foto, filtros y notificaciones de error/confirmación. |

## Comprobación

Se completaron 115 comprobaciones con axe-core: 57 vistas/estados de modo oscuro, 30 estados adicionales y comparaciones con modo claro, siete variantes del login y 21 vistas de la APK real. No quedaron violaciones detectadas en estas comprobaciones. Los mensajes de error, agotado y vista previa se prepararon en memoria del navegador aislado; no se importaron datos ni se modificaron cuentas, contraseñas o existencias.

El análisis automático se complementó con capturas e inspección de colores calculados. El auditor deja comprobaciones incompletas para selectores con imagen de fondo, iconos sin texto y contenido parcialmente cubierto por menús; esos casos se revisaron visualmente y mediante medidas de color. El texto principal de los controles neutros medidos alcanza 14,85:1. La flecha queda fuera del área del texto. El menú nativo de disponibilidad se abrió en Android y se comprobó su fondo oscuro y texto legible.

`pn run typecheck`, compilación Angular/Gradle y `python scripts/check_rules.py` finalizaron correctamente. Se ejecutó `pn android:dev` y la APK se instaló con `adb install -r`, conservando la sesión. No se cambió la protección biométrica ni se solicitó el PIN del usuario.

Capturas y resultados locales: `frontend/.angular/dark-review/`. La APK instalada está en `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

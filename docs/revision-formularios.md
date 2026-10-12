# Ajuste de formularios y sidebar

- En PC, los formularios usan controles de aproximadamente 32–37 px y texto de 14–16 px. Android y pantallas táctiles conservan inputs de 44 px y texto de 16 px.
- Autogenerar usa 24 px de alto en PC; las cantidades rápidas, 28 px. El botón circular del sidebar vuelve a su borde y no ocupa una fila de navegación.
- En creación y edición de repuestos, SKU y categoría comparten la primera fila; el nombre ocupa la fila completa siguiente. En escritorio amplio, variante y precios comparten una fila.
- El switch de insumo general usa un thumb centrado dentro de su pista y conserva el control checkbox nativo con semántica de switch.
- Los formularios crecen con límites en monitores grandes: inputs hasta 16 px de texto, cuenta hasta 48 rem de ancho y nuevo repuesto hasta 64 rem. Las tablas mantienen sus dimensiones, tipografía, colores y contenido.
- El pegado directo se ofrece si el navegador admite el permiso `clipboard-read`. En Firefox/Safari se usa Ctrl+V para evitar el menú nativo de confirmación; esta restricción pertenece al navegador. [Referencia de Clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API#security_considerations).
- El APK no muestra instrucciones ni botones de Ctrl+V cuando no dispone de lectura directa; mantiene cámara y galería.

Validación: 32 vistas de formularios en ambos temas entre 320 y 3840 px, sin desbordamientos ni violaciones de accesibilidad. Cuenta completa visible a 1366×650. Comparación de 38 elementos de tabla a 375, 1366 y 3840 px: mismos estilos y medidas con y sin las reglas nuevas. Switch y cantidades rápidas probados sin guardar registros. Inputs y switch comprobados en el APK del Infinix X6831; sesión conservada al actualizar. Typecheck, 29 pruebas, compilación Angular/Gradle y validador del proyecto completados.

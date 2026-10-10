# DawerTech Agent Guidelines & Project Rules

Ref: Consulta `docs/reglas_de_desarrollo_y_ux.md` para las especificaciones completas.

### Reglas críticas de ejecución inmediata:
1. **CERO EMOJIS**: Jamás uses emojis (ni en botones, textos, toasts ni markdown de UI). Usa únicamente `<dt-icon>`.
2. **UN SOLO SERVIDOR Y BD (TRABAJAR SOBRE LO EXISTENTE)**: Trabajar directamente sobre el backend principal (`http://localhost:5000`) y `backend/inventory.sqlite3`. NO crear servidores secundarios ni bases de datos de prueba.
3. **NEOBRUTALISM PURO**: Bordes negros duros, sombras sólidas, alto contraste. Sin DaisyUI.
4. **FORMULARIOS CENTRADOS**: Todos los formularios van centrados en pantalla (`max-w-3xl mx-auto` o `max-w-4xl mx-auto`).
5. **MODAL SCROLL LOCK OBLIGATORIO**: Al abrir cualquier modal o drawer, inyectar y usar `ModalLockService`:
   - `this.modalLock.lock()` al abrir, `this.modalLock.unlock()` al cerrar o en `ngOnDestroy()`.
   - Bloquea `document.documentElement`, `document.body` y el contenedor `<main>`.
   - En el backdrop del overlay incluir: `(wheel)="$event.stopPropagation(); $event.preventDefault()"` y `(touchmove)="$event.stopPropagation(); $event.preventDefault()"`.
6. **HOOK MANDATORIO DE REGLAS (RULE CHECKER)**: Ejecutar siempre `python scripts/check_rules.py` (o `npm run check:rules`) antes de dar por terminada cualquier tarea. El pre-commit hook de Git (`.git/hooks/pre-commit`) bloquea cualquier commit que viole las reglas de emojis, scroll lock o base de datos única.
7. **RESPONSIVIDAD**: Sin superposiciones; soporte móvil, tablet y escritorio.
8. **SOPORTE EXCEL (.xlsx) Y CSV**: Para importaciones de catálogo.
9. **SUBIDA DE IMÁGENES**: Disponible en creación y edición de repuestos y celulares.
10. **MENSAJES EN ESPAÑOL CLAROS**: Sin errores silenciosos ni textos genéricos.
11. **CREDENCIALES DEL ADMIN LOCAL**: Para autenticarse en pruebas de navegador o peticiones, usar el admin local existente:
    - Correo: `admin@local.com`
    - Contraseña: `root12345678`
12. **PERSISTENCIA Y RESPETO DE LA SESIÓN DEL USUARIO**: Jamás cerrar la sesión activa del usuario. No revocar tokens ni limpiar `localStorage` en recargas (`Ctrl+Shift+R`). Mantener tiempos de token y tolerancia de rotación altos.
13. **TIPOGRAFÍA SÓLIDA DE ALTO CONTRASTE (CERO LETRAS OPACAS)**: Los textos sobre tarjetas de acento (`#FFE600`, `#38BDF8`, `#F87171`) deben ser negro puro `#000000` con `font-black`/`font-bold`, 100% opacos. Cero opacidades reducidas que generen textos deslavados u opacos.


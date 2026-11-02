# Funciones comunes de los scripts de vps/bin. Se carga con: source /opt/vps/admin/lib/comun.sh
INFRA=/opt/vps/infra

falla() { echo "ERROR: $*" >&2; exit 1; }

# aviso <texto>: a Telegram si existe /etc/vps/telegram.env (TELEGRAM_TOKEN y TELEGRAM_CHAT_ID); si no, solo a la salida.
aviso() {
  echo "$*"
  [ -r /etc/vps/telegram.env ] || return 0
  (
    source /etc/vps/telegram.env
    curl -fsS --max-time 10 -o /dev/null "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="$*"
  ) || echo "No se pudo enviar el aviso a Telegram." >&2
}

nombre_valido() { [[ "$1" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || falla "Proyecto no válido: «$1» (minúsculas, números y -)."; }

# campo <proyecto> <clave[.subclave]> [defecto]: lee projects.yml; una lista sale separada por espacios.
campo() {
  python3 - "$INFRA/projects.yml" "$@" <<'PY'
import sys, yaml
ruta, p, clave = sys.argv[1:4]
defecto = sys.argv[4] if len(sys.argv) > 4 else None
datos = (yaml.safe_load(open(ruta, encoding="utf-8")) or {}).get(p)
if datos is None:
    sys.exit(f"ERROR: el proyecto {p} no está en {ruta}")
v = datos
for k in clave.split("."):
    v = v.get(k) if isinstance(v, dict) else None
if v is None:
    if defecto is None:
        sys.exit(f"ERROR: falta «{clave}» de {p} en {ruta}")
    v = defecto
print(" ".join(map(str, v)) if isinstance(v, list) else v)
PY
}

proyectos() {
  python3 -c 'import sys, yaml; print("\n".join((yaml.safe_load(open(sys.argv[1], encoding="utf-8")) or {}).keys()))' "$INFRA/projects.yml"
}

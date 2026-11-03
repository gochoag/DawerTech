"""GET /download-apk?code=<versionCode>: transmite el APK de GitHub Releases desde el mismo dominio de la web.

El navegador no puede leer el archivo directamente de GitHub (CORS), y así la web muestra el progreso.
Sustituye a la función de Cloudflare Pages (functions/download-apk.js), con las mismas validaciones.
"""
import json
import os
import re
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from flask import Blueprint, Response, request

apk_bp = Blueprint("apk", __name__)

MAX_BYTES = 64 * 1024 * 1024
ASSET = "dawertech-release.apk"
HEADERS = {"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"}


def _fallo(status: int = 502) -> Response:
    return Response("No se pudo descargar el APK. Inténtalo de nuevo.", status=status, headers=HEADERS, mimetype="text/plain")


def _abrir(url: str, accept: str | None = None):
    """Abre una URL de GitHub (las pruebas la sustituyen para no usar la red)."""
    headers = {"User-Agent": "DawerTech-APK-Download"}
    if accept:
        headers["Accept"] = accept
    return urlopen(Request(url, headers=headers), timeout=15)


@apk_bp.get("/download-apk")
def download_apk():
    code = request.args.get("code", "")
    repo = os.getenv("DAWERTECH_APK_REPOSITORY", "gochoag/DawerTech")
    if not re.fullmatch(r"[1-9]\d*", code) or int(code) > 2_100_000_000 or not re.fullmatch(r"[\w.-]+/[\w.-]+", repo):
        return _fallo(400)
    tag = f"android-v{code}"

    try:
        with _abrir(f"https://api.github.com/repos/{repo}/releases/tags/{tag}", "application/vnd.github+json") as respuesta:
            release = json.load(respuesta)
    except HTTPError as error:
        return _fallo(404 if error.code == 404 else 502)
    except (OSError, ValueError):
        return _fallo()
    if not isinstance(release, dict):
        return _fallo()

    assets = release.get("assets") if isinstance(release.get("assets"), list) else []
    asset = next((a for a in assets if isinstance(a, dict) and a.get("name") == ASSET and a.get("state") == "uploaded"), None)
    size = asset.get("size") if asset else None
    if (release.get("draft") or release.get("prerelease") or release.get("tag_name") != tag
            or type(size) is not int or not 0 < size <= MAX_BYTES):
        return _fallo()
    url = urlsplit(str(asset.get("browser_download_url", "")))
    if (url.scheme != "https" or url.hostname != "github.com" or url.username or url.password
            or url.path.lower() != f"/{repo}/releases/download/{tag}/{ASSET}".lower()):
        return _fallo()

    try:
        apk = _abrir(url.geturl())
    except OSError:
        return _fallo()
    if not apk.geturl().startswith("https://"):
        apk.close()
        return _fallo()

    def trozos():
        with apk:
            while bloque := apk.read(64 * 1024):
                yield bloque

    return Response(trozos(), headers={
        **HEADERS,
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="dawertech-release.apk"',
        "X-APK-Size": str(size),
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers": "X-APK-Size",
    })

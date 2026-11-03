"""Pruebas de GET /download-apk con GitHub simulado: sin red ni bases de datos."""
import io
import json
from urllib.error import HTTPError

import pytest
from flask import Flask

from dawertech.shared.presentation import apk_download
from dawertech.shared.presentation.apk_download import apk_bp

APK = b"PK" + b"x" * 200_000
URL_APK = "https://github.com/gochoag/DawerTech/releases/download/android-v8/dawertech-release.apk"


class Respuesta(io.BytesIO):
    def __init__(self, datos: bytes, url: str):
        super().__init__(datos)
        self.url = url

    def geturl(self):
        return self.url


def release(**cambios):
    asset = {"name": "dawertech-release.apk", "state": "uploaded", "size": len(APK), "browser_download_url": URL_APK}
    asset.update(cambios.pop("asset", {}))
    datos = {"tag_name": "android-v8", "draft": False, "prerelease": False, "assets": [asset]}
    datos.update(cambios)
    return datos


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.delenv("DAWERTECH_APK_REPOSITORY", raising=False)
    pedidas = []

    def preparar(datos=None, error=None):
        def abrir(url, accept=None):
            pedidas.append(url)
            if url.startswith("https://api.github.com/"):
                if error:
                    raise HTTPError(url, error, "error", {}, None)
                return Respuesta(json.dumps(datos).encode(), url)
            return Respuesta(APK, "https://objects.githubusercontent.com/apk")
        monkeypatch.setattr(apk_download, "_abrir", abrir)

    app = Flask(__name__)
    app.register_blueprint(apk_bp)
    c = app.test_client()
    c.preparar, c.pedidas = preparar, pedidas
    return c


@pytest.mark.parametrize("code", ["", "0", "08", "abc", "-1", "1.5", "2100000001"])
def test_rechaza_codigos_invalidos_sin_llamar_a_github(cliente, code):
    cliente.preparar(release())
    r = cliente.get(f"/download-apk?code={code}")
    assert r.status_code == 400
    assert "No se pudo descargar el APK" in r.get_data(as_text=True)
    assert cliente.pedidas == []


def test_rechaza_repositorio_mal_configurado(cliente, monkeypatch):
    monkeypatch.setenv("DAWERTECH_APK_REPOSITORY", "no es un repo")
    cliente.preparar(release())
    assert cliente.get("/download-apk?code=8").status_code == 400


def test_release_inexistente_da_404(cliente):
    cliente.preparar(error=404)
    assert cliente.get("/download-apk?code=8").status_code == 404


@pytest.mark.parametrize("datos", [
    release(draft=True),
    release(prerelease=True),
    release(tag_name="android-v9"),
    release(asset={"name": "otro.apk"}),
    release(asset={"state": "starter"}),
    release(asset={"size": 0}),
    release(asset={"size": 64 * 1024 * 1024 + 1}),
    release(asset={"size": True}),
    release(asset={"browser_download_url": "https://evil.example/gochoag/DawerTech/releases/download/android-v8/dawertech-release.apk"}),
    release(asset={"browser_download_url": "https://github.com/otro/repo/releases/download/android-v8/dawertech-release.apk"}),
    release(asset={"browser_download_url": "http://github.com/gochoag/DawerTech/releases/download/android-v8/dawertech-release.apk"}),
    release(assets="no es una lista"),
])
def test_rechaza_releases_o_assets_no_validos(cliente, datos):
    cliente.preparar(datos)
    assert cliente.get("/download-apk?code=8").status_code == 502
    assert all(u.startswith("https://api.github.com/") for u in cliente.pedidas)


def test_transmite_el_apk_con_sus_cabeceras(cliente):
    cliente.preparar(release())
    r = cliente.get("/download-apk?code=8")
    assert r.status_code == 200
    assert r.data == APK
    assert r.headers["Content-Type"] == "application/vnd.android.package-archive"
    assert r.headers["X-APK-Size"] == str(len(APK))
    assert r.headers["Access-Control-Expose-Headers"] == "X-APK-Size"
    assert r.headers["Cache-Control"] == "no-store"
    assert cliente.pedidas == ["https://api.github.com/repos/gochoag/DawerTech/releases/tags/android-v8", URL_APK]

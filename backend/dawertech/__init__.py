import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from dawertech.cli import register_cli
from dawertech.config.settings import Config, resolve_database_url, resolve_media_dir
from dawertech.modules.auth.presentation.routes import auth_bp
from dawertech.modules.devices.presentation.routes import devices_bp
from dawertech.modules.inventory.presentation.routes import inventory_bp
from dawertech.shared.domain.exceptions import ApiProblem, InventoryRuleError
from dawertech.shared.infrastructure.database import install_database


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)

    if not test_config:
        env_file = find_dotenv(usecwd=True)
        if env_file:
            load_dotenv(env_file)
        elif not os.getenv("DAWERTECH_SECRET_KEY") and not os.getenv("SECRET_KEY"):
            raise RuntimeError(
                "No se encontró el archivo .env. Copia .env.example a .env "
                "(ej. 'Copy-Item .env.example .env' o 'cp .env.example .env') y configura las variables antes de continuar."
            )

    media_dir = resolve_media_dir(
        test_config.get("MEDIA_DIR") if (test_config and "MEDIA_DIR" in test_config)
        else os.getenv("DAWERTECH_MEDIA_DIR", Config.MEDIA_DIR)
    )

    app.config.update(
        DATABASE_URL=resolve_database_url(os.getenv("DAWERTECH_DATABASE_URL", Config.DATABASE_URL)),
        MEDIA_DIR=str(media_dir),
        SECRET_KEY=os.getenv("DAWERTECH_SECRET_KEY", Config.SECRET_KEY),
        CORS_ORIGINS=os.getenv("DAWERTECH_CORS_ORIGINS", Config.CORS_ORIGINS),
        MAX_CONTENT_LENGTH=Config.MAX_CONTENT_LENGTH,
    )

    if test_config:
        app.config.update(test_config)
        if "MEDIA_DIR" in test_config:
            app.config["MEDIA_DIR"] = str(resolve_media_dir(test_config["MEDIA_DIR"]))

    if not app.config["SECRET_KEY"]:
        raise RuntimeError("DAWERTECH_SECRET_KEY no está configurada en el archivo .env")
    if len(app.config["SECRET_KEY"]) < 32:
        raise RuntimeError("DAWERTECH_SECRET_KEY debe tener al menos 32 caracteres")

    Path(app.config["MEDIA_DIR"]).mkdir(parents=True, exist_ok=True)
    install_database(app)

    origins = [v.strip() for v in app.config["CORS_ORIGINS"].split(",") if v.strip()]
    origins.extend([
        "http://localhost", "https://localhost", "http://127.0.0.1:4200",
        r"^http://(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):(?:4200|8100)$",
    ])
    CORS(app, resources={r"/api/*": {"origins": origins}})

    # Blueprints modulares registrados bajo /api/v1
    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(devices_bp, url_prefix="/api/v1")
    app.register_blueprint(inventory_bp, url_prefix="/api/v1")

    register_cli(app)

    @app.errorhandler(ApiProblem)
    def handle_api_problem(problem: ApiProblem):
        error = {"code": problem.code, "message": problem.message}
        if problem.details is not None:
            error["details"] = problem.details
        return jsonify(error=error), problem.status

    @app.errorhandler(InventoryRuleError)
    def handle_inventory_error(problem: InventoryRuleError):
        error = {"code": problem.code, "message": problem.message}
        if problem.details is not None:
            error["details"] = problem.details
        return jsonify(error=error), problem.status

    @app.errorhandler(413)
    def handle_large_upload(_problem):
        return jsonify(error={"code": "file_too_large", "message": "El archivo supera el límite permitido"}), 413

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        return jsonify(error={"code": "http_error", "message": e.description}), e.code or 500

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error: Exception):
        app.logger.exception("Unexpected server error: %s", error)
        return jsonify(error={"code": "internal_error", "message": "Error interno del servidor"}), 500

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    return app


__all__ = ["create_app"]

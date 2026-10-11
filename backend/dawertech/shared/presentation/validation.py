from flask import request

from dawertech.shared.domain.exceptions import ApiProblem


def payload() -> dict:
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise ApiProblem("invalid_json", "Envía un objeto JSON")
    return value


def required_text(data: dict, key: str, maximum: int) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ApiProblem("invalid_field", f"Revisa el campo {key}")
    return value.strip()


def optional_text(data: dict, key: str, maximum: int, default: str = "") -> str:
    value = data.get(key, default)
    if not isinstance(value, str) or len(value.strip()) > maximum:
        raise ApiProblem("invalid_field", f"Revisa el campo {key}")
    return value.strip()


def nonnegative_int(data: dict, key: str, default: int | None = None) -> int:
    value = data.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 1_000_000_000:
        raise ApiProblem("invalid_field", f"Revisa el campo {key}")
    return value


def positive_int(data: dict, key: str) -> int:
    value = nonnegative_int(data, key)
    if value == 0:
        raise ApiProblem("invalid_field", f"{key} debe ser mayor que cero")
    return value


def pagination() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", "1")))
        limit = min(100, max(1, int(request.args.get("limit", "30"))))
    except ValueError:
        raise ApiProblem("invalid_pagination", "Página o límite inválido") from None
    return page, limit



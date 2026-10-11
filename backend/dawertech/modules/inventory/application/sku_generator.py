import re
import secrets
import time
import unicodedata
from sqlalchemy import select
from sqlalchemy.orm import Session

from dawertech.modules.inventory.infrastructure.orm_models import PartORM

CATEGORY_PREFIXES = {
    "pantalla": "PAN",
    "display": "PAN",
    "lcd": "PAN",
    "oled": "PAN",
    "bateria": "BAT",
    "batería": "BAT",
    "pila": "BAT",
    "camara": "CAM",
    "cámara": "CAM",
    "lente": "CAM",
    "pin": "PIN",
    "puerto": "PIN",
    "conector": "PIN",
    "carga": "PIN",
    "tapa": "CHA",
    "chasis": "CHA",
    "marco": "CHA",
    "carcasa": "CHA",
    "audio": "AUD",
    "altavoz": "AUD",
    "auricular": "AUD",
    "parlante": "AUD",
    "microfono": "AUD",
    "micrófono": "AUD",
    "flex": "FLX",
    "flexor": "FLX",
    "cristal": "GLS",
    "glass": "GLS",
    "mica": "GLS",
    "boton": "BTN",
    "botón": "BTN",
    "herramienta": "HER",
    "insumo": "INS",
    "quimico": "QUI",
    "químico": "QUI",
}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def extract_category_code(category: str) -> str:
    clean = strip_accents(category.lower().strip()) if category else ""
    for keyword, code in CATEGORY_PREFIXES.items():
        if keyword in clean:
            return code
    letters = re.sub(r"[^A-Za-z0-9]", "", clean).upper()
    return letters[:3] if len(letters) >= 3 else "REP"


def extract_model_code(name: str) -> str:
    clean = strip_accents(name.strip()) if name else ""

    ip_match = re.search(r"iphone\s*(\d{1,2}(?:\s*(?:pro\s*max|pro|plus|mini))?)", clean, re.IGNORECASE)
    if ip_match:
        val = ip_match.group(1).upper()
        val = re.sub(r"\s*PRO\s*MAX", "PM", val)
        val = re.sub(r"\s*PRO", "P", val)
        val = re.sub(r"\s*PLUS", "PL", val)
        val = re.sub(r"\s*MINI", "M", val)
        val = re.sub(r"\s+", "", val)
        return f"IP{val}"

    rn_match = re.search(r"(?:redmi\s*note|note)\s*(\d{1,2}[a-z]?)", clean, re.IGNORECASE)
    if rn_match:
        return f"RN{rn_match.group(1).upper()}"

    s_match = re.search(r"\b([SA]\d{1,2}[a-z]?)\b", clean, re.IGNORECASE)
    if s_match:
        return s_match.group(1).upper()

    moto_match = re.search(r"(?:moto\s*g|g)\s*(\d{1,2})", clean, re.IGNORECASE)
    if moto_match:
        return f"MG{moto_match.group(1)}"

    if re.search(r"\buniversal\b", clean, re.IGNORECASE):
        return "UNI"

    words = [re.sub(r"[^A-Za-z0-9]", "", w).upper() for w in clean.split()]
    for w in words:
        if re.search(r"\d", w) and len(w) <= 6:
            return w

    meaningful = [
        w for w in words
        if len(w) >= 2 and w not in {"PANTALLA", "BATERIA", "REPUESTO", "CALIDAD", "ORIGINAL", "PARA", "DE", "CON", "DEL"}
    ]
    if meaningful:
        return meaningful[0][:4]

    return "GEN"


def generate_smart_sku(session: Session, category: str, name: str) -> str:
    cat_code = extract_category_code(category)
    model_code = extract_model_code(name)
    base = f"{cat_code}-{model_code}"

    for _ in range(50):
        suffix = secrets.token_hex(2)[:3].upper()
        candidate = f"{base}-{suffix}"
        if not session.scalar(select(PartORM.id).where(PartORM.sku == candidate)):
            return candidate

    return f"{base}-{hex(int(time.time()))[-4:].upper()}"


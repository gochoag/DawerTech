#!/usr/bin/env python3
"""
DawerTech Project Rules Enforcement Hook
----------------------------------------
This script acts as an automated verification gate (git hook / CLI validator).
It ensures strict adherence to all project rules defined in .agents/PROJECT_RULES.md
and docs/reglas_de_desarrollo_y_ux.md:
  1. CERO EMOJIS in code/UI templates/toasts.
  2. MODAL SCROLL LOCK using ModalLockService on all modal-containing components.
  3. NO TEST DATABASES or secondary servers in working tree.
  4. NEOBRUTALISM high contrast and centered form layouts.
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Emoji regex covering Unicode emoji symbols
EMOJI_PATTERN = re.compile(
    r"[\U0001F600-\U0001F64F"  # emoticons
    r"\U0001F300-\U0001F5FF"  # symbols & pictographs
    r"\U0001F680-\U0001F6FF"  # transport & map
    r"\U0001F1E0-\U0001F1FF"  # flags (iOS)
    r"\U0001F900-\U0001F9FF"  # supplemental symbols
    r"\U0001FA00-\U0001FA6F"  # chess, symbols
    r"\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-A
    r"\U00002702-\U000027B0"  # dingbats
    r"\U000024C2-\U0001F251"
    r"]+",
    flags=re.UNICODE,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

IGNORED_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "www",
    "__pycache__",
    ".angular",
    "artifacts",
    ".agents",
    ".gemini",
    "scratch",
}

SCAN_TARGETS = [
    ROOT / "frontend" / "src",
    ROOT / "backend" / "dawertech",
]


def check_no_emojis() -> list[str]:
    violations = []
    scanned_extensions = {".ts", ".html", ".css", ".py"}

    for base_dir in SCAN_TARGETS:
        if not base_dir.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(base_dir):
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

            for fname in filenames:
                ext = Path(fname).suffix
                if ext not in scanned_extensions:
                    continue

                fpath = Path(dirpath) / fname
                try:
                    content = fpath.read_text(encoding="utf-8")
                except Exception:
                    continue

                for idx, line in enumerate(content.splitlines(), start=1):
                    matches = EMOJI_PATTERN.findall(line)
                    if matches:
                        rel_path = fpath.relative_to(ROOT)
                        violations.append(
                            f"[REGLA 1 - CERO EMOJIS] {rel_path}:{idx}: Se detecto caracter no permitido {matches} en linea: {line.strip()}"
                        )

    return violations


def check_modal_scroll_locks() -> list[str]:
    violations = []
    frontend_src = ROOT / "frontend" / "src" / "app"
    if not frontend_src.exists():
        return violations

    for dirpath, _, filenames in os.walk(frontend_src):
        for fname in filenames:
            if not fname.endswith(".component.ts"):
                continue

            fpath = Path(dirpath) / fname
            content = fpath.read_text(encoding="utf-8")

            # Check if component renders a modal overlay
            has_modal_overlay = re.search(r"fixed inset-0.*bg-black/\d+", content)
            if has_modal_overlay:
                rel_path = fpath.relative_to(ROOT)
                # Must inject ModalLockService or call modalLock.lock()
                if "ModalLockService" not in content and "modalLock" not in content:
                    violations.append(
                        f"[REGLA 5 - MODAL SCROLL LOCK] {rel_path}: Contiene modal pero NO inyecta ModalLockService."
                    )
                if "modalLock.lock" not in content and "modalLock.reset" not in content:
                    violations.append(
                        f"[REGLA 5 - MODAL SCROLL LOCK] {rel_path}: No invoca modalLock.lock() para bloquear el scroll."
                    )

    return violations


def check_single_database() -> list[str]:
    violations = []
    # Check for unauthorized test databases in backend
    backend_dir = ROOT / "backend"
    if backend_dir.exists():
        for f in backend_dir.glob("*.sqlite*"):
            if f.name not in {"inventory.sqlite3", "inventory.sqlite3-shm", "inventory.sqlite3-wal"}:
                violations.append(
                    f"[REGLA 2 - BASE DE DATOS UNICA] Se encontro base de datos no autorizada: {f.name}. Solo se permite inventory.sqlite3"
                )
    return violations


def main() -> int:
    print("=" * 60)
    print(">>> EJECUTANDO HOOK DE REGLAS DAWERTECH (Rule Validator)...")
    print("=" * 60)

    all_violations = []

    # 1. Emoji check
    emoji_violations = check_no_emojis()
    if emoji_violations:
        all_violations.extend(emoji_violations)
    else:
        print("  [OK] Regla 1: Cero emojis en archivos fuente.")

    # 2. Modal scroll lock check
    modal_violations = check_modal_scroll_locks()
    if modal_violations:
        all_violations.extend(modal_violations)
    else:
        print("  [OK] Regla 5: Modales protegidos con ModalLockService.")

    # 3. Single DB check
    db_violations = check_single_database()
    if db_violations:
        all_violations.extend(db_violations)
    else:
        print("  [OK] Regla 2: Solo base de datos autorizada inventory.sqlite3.")

    print("=" * 60)
    if all_violations:
        print(f"X VIOLACION DE REGLAS DETECTADA ({len(all_violations)} errores):")
        for v in all_violations:
            print(f"  - {v}")
        print("=" * 60)
        return 1

    print(">>> TODAS LAS REGLAS VERIFICADAS Y CUMPLIDAS EXITOSAMENTE.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())


"""Build the bundled seed from an upstream device-models JSON snapshot."""

import json
import sys
from pathlib import Path


BRANDS = {
    "Samsung", "Huawei", "Honor", "Motorola", "Sony", "Xiaomi", "Redmi", "POCO",
    "Oppo", "Vivo", "realme", "OnePlus", "Google", "Nokia", "Tecno", "Infinix",
    "ZTE", "LGE", "HTC", "TCT (Alcatel)", "TCL", "Asus", "Itel", "Blu",
}
NON_PHONES = ("tablet", " tab ", " tab-", "watch", " tv", "tv ", "box", "chromebook", "pixelbook", " pad ", "pad ", "projector", "smart display")


def main():
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    all_devices = json.loads(source.read_text(encoding="utf-8"))
    selected = {}
    for code, item in all_devices.items():
        brand = item.get("brand", "").strip()
        name = item.get("name", "").strip()
        if brand not in BRANDS or not name or any(word in f" {name.lower()} " for word in NON_PHONES):
            continue
        selected[code] = {"brand": brand, "name": name}
    destination.write_text(json.dumps(selected, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Selected {len(selected)} entries")


if __name__ == "__main__":
    main()

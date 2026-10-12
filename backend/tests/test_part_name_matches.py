from pathlib import Path

import pytest
from sqlalchemy import create_engine, literal, select, union_all
from sqlalchemy.orm import Session

from dawertech.modules.inventory.application import name_matches


@pytest.fixture
def catalog(monkeypatch):
    database = Path(__file__).resolve().parents[1] / "inventory.sqlite3"
    engine = create_engine(f"sqlite:///{database.as_uri()}?mode=ro&uri=true")
    # SELECT-only fixtures in the primary database connection; nothing is stored.
    rows = [
        (1, "BAT-001", "Batería Samsung A02", "Original", "Baterías", False),
        (2, "BAT-002", "  BATERIA   SAMSUNG A02 ", "AAA", "Baterías", False),
        (3, "BAT-003", "Batería Samsung A02", "Original", "Baterías", True),
        (4, "BAT-004", "Batería Samsung A02s", "Original", "Baterías", False),
        (5, "BAT-005", "Batería Samsung A20", "AAA", "Baterías", False),
    ]
    columns = ("id", "sku", "name", "variant", "category", "archived")
    records = union_all(*[
        select(*[literal(value).label(column) for column, value in zip(columns, row)])
        for row in rows
    ]).cte("parts")

    class CatalogSession:
        def __enter__(self):
            self.session = Session(engine)
            return self

        def __exit__(self, *_args):
            self.session.close()

        def execute(self, statement):
            return self.session.execute(statement.add_cte(records))

    monkeypatch.setattr(name_matches, "db_session", CatalogSession)
    yield
    engine.dispose()


@pytest.mark.parametrize("name", ["Batería Samsung A02", "BATERIA samsung a02", " bateria\t Samsung   A02 ", "Bateri\u0301a Samsung A02"])
def test_same_name_includes_other_qualities_and_archived_parts(catalog, name):
    result = name_matches.find_name_matches(name)
    assert {item["id"] for item in result["items"]} == {1, 2, 3}
    assert result["total"] == 3
    assert {item["variant"] for item in result["items"]} == {"Original", "AAA"}
    assert result["items"][-1]["archived"]


@pytest.mark.parametrize("name", ["Samsung A02", "Batería", "A02", "", "   "])
def test_partial_or_empty_names_are_not_reported_as_duplicates(catalog, name):
    assert name_matches.find_name_matches(name)["total"] == 0


def test_pagination_and_exclusion(catalog):
    first = name_matches.find_name_matches("bateria samsung a02", exclude_id=1, limit=1)
    second = name_matches.find_name_matches("bateria samsung a02", exclude_id=1, page=2, limit=1)
    assert first["total"] == second["total"] == 2
    assert [first["items"][0]["id"], second["items"][0]["id"]] == [2, 3]

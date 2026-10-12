from pathlib import Path

import pytest
from sqlalchemy import create_engine, literal, select, union_all
from sqlalchemy.orm import Session

from dawertech.modules.devices.application import device_service


@pytest.fixture
def catalog(monkeypatch):
    # Read-only access to the existing database. The CTE supplies rows only for
    # these SELECTs; no tables, devices, or separate databases are created.
    database = Path(__file__).resolve().parents[1] / "inventory.sqlite3"
    engine = create_engine(f"sqlite:///{database.as_uri()}?mode=ro&uri=true")
    rows = [
        (1, "Samsung", "Galaxy A02", "SM-A022"),
        (2, "Samsung", "Galaxy A02s", "SM-A025"),
        (3, "Samsung", "Galaxy A20", "SM-A205"),
        (4, "Apple", "iPhone 12", None),
        (5, "Nokia", "A02", None),
        (6, "Example", "100% Model_One", "CODE/01"),
        (7, "Samsung", "Galaxy A02", None),
    ]
    columns = ("id", "brand", "name", "code", "source", "image_name")
    devices = union_all(*[
        select(*[
            literal(value).label(column)
            for column, value in zip(columns, (*row, "fixture", None))
        ])
        for row in rows
    ]).cte("devices")

    class ReadOnlyCatalog:
        def __enter__(self):
            self.session = Session(engine)
            return self

        def __exit__(self, *_args):
            self.session.close()

        def scalar(self, query):
            return self.session.scalar(query.add_cte(devices))

        def scalars(self, query):
            return self.session.scalars(query.add_cte(devices))

    monkeypatch.setattr(device_service, "db_session", ReadOnlyCatalog)
    yield
    engine.dispose()


@pytest.mark.parametrize(("search", "expected"), [
    ("samsung a02", {1, 2, 7}),
    ("a02 samsung", {1, 2, 7}),
    ("  SAMSUNG\t  A02  ", {1, 2, 7}),
    ("Samsung SM-A022", {1}),
    ("samsung a02s", {2}),
    ("samsung a20", {3}),
    ("a02", {1, 2, 5, 7}),
    ("apple a02", set()),
    ("%", {6}),
    ("_", {6}),
    ("CODE/01", {6}),
    ("   ", {1, 2, 3, 4, 5, 6, 7}),
    ("", {1, 2, 3, 4, 5, 6, 7}),
])
def test_search_combines_fields_and_matches_literal_text(catalog, search, expected):
    result = device_service.list_devices_paged(search)
    assert {item["id"] for item in result["items"]} == expected
    assert result["total"] == len(expected)


def test_search_keeps_pagination_and_total_consistent(catalog):
    first = device_service.list_devices_paged("samsung a02", page=1, limit=2)
    second = device_service.list_devices_paged("samsung a02", page=2, limit=2)
    assert first["total"] == second["total"] == 3
    assert len(first["items"]) == 2
    assert len(second["items"]) == 1
    assert {item["id"] for item in first["items"] + second["items"]} == {1, 2, 7}
    assert first["page"] == 1 and second["page"] == 2
    assert first["limit"] == second["limit"] == 2


def test_search_respects_selected_ids(catalog):
    result = device_service.list_devices_paged("samsung a02", ids={2, 3})
    assert [item["id"] for item in result["items"]] == [2]
    assert result["total"] == 1

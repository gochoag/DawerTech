from dawertech.modules.inventory.infrastructure.orm_models import PartORM
from dawertech.modules.inventory.infrastructure.sqlite_repositories import SqliteSparePartRepository


class LockSession:
    def __init__(self):
        self.calls = []

    def get(self, model, ident, **options):
        self.calls.append((model, ident, options))
        return None


def test_active_part_locks_the_row_so_concurrent_movements_wait():
    session = LockSession()
    SqliteSparePartRepository(session).active_part(7)
    assert session.calls == [(PartORM, 7, {"with_for_update": True})]

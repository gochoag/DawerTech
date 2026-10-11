from dawertech.modules.inventory.application.dtos import part_data
from dawertech.modules.inventory.infrastructure.sqlite_repositories import SqliteSparePartRepository


class SearchCompatibilityUseCase:
    def __init__(self, repository: SqliteSparePartRepository | None = None):
        self.repository = repository or SqliteSparePartRepository()

    def execute(
        self,
        device_id: int | None = None,
        search_term: str | None = None,
        include_archived: bool = False,
        page: int = 1,
        limit: int = 30,
    ) -> dict:
        parts, total = self.repository.find_by_device_and_query(
            device_id=device_id,
            search_term=search_term,
            include_archived=include_archived,
            page=page,
            limit=limit,
        )
        stocks = self.repository.stocks_for([part.id for part in parts])
        items = [part_data(part, stocks.get(part.id, 0)) for part in parts]
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
        }



from abc import ABC, abstractmethod


class SparePartRepository(ABC):
    @abstractmethod
    def find_by_device_and_query(self, device_id: int | None = None, search_term: str | None = None, include_archived: bool = False, page: int = 1, limit: int = 30):
        pass

    @abstractmethod
    def get_by_id(self, part_id: int):
        pass

    @abstractmethod
    def stock(self, part_id: int) -> int:
        pass

    @abstractmethod
    def stocks_for(self, part_ids: list[int]) -> dict[int, int]:
        pass


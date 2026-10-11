class BusinessRuleException(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status = status
        self.details = details
        super().__init__(message)


class ApiProblem(BusinessRuleException):
    pass


class InventoryRuleError(BusinessRuleException):
    pass


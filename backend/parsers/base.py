"""Base types for statement parsers."""
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class StatementLine:
    date: str
    description: str
    reference: str
    amount: float
    debit: float
    credit: float
    balance: float
    currency: str = "PKR"


@dataclass
class StatementParseResult:
    lines: List[StatementLine]
    errors: List[str]
    opening_balance: Optional[float]
    closing_balance: Optional[float]

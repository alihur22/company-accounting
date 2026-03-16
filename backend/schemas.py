from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AccountBase(BaseModel):
    name: str
    category: str = Field(..., description="cash, current, investment, real_estate, fixed_asset, revenue, expense")
    currency: str = "PKR"


class AccountCreate(AccountBase):
    pass


class Account(AccountBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Entry ---


class EntryBase(BaseModel):
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    currency: str = "PKR"
    exchange_rate: Optional[float] = None
    memo: Optional[str] = None


class EntryCreate(EntryBase):
    pass


class Entry(EntryBase):
    id: int
    transaction_id: int
    account_id: int
    debit: float
    credit: float
    currency: str
    exchange_rate: Optional[float]
    memo: Optional[str]

    class Config:
        from_attributes = True


class EntryRead(BaseModel):
    id: int
    transaction_id: int
    account_id: int
    account_name: str
    account_currency: str
    debit: float
    credit: float
    currency: str
    exchange_rate: Optional[float]
    memo: Optional[str]

    class Config:
        from_attributes = True


class AttachmentRead(BaseModel):
    id: int
    transaction_id: int
    filename: str
    content_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Transaction ---


class TransactionBase(BaseModel):
    date: date
    description: str
    reference: Optional[str] = None


class TransactionCreate(TransactionBase):
    entries: List[EntryCreate]


class TransactionRead(TransactionBase):
    id: int
    created_at: datetime
    date: date
    description: str
    reference: Optional[str]
    entries: List[EntryRead] = []
    attachments: List[AttachmentRead] = []

    class Config:
        from_attributes = True


# --- Statement Import ---


class StatementLineSplit(BaseModel):
    amount: float
    account_id: int


class StatementLineApproved(BaseModel):
    date: str
    description: str
    reference: Optional[str] = None
    debit: float
    credit: float
    counter_account_id: Optional[int] = None
    splits: Optional[List[StatementLineSplit]] = None


class StatementCreateEntries(BaseModel):
    bank_account_id: int
    lines: List[StatementLineApproved]

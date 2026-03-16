from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    currency = Column(String, nullable=False, default="PKR")

    entries = relationship("Entry", back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    date = Column(Date, nullable=False, index=True)
    description = Column(String, nullable=False)
    reference = Column(String, nullable=True)

    entries = relationship("Entry", back_populates="transaction", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="transaction", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False, default="application/octet-stream")
    file_path = Column(String, nullable=False)  # relative path under upload dir

    transaction = relationship("Transaction", back_populates="attachments")


class Entry(Base):
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Float, nullable=False, default=0.0)
    credit = Column(Float, nullable=False, default=0.0)
    currency = Column(String, nullable=False, default="PKR")
    exchange_rate = Column(Float, nullable=True)  # to base currency if different
    memo = Column(String, nullable=True)

    transaction = relationship("Transaction", back_populates="entries")
    account = relationship("Account", back_populates="entries")

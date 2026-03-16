import secrets
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .config import ALLOWED_CONTENT_TYPES, MAX_ATTACHMENT_SIZE_MB, STATIC_DIR, UPLOAD_DIR
from .database import Base, engine, get_db
from .parsers.alhabib_csv import parse_alhabib_csv

Base.metadata.create_all(bind=engine)
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Company Accounting Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ACCOUNT_CATEGORIES = [
    "cash",
    "current",
    "investment",
    "real_estate",
    "fixed_asset",
    "revenue",
    "expense",
]
CURRENCIES = ["PKR", "USD", "AED"]


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/accounts", response_model=list[schemas.Account])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(models.Account).order_by(models.Account.category, models.Account.name).all()


@app.post("/api/accounts", response_model=schemas.Account)
def create_account(account_in: schemas.AccountCreate, db: Session = Depends(get_db)):
    if account_in.category not in ACCOUNT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of: {', '.join(ACCOUNT_CATEGORIES)}",
        )
    if account_in.currency not in CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"currency must be one of: {', '.join(CURRENCIES)}",
        )
    account = models.Account(
        name=account_in.name,
        category=account_in.category,
        currency=account_in.currency,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@app.get("/api/accounts/{account_id}", response_model=schemas.Account)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.put("/api/accounts/{account_id}", response_model=schemas.Account)
def update_account(
    account_id: int, account_in: schemas.AccountCreate, db: Session = Depends(get_db)
):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account_in.category not in ACCOUNT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of: {', '.join(ACCOUNT_CATEGORIES)}",
        )
    if account_in.currency not in CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"currency must be one of: {', '.join(CURRENCIES)}",
        )
    account.name = account_in.name
    account.category = account_in.category
    account.currency = account_in.currency
    db.commit()
    db.refresh(account)
    return account


@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"deleted": 1, "id": account_id}


@app.get("/api/config/account-categories")
def get_account_categories():
    return {"categories": ACCOUNT_CATEGORIES}


@app.get("/api/config/currencies")
def get_currencies():
    return {"currencies": CURRENCIES}


COMMON_EXPENSE_HEADS = [
    "Rent",
    "Utilities",
    "Payroll",
    "Office Supplies",
    "Marketing",
    "Insurance",
    "Travel",
    "Miscellaneous",
]


@app.post("/api/accounts/seed-expense-heads")
def seed_expense_heads(db: Session = Depends(get_db)):
    """Create common expense head accounts if they don't exist."""
    existing = {a.name.lower() for a in db.query(models.Account).filter(models.Account.category == "expense").all()}
    created = 0
    for name in COMMON_EXPENSE_HEADS:
        if name.lower() not in existing:
            account = models.Account(name=name, category="expense", currency="PKR")
            db.add(account)
            existing.add(name.lower())
            created += 1
    db.commit()
    return {"created": created, "names": COMMON_EXPENSE_HEADS}


# --- Transactions ---


def _create_transaction_internal(tx_in: schemas.TransactionCreate, db: Session) -> models.Transaction:
    """Create a transaction (used by both API and statement import)."""
    tx = models.Transaction(
        date=tx_in.date,
        description=tx_in.description,
        reference=tx_in.reference,
    )
    db.add(tx)
    db.flush()
    for e in tx_in.entries:
        entry = models.Entry(
            transaction_id=tx.id,
            account_id=e.account_id,
            debit=e.debit,
            credit=e.credit,
            currency=e.currency or "PKR",
            exchange_rate=e.exchange_rate,
            memo=e.memo,
        )
        db.add(entry)
    return tx


def _transaction_to_read(tx: models.Transaction) -> schemas.TransactionRead:
    entries = [
        schemas.EntryRead(
            id=e.id,
            transaction_id=e.transaction_id,
            account_id=e.account_id,
            account_name=e.account.name if e.account else "",
            account_currency=e.account.currency if e.account else "PKR",
            debit=e.debit,
            credit=e.credit,
            currency=e.currency,
            exchange_rate=e.exchange_rate,
            memo=e.memo,
        )
        for e in tx.entries
    ]
    attachments = [
        schemas.AttachmentRead(
            id=a.id,
            transaction_id=a.transaction_id,
            filename=a.filename,
            content_type=a.content_type,
            created_at=a.created_at,
        )
        for a in (tx.attachments or [])
    ]
    return schemas.TransactionRead(
        id=tx.id,
        created_at=tx.created_at,
        date=tx.date,
        description=tx.description,
        reference=tx.reference,
        entries=entries,
        attachments=attachments,
    )


@app.post("/api/transactions", response_model=schemas.TransactionRead)
def create_transaction(tx_in: schemas.TransactionCreate, db: Session = Depends(get_db)):
    if not tx_in.entries:
        raise HTTPException(status_code=400, detail="At least one entry required")

    total_debit = sum(e.debit for e in tx_in.entries)
    total_credit = sum(e.credit for e in tx_in.entries)
    if abs(total_debit - total_credit) > 0.001:
        raise HTTPException(
            status_code=400,
            detail=f"Debits ({total_debit}) must equal credits ({total_credit})",
        )

    # Validate accounts exist
    account_ids = {e.account_id for e in tx_in.entries}
    accounts = db.query(models.Account).filter(models.Account.id.in_(account_ids)).all()
    if len(accounts) != len(account_ids):
        raise HTTPException(status_code=400, detail="One or more account IDs invalid")

    tx = _create_transaction_internal(tx_in, db)
    db.commit()
    db.refresh(tx)
    tx = (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.entries).joinedload(models.Entry.account),
            joinedload(models.Transaction.attachments),
        )
        .filter(models.Transaction.id == tx.id)
        .first()
    )
    return _transaction_to_read(tx)


@app.get("/api/transactions", response_model=list[schemas.TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None, description="Filter from date YYYY-MM-DD"),
    to_date: Optional[date] = Query(None, description="Filter to date YYYY-MM-DD"),
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
):
    q = (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.entries).joinedload(models.Entry.account),
            joinedload(models.Transaction.attachments),
        )
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    )
    if from_date:
        q = q.filter(models.Transaction.date >= from_date)
    if to_date:
        q = q.filter(models.Transaction.date <= to_date)
    if account_id:
        q = q.join(models.Entry).filter(models.Entry.account_id == account_id).distinct()

    return [_transaction_to_read(tx) for tx in q.all()]


@app.get("/api/transactions/{tx_id}", response_model=schemas.TransactionRead)
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.entries).joinedload(models.Entry.account),
            joinedload(models.Transaction.attachments),
        )
        .filter(models.Transaction.id == tx_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _transaction_to_read(tx)


@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.attachments))
        .filter(models.Transaction.id == tx_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for a in tx.attachments:
        path = Path(UPLOAD_DIR) / a.file_path
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass
    db.delete(tx)
    db.commit()
    return {"deleted": 1, "id": tx_id}


# --- Attachments ---

MAX_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024


@app.post("/api/transactions/{tx_id}/attachments", response_model=schemas.AttachmentRead)
async def upload_attachment(
    tx_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an invoice, receipt, or other evidence for a transaction."""
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not file.filename or not file.filename.strip():
        raise HTTPException(status_code=400, detail="Filename required")
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Use PDF or images (JPEG, PNG, WebP, GIF). Got: {content_type}",
        )
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {MAX_ATTACHMENT_SIZE_MB} MB.",
        )
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ").strip() or "file"
    ext = Path(file.filename).suffix or ""
    if ext and ext not in safe_name:
        safe_name += ext
    unique = secrets.token_hex(8)
    rel_path = f"{tx_id}_{unique}_{safe_name}"
    full_path = Path(UPLOAD_DIR) / rel_path
    full_path.write_bytes(content)
    att = models.Attachment(
        transaction_id=tx_id,
        filename=file.filename,
        content_type=content_type,
        file_path=rel_path,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return schemas.AttachmentRead(
        id=att.id,
        transaction_id=att.transaction_id,
        filename=att.filename,
        content_type=att.content_type,
        created_at=att.created_at,
    )


@app.get("/api/attachments/{att_id}/download")
def download_attachment(att_id: int, db: Session = Depends(get_db)):
    att = db.query(models.Attachment).filter(models.Attachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    path = Path(UPLOAD_DIR) / att.file_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        filename=att.filename,
        media_type=att.content_type,
    )


@app.delete("/api/attachments/{att_id}")
def delete_attachment(att_id: int, db: Session = Depends(get_db)):
    att = db.query(models.Attachment).filter(models.Attachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    path = Path(UPLOAD_DIR) / att.file_path
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass
    db.delete(att)
    db.commit()
    return {"deleted": 1, "id": att_id}


# --- Statement Import ---


@app.post("/api/statements/parse")
async def parse_statement(file: UploadFile = File(...)):
    """Parse Bank Al Habib CSV statement. Returns lines for review before creating entries."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV file required")
    content = await file.read()
    result = parse_alhabib_csv(content)
    return {
        "lines": [
            {
                "date": line.date,
                "description": line.description,
                "reference": line.reference,
                "amount": line.amount,
                "debit": line.debit,
                "credit": line.credit,
                "balance": line.balance,
                "currency": line.currency,
            }
            for line in result.lines
        ],
        "errors": result.errors,
        "opening_balance": result.opening_balance,
        "closing_balance": result.closing_balance,
    }


@app.post("/api/statements/create-entries")
def create_entries_from_statement(
    data: schemas.StatementCreateEntries, db: Session = Depends(get_db)
):
    """Create ledger transactions from approved statement lines."""
    bank = db.query(models.Account).filter(models.Account.id == data.bank_account_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    created = 0
    for line in data.lines:
        entries = []
        if line.splits and len(line.splits) > 0:
            total = sum(s.amount for s in line.splits)
            if abs(total - (line.debit or line.credit)) > 0.001:
                continue
            for s in line.splits:
                if not s.account_id or s.amount <= 0:
                    continue
                acc = db.query(models.Account).filter(models.Account.id == s.account_id).first()
                if not acc:
                    continue
                if line.debit > 0:
                    entries.append(
                        schemas.EntryCreate(
                            account_id=s.account_id,
                            debit=s.amount,
                            credit=0,
                            memo=line.reference or None,
                        )
                    )
                else:
                    entries.append(
                        schemas.EntryCreate(
                            account_id=s.account_id,
                            debit=0,
                            credit=s.amount,
                            memo=line.reference or None,
                        )
                    )
            if line.debit > 0:
                entries.append(
                    schemas.EntryCreate(
                        account_id=data.bank_account_id,
                        debit=0,
                        credit=total,
                        memo=line.reference or None,
                    )
                )
            else:
                entries.append(
                    schemas.EntryCreate(
                        account_id=data.bank_account_id,
                        debit=total,
                        credit=0,
                        memo=line.reference or None,
                    )
                )
        elif line.counter_account_id:
            counter = (
                db.query(models.Account)
                .filter(models.Account.id == line.counter_account_id)
                .first()
            )
            if not counter:
                continue
            if line.debit > 0:
                entries.append(
                    schemas.EntryCreate(
                        account_id=line.counter_account_id,
                        debit=line.debit,
                        credit=0,
                        memo=line.reference or None,
                    )
                )
                entries.append(
                    schemas.EntryCreate(
                        account_id=data.bank_account_id,
                        debit=0,
                        credit=line.debit,
                        memo=line.reference or None,
                    )
                )
            elif line.credit > 0:
                entries.append(
                    schemas.EntryCreate(
                        account_id=data.bank_account_id,
                        debit=line.credit,
                        credit=0,
                        memo=line.reference or None,
                    )
                )
                entries.append(
                    schemas.EntryCreate(
                        account_id=line.counter_account_id,
                        debit=0,
                        credit=line.credit,
                        memo=line.reference or None,
                    )
                )
            else:
                continue
        else:
            continue

        if not entries:
            continue
        tx_in = schemas.TransactionCreate(
            date=line.date,
            description=line.description or "Statement import",
            reference=line.reference,
            entries=entries,
        )
        _create_transaction_internal(tx_in, db)
        created += 1
    db.commit()

    return {"created": created}


# --- Static files (production) ---

if STATIC_DIR and Path(STATIC_DIR).exists():
    assets_dir = Path(STATIC_DIR) / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for non-API routes."""
        index_path = Path(STATIC_DIR) / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        raise HTTPException(status_code=404, detail="Not found")

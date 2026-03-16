"""Parser for Bank Al Habib statement CSV format."""
import csv
import io
from datetime import datetime
from typing import List, Optional

from .base import StatementLine, StatementParseResult


def _parse_date(s: str) -> Optional[str]:
    """Parse '13 Mar 2026' to '2026-03-13'."""
    s = (s or "").strip()
    if not s:
        return None
    try:
        dt = datetime.strptime(s, "%d %b %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    try:
        dt = datetime.strptime(s, "%d %B %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    return None


def parse_alhabib_csv(content: bytes) -> StatementParseResult:
    """
    Parse Bank Al Habib statement CSV.
    Format: Row 1 = account info, Row 2 = opening, Row 3 = closing, Row 4 = header, Row 5+ = data
    Columns: Date, Description, Reference Number, Currency, Amount, Cr/Dr, Currency, Balance
    """
    lines: List[StatementLine] = []
    errors: List[str] = []
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None

    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        return StatementParseResult(lines=[], errors=[str(e)], opening_balance=None, closing_balance=None)

    if len(rows) < 5:
        return StatementParseResult(
            lines=[],
            errors=["File has too few rows"],
            opening_balance=None,
            closing_balance=None,
        )

    # Row 2: Opening Balance,PKR amount
    if len(rows[1]) >= 2:
        try:
            ob_str = rows[1][1].replace("PKR", "").replace(",", "").strip()
            opening_balance = float(ob_str)
        except (ValueError, IndexError):
            pass

    # Row 3: Closing Balance,PKR amount
    if len(rows[2]) >= 2:
        try:
            cb_str = rows[2][1].replace("PKR", "").replace(",", "").strip()
            closing_balance = float(cb_str)
        except (ValueError, IndexError):
            pass

    # Row 4 is header, data starts row 5
    # Description may contain commas, so parse from right: Balance, Currency, Cr/Dr, Amount are last 4
    for i, row in enumerate(rows[4:], start=5):
        if len(row) < 5:
            if any(cell.strip() for cell in row):
                errors.append(f"Row {i}: insufficient columns")
            continue

        date_str = _parse_date(row[0])
        # Last 4 cols: Amount, Cr/Dr, Currency, Balance (Description may have commas)
        amount_str = (row[-4] or "0").replace(",", "").strip()
        cr_dr = (row[-3] or "").strip().upper()
        balance_str = (row[-1] or "0").replace(",", "").strip()
        # Middle: Description (may have commas), Reference, Currency before Amount
        mid = row[1:-4]
        if len(mid) >= 2:
            reference = (mid[-2] or "").strip()  # ref before currency
            description = ",".join(mid[:-2]).strip()
        elif len(mid) == 1:
            description = (mid[0] or "").strip()
            reference = ""
        else:
            description = ""
            reference = ""

        try:
            amount = float(amount_str)
        except ValueError:
            errors.append(f"Row {i}: invalid amount '{amount_str}'")
            continue

        try:
            balance = float(balance_str)
        except ValueError:
            balance = 0.0

        if cr_dr not in ("DR", "CR"):
            errors.append(f"Row {i}: invalid Cr/Dr '{cr_dr}'")
            continue

        debit = amount if cr_dr == "DR" else 0.0
        credit = amount if cr_dr == "CR" else 0.0

        lines.append(
            StatementLine(
                date=date_str or "",
                description=description,
                reference=reference,
                amount=amount,
                debit=debit,
                credit=credit,
                balance=balance,
                currency="PKR",
            )
        )

    return StatementParseResult(
        lines=lines,
        errors=errors[:20],
        opening_balance=opening_balance,
        closing_balance=closing_balance,
    )

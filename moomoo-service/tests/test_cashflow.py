"""Layer 1 (Python) — bridge cash-flow logic for /cashflow.

Tests the pure window + parse helpers (cashflow_logic) without OpenD/moomoo.
Grounding: moomoo get_acc_cash_flow requires clearing_date and is queried one
day at a time; cashflow_direction is the authoritative IN/OUT enum;
cashflow_amount is signed. The bridge is passthrough (no categorisation/FX/dedup).

Run: pytest moomoo-service/tests/test_cashflow.py
"""
import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cashflow_logic import cashflow_query_dates, coerce_float, parse_cashflow_row  # noqa: E402


# ── Window (60-day, weekdays only, one day per query) ──────────────────────
def _parse(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def test_window_contains_only_weekdays():
    dates = cashflow_query_dates(60, date(2026, 6, 1))
    assert all(_parse(d).weekday() < 5 for d in dates)


def test_window_descending_and_unique():
    dates = cashflow_query_dates(60, date(2026, 6, 1))
    assert dates == sorted(dates, reverse=True)
    assert len(dates) == len(set(dates))


def test_window_bounds_60_days():
    today = date(2026, 6, 1)
    dates = [_parse(d) for d in cashflow_query_dates(60, today)]
    # Newest is today (if weekday) or earlier; oldest is within the 60-day window.
    assert max(dates) <= today
    assert min(dates) >= today - timedelta(days=59)
    # The day just outside the window must never appear.
    beyond = (today - timedelta(days=60)).strftime("%Y-%m-%d")
    assert beyond not in cashflow_query_dates(60, today)


def test_window_excludes_weekend_days():
    today = date(2026, 6, 1)
    result = cashflow_query_dates(60, today)
    # Find a Saturday and a Sunday within the range and assert they're excluded.
    for i in range(60):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:
            assert d.strftime("%Y-%m-%d") not in result


def test_window_count_matches_weekday_count():
    today = date(2026, 6, 1)
    expected = sum(1 for i in range(60) if (today - timedelta(days=i)).weekday() < 5)
    assert len(cashflow_query_dates(60, today)) == expected


def test_window_boundary_includes_oldest_weekday_in_range():
    # days=1 → only today, and only if today is a weekday.
    monday = date(2026, 6, 1)  # used as a reference 'today'
    one = cashflow_query_dates(1, monday)
    assert one == ([monday.strftime("%Y-%m-%d")] if monday.weekday() < 5 else [])


# ── coerce_float (tolerant) ────────────────────────────────────────────────
def test_coerce_float_handles_null_blank_and_bad():
    assert coerce_float(None) == 0.0
    assert coerce_float("") == 0.0
    assert coerce_float("N\\A") == 0.0
    assert coerce_float("abc") == 0.0
    assert coerce_float("12.5") == 12.5
    assert coerce_float(0) == 0.0


def test_coerce_float_preserves_sign():
    assert coerce_float(-9.0) == -9.0
    assert coerce_float("-200") == -200.0


# ── parse_cashflow_row (passthrough, no categorisation/FX) ──────────────────
def test_parse_passthrough_full_row():
    row = {
        "cashflow_id": 36904,
        "clearing_date": "2026-05-29",
        "settlement_date": "2026-06-01",
        "currency": "USD",
        "cashflow_type": "Fund Dividend",
        "cashflow_direction": "IN",
        "cashflow_amount": 1.99,
        "cashflow_remark": "Fund Cash Dividend",
    }
    out = parse_cashflow_row(row, "2026-05-29")
    assert out["cashflow_id"] == "36904"
    assert out["cashflow_direction"] == "IN"
    assert out["cashflow_type"] == "Fund Dividend"
    assert out["currency"] == "USD"
    assert out["amount"] == 1.99
    assert out["remark"] == "Fund Cash Dividend"


def test_parse_preserves_negative_signed_amount():
    out = parse_cashflow_row(
        {"cashflow_direction": "OUT", "cashflow_amount": -9.0, "currency": "USD"}, "2026-05-29"
    )
    assert out["amount"] == -9.0
    assert out["cashflow_direction"] == "OUT"


def test_parse_defaults_for_missing_fields():
    out = parse_cashflow_row({}, "2026-05-29")
    assert out["currency"] == "USD"      # default
    assert out["amount"] == 0.0          # coerced
    assert out["cashflow_direction"] == ""  # unknown direction (not invented)
    assert out["cashflow_type"] == ""
    assert out["clearing_date"] == "2026-05-29"  # falls back to queried date


def test_parse_malformed_amount_becomes_zero_not_crash():
    out = parse_cashflow_row({"cashflow_amount": "not-a-number"}, "2026-05-29")
    assert out["amount"] == 0.0


def test_parse_does_not_dedup_rows():
    # The bridge is passthrough — dedup is NOT performed here (documented).
    rows = [
        {"cashflow_id": 1, "cashflow_amount": 10, "cashflow_direction": "IN"},
        {"cashflow_id": 1, "cashflow_amount": 10, "cashflow_direction": "IN"},
    ]
    parsed = [parse_cashflow_row(r, "2026-05-29") for r in rows]
    assert len(parsed) == 2  # both kept; no dedup at this layer

"""Pure helpers for company plate membership (knowledge graph).

OpenD-free so they can be unit-tested without the moomoo SDK, matching the
options_logic / cashflow_logic pattern. The endpoint in main.py wires a real
OpenQuoteContext.get_owner_plate call into collect_plate_membership.
"""
from typing import Any, Callable

KEEP_TYPES = ("INDUSTRY", "CONCEPT")


def chunk_codes(codes: list[str], size: int = 200) -> list[list[str]]:
    return [codes[i:i + size] for i in range(0, len(codes), size)]


def _normalize_plate_row(row: dict[str, Any]) -> dict[str, str]:
    return {
        "stock_code": str(row.get("code") or "").upper(),
        "plate_code": str(row.get("plate_code") or ""),
        "plate_name": str(row.get("plate_name") or ""),
        "plate_type": str(row.get("plate_class") or row.get("plate_type") or "").upper(),
    }


def group_plate_membership(
    rows: list[dict[str, Any]], keep_types: tuple[str, ...] = KEEP_TYPES
) -> dict[str, list[dict[str, str]]]:
    """Group raw get_owner_plate rows into {stock_code: [{plate_code, plate_name, plate_type}]}."""
    out: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        n = _normalize_plate_row(row)
        if n["plate_type"] not in keep_types:
            continue
        if not n["stock_code"] or not n["plate_code"]:
            continue
        out.setdefault(n["stock_code"], []).append(
            {"plate_code": n["plate_code"], "plate_name": n["plate_name"], "plate_type": n["plate_type"]}
        )
    return out


def collect_plate_membership(
    fetch_fn: Callable[[list[str]], tuple[bool, list[dict[str, Any]]]],
    codes: list[str],
    keep_types: tuple[str, ...] = KEEP_TYPES,
    max_per_req: int = 200,
) -> dict[str, list[dict[str, str]]]:
    """Collect plate membership, splitting a batch on failure to skip unsupported codes.

    fetch_fn(codes) -> (ok, rows). Respects max_per_req (moomoo: 200 stocks/request).
    """
    membership: dict[str, list[dict[str, str]]] = {}

    def _recurse(batch: list[str]) -> None:
        if not batch:
            return
        ok, rows = fetch_fn(batch)
        if ok:
            for code, plates in group_plate_membership(rows, keep_types).items():
                membership.setdefault(code, []).extend(plates)
        elif len(batch) == 1:
            return  # single unsupported code — skip silently
        else:
            mid = len(batch) // 2
            _recurse(batch[:mid])
            _recurse(batch[mid:])

    for chunk in chunk_codes(codes, max_per_req):
        _recurse(chunk)
    return membership

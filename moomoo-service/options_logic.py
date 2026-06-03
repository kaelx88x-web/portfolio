"""Pure, dependency-free option math extracted from main.py so it can be
unit-tested without OpenD / the moomoo SDK (audit §9).

Grounding (US equity options via moomoo get_option_chain):
 - Contract multiplier is 100 shares per contract.
 - Cash-secured put collateral = strike * 100 * contracts (cash that must be
   reserved to buy the shares if assigned).
 - Covered call requires owning 100 shares per contract (not cash collateral).
 - moomoo fields: strike_price, option_type ('CALL'/'PUT'), delta, bid_price,
   ask_price. delta sign is negative for puts; we band on |delta|.

Every helper is pure: same inputs → same outputs, no I/O.
"""
from __future__ import annotations

from typing import Any, Optional

CONTRACT_MULTIPLIER = 100


def _safe_float(value: Any) -> float:
    """Tolerant float coercion mirroring main.py's `_f` (so this module stays
    dependency-free and testable without importing main)."""
    try:
        if value in (None, "", "N\\A"):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def normalize_chain_row(r: dict[str, Any]) -> dict[str, Any]:
    """Map a raw moomoo `get_option_chain` record — which uses `strike_price`,
    `bid_price`, `ask_price`, and an uppercase `option_type` — onto the
    normalized field names every helper here expects (`strike`, `bid`, `ask`,
    lowercase `option_type`). Pure, so the spread/candidate pipeline can be
    exercised end-to-end in tests without OpenD. /options/chain and
    /options/spread-candidates both go through this, so the field names can't
    drift apart between the two endpoints."""
    return {
        "code": r.get("code"),
        "option_type": str(r.get("option_type", "")).lower(),
        "strike": _safe_float(r.get("strike_price")),
        "last_price": _safe_float(r.get("last_price")),
        "bid": _safe_float(r.get("bid_price")),
        "ask": _safe_float(r.get("ask_price")),
        "volume": r.get("volume"),
        "open_interest": r.get("open_interest"),
        "implied_volatility": _safe_float(r.get("implied_volatility")),
        "delta": _safe_float(r.get("delta")),
        "gamma": _safe_float(r.get("gamma")),
        "theta": _safe_float(r.get("theta")),
        "vega": _safe_float(r.get("vega")),
    }


def option_mid(bid: float, ask: float) -> float:
    """Mid price; falls back to bid when ask is missing/zero (mirrors main.py)."""
    b = bid or 0.0
    a = ask or b
    return round((b + a) / 2, 4)


def put_collateral(strike: float, contracts: int = 1) -> float:
    """Cash-secured put collateral = strike * 100 * contracts."""
    return round(strike * CONTRACT_MULTIPLIER * contracts, 2)


def covered_call_shares_required(contracts: int = 1) -> int:
    """A covered call must be backed by 100 shares per contract."""
    return CONTRACT_MULTIPLIER * contracts


def covered_call_collateral_value(underlying_price: float, contracts: int = 1) -> float:
    """Capital tied up in the 100 shares/contract backing a covered call."""
    return round((underlying_price or 0.0) * CONTRACT_MULTIPLIER * contracts, 2)


def premium_yield_pct(mid: float, strike: float) -> Optional[float]:
    """Premium yield as a % of strike; None when strike is falsy (no divide-by-0)."""
    if not strike:
        return None
    return round(mid / strike * 100, 4)


def long_option_max_loss(premium: float, contracts: int = 1) -> float:
    """Max loss on a long call/put = premium paid (per share) * 100 * contracts.
    A long option's downside is capped at the debit paid."""
    return round((premium or 0.0) * CONTRACT_MULTIPLIER * contracts, 2)


def csp_max_loss_if_assigned(strike: float, premium_received: float, contracts: int = 1) -> float:
    """Worst case for a cash-secured put (underlying → 0): assigned at `strike`,
    keep the premium. = (strike - premium) * 100 * contracts, floored at 0."""
    per_share = max(0.0, (strike or 0.0) - (premium_received or 0.0))
    return round(per_share * CONTRACT_MULTIPLIER * contracts, 2)


def vertical_spread_max_loss(width: float, net: float, is_debit: bool, contracts: int = 1) -> float:
    """Max loss for a vertical spread.
      debit spread:  net debit paid * 100
      credit spread: (width - net credit) * 100
    """
    per_share = net if is_debit else max(0.0, (width or 0.0) - (net or 0.0))
    return round(per_share * CONTRACT_MULTIPLIER * contracts, 2)


def vertical_spread_max_profit(width: float, net: float, is_debit: bool, contracts: int = 1) -> float:
    """Max profit for a vertical spread.
      debit spread:  (width - net debit) * 100
      credit spread: net credit received * 100
    """
    per_share = max(0.0, (width or 0.0) - (net or 0.0)) if is_debit else net
    return round(per_share * CONTRACT_MULTIPLIER * contracts, 2)


def in_delta_band(delta: float, lo: float = 0.2, hi: float = 0.45) -> bool:
    """The candidate-screening band used by options_candidates: |delta| in [lo, hi]
    and delta non-zero. Mirrors `delta and 0.2 <= abs(delta) <= 0.45`."""
    if not delta:
        return False
    return lo <= abs(delta) <= hi


def candidate_strategy(option_type: str, delta: float, mode: str = "both") -> Optional[str]:
    """Classify a chain row into 'covered_call' / 'cash_secured_put' / None,
    matching the is_cc / is_csp screen in options_candidates."""
    t = str(option_type or "").lower()
    if not in_delta_band(delta):
        return None
    if mode in ("cc", "both") and t.startswith("c"):
        return "covered_call"
    if mode in ("csp", "both") and t.startswith("p"):
        return "cash_secured_put"
    return None


def assignment_risk(option_type: str, underlying_price: float, strike: float) -> str:
    """Qualitative assignment risk from moneyness.
      call: ITM (and thus assignment-prone) when underlying > strike
      put:  ITM when underlying < strike
    Returns 'high' (ITM), 'moderate' (within 2% of strike), else 'low'.
    'unknown' when we lack an underlying price (never invented)."""
    t = str(option_type or "").lower()
    if not underlying_price or not strike:
        return "unknown"
    itm = (underlying_price > strike) if t.startswith("c") else (underlying_price < strike)
    if itm:
        return "high"
    if abs(underlying_price - strike) / strike <= 0.02:
        return "moderate"
    return "low"


def enrich_candidate(row: dict[str, Any], underlying_price: Optional[float]) -> dict[str, Any]:
    """Additive risk/collateral fields layered onto a screened candidate so the
    UI can satisfy §9 (assignment risk, collateral, shares, max loss). Never
    invents data — returns None where an input is missing."""
    strategy = row.get("strategy")
    strike = row.get("strike") or 0.0
    mid = row.get("mid") or 0.0
    if strategy == "cash_secured_put":
        return {
            "shares_required": None,
            "collateral_per_contract": put_collateral(strike),
            "assignment_risk": assignment_risk("put", underlying_price or 0.0, strike),
            "max_loss_per_contract": csp_max_loss_if_assigned(strike, mid),
        }
    # covered call
    return {
        "shares_required": covered_call_shares_required(),
        "collateral_per_contract": put_collateral(strike),  # strike notional (unchanged field)
        "underlying_collateral_value": covered_call_collateral_value(underlying_price or 0.0),
        "assignment_risk": assignment_risk("call", underlying_price or 0.0, strike),
    }


def spread_candidates(chain: list[dict[str, Any]], strategy: str = "bull_put", width: float = 0.5) -> list[dict[str, Any]]:
    """Pair two legs of the same type into a vertical credit spread and price it
    with the existing vertical_spread_* helpers. Currently supports 'bull_put'
    (sell higher-strike put, buy lower-strike put) and 'bear_call' (sell lower
    call, buy higher call). Pure: takes a chain, returns candidate dicts."""
    is_put = strategy == "bull_put"
    legs = [r for r in chain if str(r.get("option_type", "")).lower().startswith("p" if is_put else "c")]
    by_strike = {round(float(r.get("strike") or 0), 2): r for r in legs}
    out: list[dict[str, Any]] = []
    for strike, short_leg in by_strike.items():
        # credit spread: long leg is `width` further OTM
        long_strike = round(strike - width, 2) if is_put else round(strike + width, 2)
        long_leg = by_strike.get(long_strike)
        if not long_leg:
            continue
        short_mid = option_mid(short_leg.get("bid") or 0, short_leg.get("ask") or 0)
        long_mid = option_mid(long_leg.get("bid") or 0, long_leg.get("ask") or 0)
        net_credit = round(short_mid - long_mid, 4)
        if net_credit <= 0:
            continue
        out.append({
            "strategy": strategy,
            "short_strike": strike,
            "long_strike": long_strike,
            "width": round(width, 2),
            "net_credit": net_credit,
            "max_profit": vertical_spread_max_profit(width, net_credit, is_debit=False),
            "max_loss": vertical_spread_max_loss(width, net_credit, is_debit=False),
            "short_delta": short_leg.get("delta"),
        })
    out.sort(key=lambda x: x["max_profit"], reverse=True)
    return out

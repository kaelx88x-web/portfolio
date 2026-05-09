import os
import re
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

OPEND_HOST = os.getenv("MOOMOO_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("MOOMOO_OPEND_PORT", "11111"))

app = FastAPI(title="Portfolio Moomoo Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "moomoo-bridge", "version": "1.0.0"}


@app.get("/status")
def status():
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        return {
            "connected": False,
            "quote_logged_in": False,
            "trade_logged_in": False,
            "host": OPEND_HOST,
            "port": OPEND_PORT,
            "message": "moomoo-api is not installed.",
        }

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1, conn_timeout=3)
        ret, data = ctx.get_global_state()
        if ret != RET_OK:
            return {"connected": False, "quote_logged_in": False, "trade_logged_in": False,
                    "host": OPEND_HOST, "port": OPEND_PORT, "message": str(data)}
        return {
            "connected": True,
            "quote_logged_in": bool(data.get("qot_logined")),
            "trade_logged_in": bool(data.get("trd_logined")),
            "host": OPEND_HOST,
            "port": OPEND_PORT,
            "server_version": data.get("server_ver"),
            "markets": {
                "hk": data.get("market_hk"),
                "us": data.get("market_us"),
                "sh": data.get("market_sh"),
                "sz": data.get("market_sz"),
            },
            "message": "OpenD is connected.",
        }
    except Exception as exc:
        return {"connected": False, "quote_logged_in": False, "trade_logged_in": False,
                "host": OPEND_HOST, "port": OPEND_PORT, "message": str(exc)}
    finally:
        if ctx is not None:
            ctx.close()


@app.post("/sync")
def sync(prefer_real: bool = True):
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    firms = [
        SecurityFirm.FUTUINC,
        SecurityFirm.FUTUMY,
        SecurityFirm.FUTUSG,
        SecurityFirm.FUTUSECURITIES,
        SecurityFirm.FUTUAU,
        SecurityFirm.FUTUCA,
        SecurityFirm.FUTUJP,
    ]

    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, accounts = ctx.get_acc_list()
            if ret != RET_OK:
                continue
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue

            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            ret, positions = ctx.position_list_query(
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
                refresh_cache=True,
            )
            if ret != RET_OK:
                continue

            ret, acc_info = ctx.accinfo_query(
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
                refresh_cache=True,
                currency="USD",
            )

            holdings = _parse_positions(positions)
            account_info = _parse_acc_info(acc_info if ret == RET_OK else None)

            return {
                "account_label": "Moomoo Live" if trd_env == TrdEnv.REAL else "Moomoo Simulated",
                "trade_environment": str(account.get("trd_env")),
                "security_firm": str(firm),
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "holdings_count": len(holdings),
                "holdings": holdings,
                "account_info": account_info,
            }
        except Exception:
            continue
        finally:
            if ctx is not None:
                ctx.close()

    raise HTTPException(status_code=400, detail="No active Moomoo account available from OpenD.")


def _select_account(accounts, prefer_real: bool):
    if accounts is None or len(accounts) == 0:
        return None
    active = accounts[accounts["acc_status"] == "ACTIVE"]
    if active.empty:
        return None
    order = ["REAL", "SIMULATE"] if prefer_real else ["SIMULATE", "REAL"]
    for env in order:
        matches = active[active["trd_env"] == env]
        if not matches.empty:
            return matches.iloc[0].to_dict()
    return active.iloc[0].to_dict()


def _parse_positions(positions) -> list[dict[str, Any]]:
    if positions is None or not hasattr(positions, "to_dict"):
        return []
    rows = []
    for row in positions.to_dict("records"):
        qty = _f(row.get("qty"))
        if qty == 0:
            continue
        avg_cost = _f(row.get("cost_price")) or _f(row.get("average_cost"))
        market_price = _f(row.get("nominal_price"))
        market_value = _f(row.get("market_val"))
        unrealized_pl = _f(row.get("pl_val")) or _f(row.get("unrealized_pl"))
        unrealized_pl_pct = _f(row.get("pl_ratio"))
        symbol = str(row.get("code") or "").upper()
        rows.append({
            "symbol": symbol,
            "asset_type": _asset_type(symbol),
            "quantity": qty,
            "average_cost": avg_cost,
            "total_cost": qty * avg_cost,
            "market_price": market_price,
            "market_value": market_value,
            "unrealized_pl": unrealized_pl,
            "unrealized_pl_percent": unrealized_pl_pct,
            "currency": str(row.get("currency") or "USD"),
        })
    return rows


def _parse_acc_info(acc_info) -> dict[str, float]:
    if acc_info is None or len(acc_info) == 0:
        return {}
    row = acc_info.iloc[0].to_dict()
    keys = ["total_assets", "securities_assets", "cash", "market_val", "unrealized_pl", "realized_pl"]
    return {k: _f(row.get(k)) for k in keys}


def _asset_type(symbol: str) -> str:
    ticker = symbol.split(".", 1)[-1]
    return "option" if re.search(r"\d{6}[CP]\d+$", ticker) else "stock"


def _f(value: Any) -> float:
    try:
        if value in (None, "", "N/A"):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)

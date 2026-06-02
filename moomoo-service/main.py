import concurrent.futures
import math
import os
import re
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

APPDATA_DIR = os.path.join(os.path.dirname(__file__), ".runtime", "appdata")
os.makedirs(APPDATA_DIR, exist_ok=True)
os.environ.setdefault("appdata", APPDATA_DIR)
os.environ.setdefault("APPDATA", APPDATA_DIR)

OPEND_HOST = os.getenv("MOOMOO_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("MOOMOO_OPEND_PORT", "11111"))
MOOMOO_ENV = os.getenv("MOOMOO_ENV", "paper")
MOOMOO_READ_ONLY = os.getenv("MOOMOO_READ_ONLY", "true").lower() != "false"
MOOMOO_TRADE_UNLOCK_PWD = os.getenv("MOOMOO_TRADE_UNLOCK_PWD", "")

app = FastAPI(title="Portfolio Moomoo Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecutionOrderRequest(BaseModel):
    symbol: str
    side: str
    order_type: str = "limit"
    quantity: float
    price: float | None = None
    trade_env: str = "SIMULATE"
    mode: str = "paper"
    acc_id: str | int | None = None
    client_order_id: str | None = None
    source_ticket_id: str | None = None
    dry_run: bool = False


class CancelOrderRequest(BaseModel):
    mode: str = "paper"


@app.get("/")
def root():
    return {"service": "moomoo-bridge", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "moomoo-bridge", "version": "1.0.0"}


def _check_opend_status() -> dict[str, Any]:
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
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
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


@app.get("/status")
def status():
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_check_opend_status)
        try:
            return future.result(timeout=4)
        except concurrent.futures.TimeoutError:
            return {
                "connected": False,
                "quote_logged_in": False,
                "trade_logged_in": False,
                "host": OPEND_HOST,
                "port": OPEND_PORT,
                "message": "OpenD connection timed out.",
            }


@app.get("/accounts")
def accounts():
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdMarket
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
    # Query with no filter + each market so firm-specific accounts (MYR/SGD/HKD) surface
    trade_markets = [None, TrdMarket.US, TrdMarket.HK]

    seen: set[str] = set()
    all_accounts = []

    for firm in firms:
        for trd_market in trade_markets:
            ctx = None
            try:
                if trd_market is None:
                    ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
                else:
                    ctx = OpenSecTradeContext(filter_trdmarket=trd_market, host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
                ret, acc_list = ctx.get_acc_list()
                if ret != RET_OK or acc_list is None or acc_list.empty:
                    continue
                for row in acc_list.to_dict("records"):
                    trd_env = str(row.get("trd_env", ""))
                    sim_acc_type = str(row.get("sim_acc_type") or "")
                    acc_id = str(row.get("acc_id"))
                    # Deduplicate: same account surfaces through multiple firm+market combos
                    dedup_key = f"{acc_id}:{trd_env}:{sim_acc_type}"
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    acc_status = str(row.get("acc_status", ""))
                    uni_card_num = str(row.get("uni_card_num") or row.get("card_num") or "")
                    trdmarket_auth = row.get("trdmarket_auth") or []
                    markets = [str(m) for m in trdmarket_auth] if isinstance(trdmarket_auth, list) else []
                    all_accounts.append({
                        "firm": str(firm),
                        "acc_id": acc_id,
                        "trd_env": trd_env,
                        "acc_type": str(row.get("acc_type") or ""),
                        "acc_status": acc_status,
                        "acc_role": str(row.get("acc_role") or ""),
                        "uni_card_num": uni_card_num,
                        "card_num": str(row.get("card_num") or ""),
                        "sim_acc_type": sim_acc_type,
                        "trdmarket_auth": markets,
                        "is_real": trd_env == "REAL",
                        "is_active": acc_status == "ACTIVE",
                    })
            except Exception:
                continue
            finally:
                if ctx is not None:
                    ctx.close()

    return {"count": len(all_accounts), "accounts": all_accounts}


@app.get("/quotes/snapshot")
def quote_snapshot(codes: str):
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")
    if len(code_list) > 400:
        raise HTTPException(status_code=400, detail="Moomoo allows up to 400 codes per snapshot request.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_market_snapshot(code_list)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)
        return {"count": len(rows), "quotes": rows}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/quotes/history")
def quote_history(
    code: str,
    start: str | None = None,
    end: str | None = None,
    max_count: int = 1000,
):
    if not code:
        raise HTTPException(status_code=400, detail="Code is required.")
    if max_count < 1 or max_count > 1000:
        raise HTTPException(status_code=400, detail="max_count must be between 1 and 1000.")

    try:
        from moomoo import AuType, KLType, OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    rows: list[dict[str, Any]] = []
    page_req_key = None
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        while True:
            ret, data, page_req_key = ctx.request_history_kline(
                code,
                start=start,
                end=end,
                ktype=KLType.K_DAY,
                autype=AuType.QFQ,
                max_count=max_count,
                page_req_key=page_req_key,
            )
            if ret != RET_OK:
                raise HTTPException(status_code=400, detail=str(data))
            rows.extend(_records(data))
            if page_req_key is None:
                break

        return {"code": code, "count": len(rows), "candles": rows}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/quotes/owner-plate")
def quote_owner_plate(codes: str):
    """Return the industry plates (sectors) each stock belongs to. Options are skipped."""
    all_codes = _parse_codes(codes)
    if not all_codes:
        raise HTTPException(status_code=400, detail="At least one code is required.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    # Skip options by symbol pattern — all other types tried via recursive splitting
    candidate_codes = [c for c in all_codes if _asset_type(c) != "option"]

    sector_map: dict[str, str] = {}
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)

        def _fetch_plates(codes: list[str]) -> None:
            """Recursively call get_owner_plate, splitting on error to skip unsupported types."""
            if not codes:
                return
            ret, data = ctx.get_owner_plate(codes)
            if ret == RET_OK:
                if data is not None and hasattr(data, "to_dict"):
                    for row in data.to_dict("records"):
                        code = str(row.get("code") or "").upper()
                        plate_type = str(row.get("plate_class") or row.get("plate_type") or "")
                        plate_name = str(row.get("plate_name") or "")
                        if plate_type.upper() == "INDUSTRY" and plate_name and code not in sector_map:
                            sector_map[code] = plate_name
            else:
                if len(codes) == 1:
                    # Single unsupported code — skip silently
                    return
                mid = len(codes) // 2
                _fetch_plates(codes[:mid])
                _fetch_plates(codes[mid:])

        _fetch_plates(candidate_codes[:200])
    finally:
        if ctx is not None:
            ctx.close()

    results = [{"code": code, "sector": sector_map.get(code)} for code in all_codes]
    return {"count": len(results), "sectors": results}


@app.get("/quotes/capital-flow")
def quote_capital_flow(codes: str):
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")
    if len(code_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 codes per request.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    try:
        from moomoo import PeriodType as _PeriodType
        period_day = _PeriodType.DAY
        period_intraday = _PeriodType.INTRADAY
    except (ImportError, AttributeError):
        period_day = None
        period_intraday = None

    results = []
    for code in code_list:
        ctx = None
        try:
            ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
            # Try intraday first (market hours), fall back to daily
            ret, data = (None, None)
            for pt in ([period_intraday, period_day] if period_intraday is not None else [None]):
                if pt is not None:
                    ret, data = ctx.get_capital_flow(code, period_type=pt)
                else:
                    ret, data = ctx.get_capital_flow(code)
                if ret == RET_OK and data is not None and len(data) > 0:
                    break
            if ret != RET_OK or data is None or len(data) == 0:
                results.append({
                    "code": code, "in_flow": None, "main_in_flow": None,
                    "super_in_flow": None, "big_in_flow": None,
                    "mid_in_flow": None, "sml_in_flow": None,
                    "update_time": None,
                    "error": str(data) if ret != RET_OK else "no data",
                })
            else:
                row = data.iloc[-1].to_dict()
                results.append({
                    "code": code,
                    "in_flow": _f(row.get("in_flow")),
                    "main_in_flow": _f(row.get("main_in_flow")),
                    "super_in_flow": _f(row.get("super_in_flow")),
                    "big_in_flow": _f(row.get("big_in_flow")),
                    "mid_in_flow": _f(row.get("mid_in_flow")),
                    "sml_in_flow": _f(row.get("sml_in_flow")),
                    "update_time": _iso(row.get("time") or row.get("update_time")),
                    "error": None,
                })
        except Exception as exc:
            results.append({"code": code, "in_flow": None, "main_in_flow": None,
                             "super_in_flow": None, "big_in_flow": None,
                             "mid_in_flow": None, "sml_in_flow": None,
                             "update_time": None, "error": str(exc)})
        finally:
            if ctx is not None:
                ctx.close()

    return {"count": len(results), "flows": results}


@app.get("/quotes/capital-distribution")
def quote_capital_distribution(codes: str):
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")
    if len(code_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 codes per request.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    results = []
    for code in code_list:
        ctx = None
        try:
            ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
            ret, data = ctx.get_capital_distribution(code)
            if ret != RET_OK or data is None or len(data) == 0:
                results.append({
                    "code": code,
                    "super_in": None, "super_out": None,
                    "big_in": None, "big_out": None,
                    "mid_in": None, "mid_out": None,
                    "sml_in": None, "sml_out": None,
                    "error": str(data) if ret != RET_OK else "no data",
                })
            else:
                row = data.iloc[0].to_dict()
                results.append({
                    "code": code,
                    "super_in":  _f(row.get("capital_in_super")  or row.get("super_in_flow")  or row.get("super_in")),
                    "super_out": _f(row.get("capital_out_super") or row.get("super_out_flow") or row.get("super_out")),
                    "big_in":    _f(row.get("capital_in_big")    or row.get("big_in_flow")    or row.get("big_in")),
                    "big_out":   _f(row.get("capital_out_big")   or row.get("big_out_flow")   or row.get("big_out")),
                    "mid_in":    _f(row.get("capital_in_mid")    or row.get("mid_in_flow")    or row.get("mid_in")),
                    "mid_out":   _f(row.get("capital_out_mid")   or row.get("mid_out_flow")   or row.get("mid_out")),
                    "sml_in":    _f(row.get("capital_in_small")  or row.get("sml_in_flow")    or row.get("sml_in")),
                    "sml_out":   _f(row.get("capital_out_small") or row.get("sml_out_flow")   or row.get("sml_out")),
                    "error": None,
                })
        except Exception as exc:
            results.append({
                "code": code,
                "super_in": None, "super_out": None,
                "big_in": None, "big_out": None,
                "mid_in": None, "mid_out": None,
                "sml_in": None, "sml_out": None,
                "error": str(exc),
            })
        finally:
            if ctx is not None:
                ctx.close()

    return {"count": len(results), "distributions": results}


@app.get("/quotes/plates")
def quote_plates(market: str = "US", plate_class: str = "INDUSTRY"):
    try:
        from moomoo import OpenQuoteContext, RET_OK, Market as MooMkt, Plate as MooPlate
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    market_map = {"US": MooMkt.US, "HK": MooMkt.HK, "SH": MooMkt.SH, "SZ": MooMkt.SZ}
    plate_map = {"INDUSTRY": MooPlate.INDUSTRY, "REGION": MooPlate.REGION,
                 "CONCEPT": MooPlate.CONCEPT, "ALL": MooPlate.ALL}

    mkt = market_map.get(market.upper())
    if mkt is None:
        raise HTTPException(status_code=400, detail=f"Unknown market: {market}")
    plt = plate_map.get(plate_class.upper(), MooPlate.INDUSTRY)

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_plate_list(mkt, plate_class=plt)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)
        plates = [
            {
                "code":  str(r.get("code") or ""),
                "name":  str(r.get("plate_name") or ""),
                "class": plate_class.upper(),
            }
            for r in rows if r.get("code")
        ]
        plates.sort(key=lambda p: p["name"])
        return {"count": len(plates), "plates": plates}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/quotes/plate-stocks")
def quote_plate_stocks(plate_code: str, with_snapshot: bool = True):
    if not plate_code:
        raise HTTPException(status_code=400, detail="plate_code is required.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_plate_stock(plate_code)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))

        rows = _records(data)
        stocks: list[dict[str, Any]] = [
            {
                "code":       str(r.get("code") or ""),
                "name":       str(r.get("name") or ""),
                "lot_size":   int(_f(r.get("lot_size"))),
                "stock_type": str(r.get("stock_type") or ""),
            }
            for r in rows if r.get("code")
        ]

        if with_snapshot and stocks:
            codes = [s["code"] for s in stocks[:400]]
            snap_map: dict[str, dict[str, Any]] = {}
            for i in range(0, len(codes), 200):
                batch = codes[i : i + 200]
                ret2, snap = ctx.get_market_snapshot(batch)
                if ret2 == RET_OK and snap is not None:
                    for row in snap.to_dict("records"):
                        code = str(row.get("code") or "")
                        if code:
                            snap_map[code] = row

            enriched = []
            for s in stocks:
                sn = snap_map.get(s["code"], {})
                last  = _f(sn.get("last_price"))
                prev  = _f(sn.get("prev_close_price"))
                chg   = round(last - prev, 4) if last and prev else None
                chgp  = round((last - prev) / prev * 100, 2) if last and prev else None
                enriched.append({
                    **s,
                    "name":        str(sn.get("name") or s.get("name") or ""),
                    "last_price":  last or None,
                    "change":      chg,
                    "change_pct":  chgp,
                    "market_cap":  _f(sn.get("total_market_val")) or None,
                    "pe_ttm":      _f(sn.get("pe_ttm_ratio"))     or None,
                    "volume":      _f(sn.get("volume"))            or None,
                    "turnover":    _f(sn.get("turnover"))          or None,
                })
            stocks = enriched

        return {"plate_code": plate_code, "count": len(stocks), "stocks": stocks}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/quotes/basic-info")
def quote_basic_info(codes: str):
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")
    if len(code_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 codes per request.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    results = []
    for code in code_list:
        ctx = None
        try:
            ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)

            snap_data: dict[str, Any] = {}
            ret, snap = ctx.get_market_snapshot([code])
            if ret == RET_OK and snap is not None and len(snap) > 0:
                snap_data = snap.iloc[0].to_dict()

            basic_data: dict[str, Any] = {}
            market_prefix = code.split(".")[0]
            try:
                from moomoo import Market
                market_map = {"US": Market.US, "HK": Market.HK, "SH": Market.SH, "SZ": Market.SZ}
                mkt = market_map.get(market_prefix)
                if mkt is not None:
                    ret2, binfo = ctx.get_stock_basicinfo(mkt, code_list=[code])
                    if ret2 == RET_OK and binfo is not None and len(binfo) > 0:
                        basic_data = binfo.iloc[0].to_dict()
            except Exception:
                pass

            def _fn(v: Any) -> float | None:
                try:
                    if v in (None, "", "N/A"):
                        return None
                    f = float(v)
                    return f if f != 0.0 else None
                except (TypeError, ValueError):
                    return None

            sec_status = str(snap_data.get("sec_status") or basic_data.get("suspension") or "")
            results.append({
                "code": code,
                "name": str(snap_data.get("name") or basic_data.get("name") or ""),
                "lot_size": int(_f(basic_data.get("lot_size") or snap_data.get("lot_size"))),
                "listing_date": _iso(basic_data.get("listing_date") or snap_data.get("listing_date")),
                "exchange": str(basic_data.get("primary_exchange_name") or basic_data.get("exchange_type") or ""),
                "stock_type": str(snap_data.get("stock_type") or basic_data.get("stock_type") or ""),
                "suspension": sec_status not in ("", "NORMAL", "N/A"),
                "pe_ratio": _fn(snap_data.get("pe_ratio")),
                "pe_ttm": _fn(snap_data.get("pe_ttm_ratio")),
                "pb_ratio": _fn(snap_data.get("pb_ratio")),
                "eps": _fn(snap_data.get("earning_per_share")),
                "market_cap": _fn(snap_data.get("total_market_val")),
                "high_52wk": _fn(snap_data.get("highest52weeks_price")),
                "low_52wk": _fn(snap_data.get("lowest52weeks_price")),
                "error": None,
            })
        except Exception as exc:
            results.append({
                "code": code,
                "name": None, "lot_size": None, "listing_date": None,
                "exchange": None, "stock_type": None, "suspension": None,
                "pe_ratio": None, "pe_ttm": None, "pb_ratio": None,
                "eps": None, "market_cap": None, "high_52wk": None, "low_52wk": None,
                "error": str(exc),
            })
        finally:
            if ctx is not None:
                ctx.close()

    return {"count": len(results), "basics": results}


@app.get("/quotes/global-markets")
def quote_global_markets():
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    OPEN_STATES  = {"MORNING", "AFTERNOON"}
    PRE_STATES   = {"PRE_MARKET_BEGIN", "PRE_MARKET_END"}
    AFTER_STATES = {"AFTER_HOURS_BEGIN", "AFTER_HOURS_END"}
    BREAK_STATES = {"LUNCH_BREAK"}

    INDEX_CODES: dict[str, list[str]] = {
        "us": ["US.SPY", "US.QQQ", "US.DIA"],
        "hk": ["HK.800000"],
        "sh": [],
        "sz": [],
    }

    MARKET_CONFIGS = [
        {"key": "us", "name": "United States", "short": "US", "timezone": "America/New_York", "currency": "USD"},
        {"key": "hk", "name": "Hong Kong",     "short": "HK", "timezone": "Asia/Hong_Kong",   "currency": "HKD"},
        {"key": "sh", "name": "Shanghai",      "short": "SH", "timezone": "Asia/Shanghai",    "currency": "CNY"},
        {"key": "sz", "name": "Shenzhen",      "short": "SZ", "timezone": "Asia/Shanghai",    "currency": "CNY"},
    ]

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)

        ret, global_data = ctx.get_global_state()
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(global_data))

        market_states = {
            "us": str(global_data.get("market_us") or ""),
            "hk": str(global_data.get("market_hk") or ""),
            "sh": str(global_data.get("market_sh") or ""),
            "sz": str(global_data.get("market_sz") or ""),
        }

        all_index_codes = [c for codes in INDEX_CODES.values() for c in codes]
        snap_map: dict[str, dict[str, Any]] = {}
        try:
            ret2, snap = ctx.get_market_snapshot(all_index_codes)
            if ret2 == RET_OK and snap is not None:
                for row in snap.to_dict("records"):
                    code = str(row.get("code") or "")
                    if code:
                        snap_map[code] = row
        except Exception:
            pass

        def _status(state: str) -> str:
            s = state.upper()
            if s in OPEN_STATES:  return "open"
            if s in PRE_STATES:   return "pre"
            if s in AFTER_STATES: return "after"
            if s in BREAK_STATES: return "break"
            return "closed"

        def _index_item(code: str) -> dict[str, Any] | None:
            sn = snap_map.get(code)
            if not sn:
                return None
            last = _f(sn.get("last_price"))
            prev = _f(sn.get("prev_close_price"))
            chg  = round(last - prev, 2) if last and prev else None
            chgp = round((last - prev) / prev * 100, 2) if last and prev else None
            return {
                "code": code,
                "name": str(sn.get("name") or ""),
                "last_price": last or None,
                "change": chg,
                "change_pct": chgp,
            }

        markets = []
        for mkt in MARKET_CONFIGS:
            key   = mkt["key"]
            state = market_states.get(key, "")
            indices = [_index_item(c) for c in INDEX_CODES.get(key, [])]
            indices = [i for i in indices if i is not None]
            markets.append({**mkt, "state": state, "status": _status(state), "indices": indices})

        return {"fetched_at": datetime.now(timezone.utc).isoformat(), "markets": markets}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/quotes/market-state")
def quote_market_state(codes: str):
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_market_state(code_list)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)
        return {"count": len(rows), "states": rows}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/options/expiry")
def options_expiry(symbol: str):
    """Return available option expiry dates for an underlying symbol (e.g. US.AAPL)."""
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    code = symbol if "." in symbol else f"US.{symbol}"
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_option_expiration_date(code)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)
        dates = sorted({r.get("strike_time") or r.get("date") or "" for r in rows if r.get("strike_time") or r.get("date")})
        return {"symbol": code, "expiry_dates": dates, "count": len(dates)}
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/options/chain")
def options_chain(symbol: str, expiry: str, option_type: str = "all"):
    """Return option chain for a symbol and expiry date.

    Args:
        symbol: Underlying code, e.g. AAPL or US.AAPL
        expiry: Expiry date string YYYY-MM-DD
        option_type: 'call', 'put', or 'all'
    """
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    code = symbol if "." in symbol else f"US.{symbol}"
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_option_chain(code, expiry, expiry)
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)

        # Filter by option_type if requested
        if option_type in ("call", "put"):
            rows = [r for r in rows if str(r.get("option_type", "")).lower().startswith(option_type[0])]

        # Normalise fields
        result = []
        for r in rows:
            result.append({
                "code": r.get("code"),
                "symbol": code,
                "expiry": expiry,
                "option_type": str(r.get("option_type", "")).lower(),
                "strike": _f(r.get("strike_price")),
                "last_price": _f(r.get("last_price")),
                "bid": _f(r.get("bid_price")),
                "ask": _f(r.get("ask_price")),
                "volume": r.get("volume"),
                "open_interest": r.get("open_interest"),
                "implied_volatility": _f(r.get("implied_volatility")),
                "delta": _f(r.get("delta")),
                "gamma": _f(r.get("gamma")),
                "theta": _f(r.get("theta")),
                "vega": _f(r.get("vega")),
                "mid_price": round((_f(r.get("bid_price")) or 0 + _f(r.get("ask_price")) or 0) / 2, 4)
                    if r.get("bid_price") and r.get("ask_price") else None,
            })

        return {
            "symbol": code,
            "expiry": expiry,
            "option_type": option_type,
            "count": len(result),
            "chain": result,
        }
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/options/candidates")
def options_candidates(symbols: str, mode: str = "both"):
    """Discover covered call (CC) and cash-secured put (CSP) candidates for given underlyings.

    Args:
        symbols: Comma-separated list of underlying codes, e.g. AAPL,MSFT or US.AAPL,US.MSFT
        mode: 'cc' (covered calls only), 'csp' (puts only), or 'both'
    """
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    codes = [s.strip() for s in symbols.split(",") if s.strip()]
    codes = [c if "." in c else f"US.{c}" for c in codes]
    if not codes:
        raise HTTPException(status_code=400, detail="At least one symbol is required.")

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)

        candidates = []
        for code in codes:
            # Get nearest 2 expiry dates
            ret_e, data_e = ctx.get_option_expiration_date(code)
            if ret_e != RET_OK:
                continue
            expiry_rows = _records(data_e)
            expiry_dates = sorted({r.get("strike_time") or r.get("date") or "" for r in expiry_rows if r.get("strike_time") or r.get("date")})
            nearest_expiries = [d for d in expiry_dates if d][:2]

            # Get underlying snapshot for current price
            ret_s, snap_data = ctx.get_market_snapshot([code])
            underlying_price = None
            if ret_s == RET_OK:
                snaps = _records(snap_data)
                if snaps:
                    underlying_price = _f(snaps[0].get("last_price"))

            for expiry in nearest_expiries:
                ret_c, chain_data = ctx.get_option_chain(code, expiry, expiry)
                if ret_c != RET_OK:
                    continue
                chain_rows = _records(chain_data)

                for r in chain_rows:
                    opt_type = str(r.get("option_type", "")).lower()
                    strike = _f(r.get("strike_price"))
                    bid = _f(r.get("bid_price"))
                    ask = _f(r.get("ask_price"))
                    iv = _f(r.get("implied_volatility"))
                    delta = _f(r.get("delta"))
                    theta = _f(r.get("theta"))
                    oi = r.get("open_interest") or 0

                    if not strike or not bid:
                        continue

                    mid = round((bid + (ask or bid)) / 2, 4)
                    collateral = round(strike * 100, 2)
                    premium_yield = round(mid / strike * 100, 4) if strike else None

                    is_cc = mode in ("cc", "both") and opt_type.startswith("c") and delta and 0.2 <= abs(delta) <= 0.45
                    is_csp = mode in ("csp", "both") and opt_type.startswith("p") and delta and 0.2 <= abs(delta) <= 0.45

                    if not (is_cc or is_csp):
                        continue

                    candidates.append({
                        "underlying": code,
                        "underlying_price": underlying_price,
                        "strategy": "covered_call" if is_cc else "cash_secured_put",
                        "option_type": "call" if is_cc else "put",
                        "expiry": expiry,
                        "strike": strike,
                        "bid": bid,
                        "ask": ask,
                        "mid": mid,
                        "collateral_per_contract": collateral,
                        "premium_yield_pct": premium_yield,
                        "implied_volatility": iv,
                        "delta": delta,
                        "theta": theta,
                        "open_interest": oi,
                        "option_code": r.get("code"),
                    })

        # Sort: highest premium yield first
        candidates.sort(key=lambda x: x.get("premium_yield_pct") or 0, reverse=True)

        return {
            "symbols": codes,
            "mode": mode,
            "count": len(candidates),
            "candidates": candidates,
        }
    finally:
        if ctx is not None:
            ctx.close()


@app.get("/fund-balance")
def fund_balance(prefer_real: bool = True):
    """Return account balances in USD, MYR, HKD, and SGD for fund-enabled accounts."""
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    firms = [SecurityFirm.FUTUMY, SecurityFirm.FUTUSG, SecurityFirm.FUTUINC,
             SecurityFirm.FUTUSECURITIES, SecurityFirm.FUTUAU, SecurityFirm.FUTUCA, SecurityFirm.FUTUJP]
    currencies = ["USD", "MYR", "HKD", "SGD", "JPY"]

    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, accounts = ctx.get_acc_list()
            if ret != RET_OK or accounts is None or accounts.empty:
                continue
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue
            if prefer_real and str(account.get("trd_env")) != "REAL":
                continue

            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            acc_id = int(account.get("acc_id"))
            trdmarket_auth = account.get("trdmarket_auth") or []
            markets = [str(m) for m in trdmarket_auth] if isinstance(trdmarket_auth, list) else []

            balances = []
            for currency in currencies:
                try:
                    ret2, info = ctx.accinfo_query(
                        trd_env=trd_env, acc_id=acc_id, refresh_cache=True, currency=currency
                    )
                    if ret2 == RET_OK and info is not None and len(info) > 0:
                        row = info.iloc[0].to_dict()
                        cash_key = f"{currency}_cash"
                        cash = _f(row.get(cash_key)) or _f(row.get("cash"))
                        total = _f(row.get("total_assets"))
                        if total > 0 or cash > 0:
                            balances.append({
                                "currency": currency,
                                "total_assets": total or None,
                                "securities_assets": _f(row.get("securities_assets")) or None,
                                "cash": cash or None,
                                "market_val": _f(row.get("market_val")) or None,
                                "unrealized_pl": _f(row.get("unrealized_pl")) or None,
                                "realized_pl": _f(row.get("realized_pl")) or None,
                                "buying_power": _f(row.get("power")) or None,
                                "avl_withdrawal": _f(row.get("avl_withdrawal_cash")) or None,
                            })
                except Exception:
                    continue

            return {
                "account_number": str(account.get("uni_card_num") or account.get("card_num") or ""),
                "trade_environment": "REAL" if str(account.get("trd_env")) == "REAL" else "SIMULATE",
                "trdmarket_auth": markets,
                "has_myfund": "MYFUND" in markets,
                "has_usfund": "USFUND" in markets,
                "has_hkfund": "HKFUND" in markets,
                "has_sgfund": "SGFUND" in markets,
                "has_jpfund": "JPFUND" in markets,
                "balances": balances,
            }
        except Exception:
            continue
        finally:
            if ctx is not None:
                ctx.close()

    raise HTTPException(status_code=400, detail="No active account found.")


@app.get("/fund-positions")
def fund_positions(prefer_real: bool = True):
    """Return fund (MYFUND / USFUND) holdings separately from stock positions."""
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv, TrdMarket
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    firms = [SecurityFirm.FUTUMY, SecurityFirm.FUTUSG, SecurityFirm.FUTUINC,
             SecurityFirm.FUTUSECURITIES, SecurityFirm.FUTUAU, SecurityFirm.FUTUCA, SecurityFirm.FUTUJP]

    fund_markets = []
    for name, attr in [
        ("MYFUND", "MYFUND"),
        ("USFUND", "USFUND"),
        ("HKFUND", "HKFUND"),
        ("SGFUND", "SGFUND"),
        ("JPFUND", "JPFUND"),
    ]:
        try:
            fund_markets.append((name, getattr(TrdMarket, attr)))
        except AttributeError:
            pass

    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, accounts = ctx.get_acc_list()
            if ret != RET_OK or accounts is None or accounts.empty:
                continue
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue
            if prefer_real and str(account.get("trd_env")) != "REAL":
                continue

            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            acc_id = int(account.get("acc_id"))
            trdmarket_auth = account.get("trdmarket_auth") or []
            markets = [str(m) for m in trdmarket_auth] if isinstance(trdmarket_auth, list) else []

            all_positions: list[dict[str, Any]] = []
            for market_name, trd_market in fund_markets:
                if market_name not in markets:
                    continue
                try:
                    ret2, pos_data = ctx.position_list_query(
                        trd_env=trd_env, acc_id=acc_id, trd_market=trd_market, refresh_cache=True
                    )
                    if ret2 == RET_OK and pos_data is not None and not pos_data.empty:
                        for row in pos_data.to_dict("records"):
                            qty = _f(row.get("qty"))
                            if qty == 0:
                                continue
                            all_positions.append({
                                "fund_market": market_name,
                                "symbol": str(row.get("code") or "").upper(),
                                "name": str(row.get("stock_name") or ""),
                                "quantity": qty,
                                "average_cost": _f(row.get("cost_price") or row.get("average_cost")),
                                "market_price": _f(row.get("nominal_price")),
                                "market_value": _f(row.get("market_val")),
                                "unrealized_pl": _f(row.get("pl_val") or row.get("unrealized_pl")),
                                "unrealized_pl_pct": _f(row.get("pl_ratio")),
                                "currency": str(row.get("currency") or ""),
                            })
                except Exception:
                    continue

            return {
                "account_number": str(account.get("uni_card_num") or account.get("card_num") or ""),
                "trdmarket_auth": markets,
                "count": len(all_positions),
                "positions": all_positions,
            }
        except Exception:
            continue
        finally:
            if ctx is not None:
                ctx.close()

    raise HTTPException(status_code=400, detail="No active account found.")


@app.get("/cashflow")
def cashflow(days: int = 30, prefer_real: bool = True):
    """Return account cash flow for the last N calendar days, queried by clearing_date."""
    if days < 1 or days > 180:
        raise HTTPException(status_code=400, detail="days must be between 1 and 180.")

    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    # Build list of dates to query (last N calendar days, skip weekends).
    # Pure logic lives in cashflow_logic for unit testing.
    from datetime import date
    from cashflow_logic import cashflow_query_dates, parse_cashflow_row
    dates_to_query = cashflow_query_dates(days, date.today())

    # Find active account
    firms = [SecurityFirm.FUTUINC, SecurityFirm.FUTUMY, SecurityFirm.FUTUSG,
             SecurityFirm.FUTUSECURITIES, SecurityFirm.FUTUAU, SecurityFirm.FUTUCA, SecurityFirm.FUTUJP]

    account_ctx = None
    trd_env = None
    acc_id = None
    firm_used = None

    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, accounts = ctx.get_acc_list()
            if ret != RET_OK or accounts is None or accounts.empty:
                continue
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue
            if prefer_real and str(account.get("trd_env")) != "REAL":
                continue
            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            acc_id = int(account.get("acc_id"))
            firm_used = firm
            break
        except Exception:
            continue
        finally:
            if ctx is not None:
                ctx.close()

    if acc_id is None:
        raise HTTPException(status_code=400, detail="No active Moomoo account available.")

    # Fetch each clearing_date in parallel
    all_rows: list[dict[str, Any]] = []
    lock = __import__("threading").Lock()

    def fetch_date(clearing_date: str):
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm_used)
            ret, data = ctx.get_acc_cash_flow(
                trd_env=trd_env,
                acc_id=acc_id,
                clearing_date=clearing_date,
            )
            if ret == RET_OK and data is not None and hasattr(data, "to_dict") and not data.empty:
                rows = data.to_dict("records")
                parsed = [parse_cashflow_row(row, clearing_date) for row in rows]
                with lock:
                    all_rows.extend(parsed)
        except Exception:
            pass
        finally:
            if ctx is not None:
                ctx.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        executor.map(fetch_date, dates_to_query)

    all_rows.sort(key=lambda r: r["clearing_date"], reverse=True)
    return {"count": len(all_rows), "cashflow": all_rows}


@app.get("/positions")
def positions(prefer_real: bool = True, base_currency: str = "USD"):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, include_orders=False, include_deals=False, base_currency=base_currency)
    return {
        "account": bundle["account"],
        "account_info": bundle["account_info"],
        "synced_at": bundle["synced_at"],
        "count": len(bundle["positions"]),
        "positions": bundle["positions"],
    }


@app.get("/orders")
def orders(prefer_real: bool = True, history: bool = True):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, include_positions=False, include_deals=False, include_history=history)
    return {
        "account": bundle["account"],
        "synced_at": bundle["synced_at"],
        "count": len(bundle["orders"]),
        "orders": bundle["orders"],
    }


@app.get("/deals")
def deals(prefer_real: bool = True, history: bool = True):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, include_positions=False, include_orders=False, include_history=history)
    return {
        "account": bundle["account"],
        "synced_at": bundle["synced_at"],
        "count": len(bundle["deals"]),
        "deals": bundle["deals"],
    }


@app.post("/execution/orders")
def execution_order(req: ExecutionOrderRequest):
    """Submit an order to Moomoo only when bridge read-only mode is explicitly disabled."""
    if MOOMOO_READ_ONLY:
        raise HTTPException(status_code=403, detail="Moomoo bridge is in read-only mode. Set MOOMOO_READ_ONLY=false to allow order submission.")
    if req.mode == "live" and os.getenv("MOOMOO_LIVE_EXECUTION_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Live execution is disabled by MOOMOO_LIVE_EXECUTION_ENABLED=false.")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
    if req.order_type.lower() == "limit" and (req.price is None or req.price <= 0):
        raise HTTPException(status_code=400, detail="Limit orders require a positive price.")

    if req.dry_run:
        return {
            "status": "dry_run_ok",
            "broker_order_id": None,
            "account_id": None,
            "trade_env": req.trade_env,
            "market": "US",
            "dry_run": True,
        }

    try:
        from moomoo import OpenSecTradeContext, OrderType, RET_OK, TrdEnv, TrdMarket, TrdSide
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    prefer_real = req.mode == "live" or req.trade_env.upper() == "REAL"

    # Infer market from symbol prefix (US., HK., SH., SZ.)
    symbol_upper = req.symbol.upper()
    if symbol_upper.startswith("HK.") or symbol_upper.startswith("SH.") or symbol_upper.startswith("SZ."):
        trd_market = TrdMarket.HK if symbol_upper.startswith("HK.") else TrdMarket.CN
    else:
        trd_market = TrdMarket.US

    ctx = None
    try:
        ctx = OpenSecTradeContext(filter_trdmarket=trd_market, host=OPEND_HOST, port=OPEND_PORT)
        ret, accounts = ctx.get_acc_list()
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=f"Failed to get account list: {accounts}")

        # Use explicit acc_id if provided, otherwise auto-select
        if req.acc_id:
            matches = accounts[accounts["acc_id"] == str(req.acc_id)]
            account = matches.iloc[0].to_dict() if not matches.empty else None
        else:
            account = _select_account(accounts, prefer_real)

        if account is None:
            raise HTTPException(status_code=400, detail="No matching Moomoo account found.")

        is_real = str(account.get("trd_env")) == "REAL"
        if prefer_real and not is_real:
            raise HTTPException(status_code=400, detail="Live mode requested but no real account found.")
        trd_env = TrdEnv.REAL if is_real else TrdEnv.SIMULATE
        acc_id = int(account.get("acc_id"))

        side = TrdSide.BUY if req.side.lower() in ("buy", "open") else TrdSide.SELL
        order_type = getattr(OrderType, "MARKET", OrderType.NORMAL) if req.order_type.lower() == "market" else OrderType.NORMAL
        price = float(req.price or 0)
        ret, data = ctx.place_order(
            price=price,
            qty=float(req.quantity),
            code=req.symbol,
            trd_side=side,
            order_type=order_type,
            trd_env=trd_env,
            acc_id=acc_id,
        )
        if ret != RET_OK:
            raise HTTPException(status_code=400, detail=str(data))
        rows = _records(data)
        first = rows[0] if rows else {}
        order_id = str(first.get("order_id") or first.get("orderID") or "")
        return {
            "status": "submitted",
            "broker_order_id": order_id,
            "account_id": str(acc_id),
            "trade_env": "REAL" if is_real else "SIMULATE",
            "market": str(trd_market),
            "client_order_id": req.client_order_id,
            "source_ticket_id": req.source_ticket_id,
            "raw": rows,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if ctx is not None:
            ctx.close()


@app.post("/execution/orders/{order_id}/cancel")
def execution_cancel_order(order_id: str, req: CancelOrderRequest):
    """Cancel a Moomoo order only when bridge read-only mode is explicitly disabled."""
    if MOOMOO_READ_ONLY:
        raise HTTPException(status_code=403, detail="Moomoo bridge is in read-only mode. Set MOOMOO_READ_ONLY=false to allow order cancellation.")

    try:
        from moomoo import ModifyOrderOp, OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    prefer_real = req.mode == "live"
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
            ret, data = ctx.modify_order(
                modify_order_op=ModifyOrderOp.CANCEL,
                order_id=order_id,
                qty=0,
                price=0,
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
            )
            if ret != RET_OK:
                continue
            return {
                "status": "cancelled",
                "broker_order_id": order_id,
                "account_id": str(account.get("acc_id")),
                "trade_env": "REAL" if trd_env == TrdEnv.REAL else "SIMULATE",
                "raw": _records(data),
            }
        except Exception:
            continue
        finally:
            if ctx is not None:
                ctx.close()

    raise HTTPException(status_code=400, detail="Unable to cancel order through active Moomoo account.")


@app.get("/account-balance")
def account_balance(acc_id: str, trd_env: str = "SIMULATE"):
    """Return account balance (total assets, cash, market value) for a specific account."""
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv, TrdMarket
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    is_real = trd_env.upper() == "REAL"
    env = TrdEnv.REAL if is_real else TrdEnv.SIMULATE
    firms = [
        SecurityFirm.FUTUINC, SecurityFirm.FUTUMY, SecurityFirm.FUTUSG,
        SecurityFirm.FUTUSECURITIES, SecurityFirm.FUTUAU, SecurityFirm.FUTUCA, SecurityFirm.FUTUJP,
    ]
    trade_markets = [None, TrdMarket.US, TrdMarket.HK]

    for firm in firms:
        for trd_market in trade_markets:
            ctx = None
            try:
                kwargs = {"host": OPEND_HOST, "port": OPEND_PORT, "security_firm": firm}
                if trd_market is not None:
                    kwargs["filter_trdmarket"] = trd_market
                ctx = OpenSecTradeContext(**kwargs)
                ret, accounts = ctx.get_acc_list()
                if ret != RET_OK or accounts is None or accounts.empty:
                    continue
                matches = accounts[accounts["acc_id"].astype(str) == str(acc_id)]
                if matches.empty:
                    continue
                currencies = ["USD", "MYR", "SGD", "HKD", "JPY"]
                balances = []
                for currency in currencies:
                    try:
                        ret2, info = ctx.accinfo_query(
                            trd_env=env, acc_id=int(acc_id), refresh_cache=True, currency=currency
                        )
                        if ret2 != RET_OK or info is None or len(info) == 0:
                            continue
                        row = info.iloc[0].to_dict()
                        cash_key = f"{currency}_cash"
                        cash = _f(row.get(cash_key)) or _f(row.get("cash"))
                        total = _f(row.get("total_assets"))
                        if total > 0 or cash > 0:
                            balances.append({
                                "currency": currency,
                                "total_assets": total or None,
                                "cash": cash or None,
                                "market_val": _f(row.get("market_val")) or None,
                                "unrealized_pl": _f(row.get("unrealized_pl")) or None,
                            })
                    except Exception:
                        continue
                if not balances:
                    continue
                return {
                    "acc_id": str(acc_id),
                    "trd_env": trd_env.upper(),
                    "balances": balances,
                    # convenience: primary balance (first non-zero)
                    "currency": balances[0]["currency"],
                    "total_assets": balances[0]["total_assets"],
                    "cash": balances[0]["cash"],
                    "market_val": balances[0]["market_val"],
                    "unrealized_pl": balances[0]["unrealized_pl"],
                }
            except Exception:
                continue
            finally:
                if ctx is not None:
                    ctx.close()

    raise HTTPException(status_code=404, detail="Account not found or balance unavailable.")


@app.get("/paper/dashboard")
def paper_dashboard():
    """Return balance, positions, orders and deals for the simulate (paper) account."""
    bundle = _fetch_account_bundle(prefer_real=False)
    return {
        "account": bundle["account"],
        "account_info": bundle["account_info"],
        "positions": bundle["positions"],
        "orders": bundle["orders"],
        "deals": bundle["deals"],
        "synced_at": bundle["synced_at"],
    }


@app.post("/sync")
def sync(prefer_real: bool = True, acc_id: str | None = None, base_currency: str = "USD"):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, acc_id=acc_id, base_currency=base_currency)
    return {
        "account_label": bundle["account"]["account_label"],
        "account_number": bundle["account"]["account_number"],
        "broker_account_id": bundle["account"]["broker_account_id"],
        "acc_role": bundle["account"]["acc_role"],
        "account_type": bundle["account"]["account_type"],
        "trade_environment": bundle["account"]["trade_environment"],
        "security_firm": bundle["account"]["security_firm"],
        "trdmarket_auth": bundle["account"]["trdmarket_auth"],
        "synced_at": bundle["synced_at"],
        "holdings_count": len(bundle["positions"]),
        "holdings": bundle["positions"],
        "positions": bundle["positions"],
        "orders_count": len(bundle["orders"]),
        "orders": bundle["orders"],
        "deals_count": len(bundle["deals"]),
        "deals": bundle["deals"],
        "account_info": bundle["account_info"],
        "read_only": MOOMOO_READ_ONLY,
    }


def _fetch_account_bundle(
    prefer_real: bool = True,
    include_positions: bool = True,
    include_orders: bool = True,
    include_deals: bool = True,
    include_history: bool = True,
    acc_id: str | None = None,
    base_currency: str = "USD",
):
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

    from moomoo import TrdMarket
    trade_markets = [None, TrdMarket.US, TrdMarket.HK, TrdMarket.SG]

    for firm in firms:
        for trd_market in trade_markets:
            ctx = None
            try:
                if trd_market is None:
                    ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
                else:
                    ctx = OpenSecTradeContext(filter_trdmarket=trd_market, host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
                ret, accounts = ctx.get_acc_list()
                if ret != RET_OK:
                    continue
                if acc_id is not None:
                    # explicit account requested — find by acc_id, skip prefer_real filter
                    matches = accounts[accounts["acc_id"].astype(str) == str(acc_id)]
                    if matches.empty:
                        continue
                    account = matches.iloc[0].to_dict()
                else:
                    account = _select_account(accounts, prefer_real)
                    if account is None:
                        continue
                    if prefer_real and str(account.get("trd_env")) != "REAL":
                        continue

                trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
                ret, acc_info = ctx.accinfo_query(
                    trd_env=trd_env,
                    acc_id=int(account.get("acc_id")),
                    refresh_cache=True,
                    currency=base_currency,
                )

                positions = []
                if include_positions:
                    ret_positions, positions_data = ctx.position_list_query(
                        trd_env=trd_env,
                        acc_id=int(account.get("acc_id")),
                        refresh_cache=True,
                    )
                    if ret_positions != RET_OK:
                        continue
                    positions = _parse_positions(positions_data)

                orders = []
                if include_orders:
                    orders = _fetch_orders(ctx, trd_env, int(account.get("acc_id")), include_history)

                deals = []
                if include_deals:
                    deals = _fetch_deals(ctx, trd_env, int(account.get("acc_id")), include_history)

                account_info = _parse_acc_info(acc_info if ret == RET_OK else None, base_currency)

                uni_card_num = str(account.get("uni_card_num") or account.get("card_num") or "")
                is_real = trd_env == TrdEnv.REAL
                label = f"Moomoo {'Live' if is_real else 'Simulated'}"
                if uni_card_num:
                    label += f" ({uni_card_num})"
                trdmarket_auth = account.get("trdmarket_auth") or []
                markets = [str(m) for m in trdmarket_auth] if isinstance(trdmarket_auth, list) else []
                broker_account_id = str(account.get("acc_id") or uni_card_num or f"{firm}-{account.get('trd_env')}")
                return {
                    "account": {
                        "account_label": label,
                        "account_number": uni_card_num,
                        "broker_account_id": broker_account_id,
                        "acc_role": str(account.get("acc_role") or ""),
                        "account_type": str(account.get("acc_type") or account.get("sim_acc_type") or ""),
                        "trade_environment": "REAL" if is_real else "SIMULATE",
                        "security_firm": str(firm),
                        "trdmarket_auth": markets,
                        "status": str(account.get("acc_status") or ""),
                    },
                    "synced_at": datetime.now(timezone.utc).isoformat(),
                    "positions": positions,
                    "orders": orders,
                    "deals": deals,
                    "account_info": account_info,
                }
            except Exception:
                continue
            finally:
                if ctx is not None:
                    ctx.close()

    raise HTTPException(status_code=400, detail="No active Moomoo account available from OpenD.")


def _parse_codes(codes: str) -> list[str]:
    return [code.strip().upper() for code in codes.split(",") if code.strip()]


def _records(data) -> list[dict[str, Any]]:
    if data is None or not hasattr(data, "to_dict"):
        return []
    return [_clean_metadata(row) for row in data.to_dict("records")]


def _fetch_orders(ctx, trd_env, acc_id: int, include_history: bool) -> list[dict[str, Any]]:
    from moomoo import RET_OK

    rows: list[dict[str, Any]] = []
    for method_name in ["order_list_query", "history_order_list_query"] if include_history else ["order_list_query"]:
        method = getattr(ctx, method_name, None)
        if method is None:
            continue
        try:
            ret, data = method(trd_env=trd_env, acc_id=acc_id)
            if ret == RET_OK:
                rows.extend(_parse_orders(data))
        except Exception:
            continue
    return _dedupe(rows, "broker_order_id")


def _fetch_deals(ctx, trd_env, acc_id: int, include_history: bool) -> list[dict[str, Any]]:
    from moomoo import RET_OK

    rows: list[dict[str, Any]] = []
    for method_name in ["deal_list_query", "history_deal_list_query"] if include_history else ["deal_list_query"]:
        method = getattr(ctx, method_name, None)
        if method is None:
            continue
        try:
            ret, data = method(trd_env=trd_env, acc_id=acc_id)
            if ret == RET_OK:
                rows.extend(_parse_deals(data))
        except Exception:
            continue
    return _dedupe(rows, "broker_deal_id")


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
            "name": str(row.get("stock_name") or ""),
            "asset_type": _asset_type(symbol),
            "market": symbol.split(".", 1)[0] if "." in symbol else "",
            "quantity": qty,
            "average_cost": avg_cost,
            "total_cost": qty * avg_cost,
            "market_price": market_price,
            "market_value": market_value,
            "unrealized_pl": unrealized_pl,
            "unrealized_pl_percent": unrealized_pl_pct,
            "today_pl": _f(row.get("today_pl_val")),
            "currency": str(row.get("currency") or "USD"),
        })
    return rows


def _parse_orders(orders) -> list[dict[str, Any]]:
    if orders is None or not hasattr(orders, "to_dict"):
        return []
    rows = []
    for row in orders.to_dict("records"):
        broker_order_id = str(row.get("order_id") or row.get("orderID") or "")
        symbol = str(row.get("code") or "").upper()
        if not broker_order_id and symbol:
            broker_order_id = f"{symbol}-{row.get('create_time') or row.get('updated_time') or len(rows)}"
        if not broker_order_id:
            continue
        rows.append({
            "broker_order_id": broker_order_id,
            "symbol": symbol,
            "side": str(row.get("trd_side") or row.get("side") or ""),
            "order_type": str(row.get("order_type") or ""),
            "status": str(row.get("order_status") or row.get("status") or ""),
            "quantity": _f(row.get("qty")),
            "filled_quantity": _f(row.get("dealt_qty") or row.get("filled_qty")),
            "price": _f(row.get("price")),
            "average_filled_price": _f(row.get("dealt_avg_price") or row.get("average_filled_price")),
            "currency": str(row.get("currency") or "USD"),
            "submitted_at": _iso(row.get("create_time") or row.get("submitted_time")),
            "updated_broker_at": _iso(row.get("updated_time") or row.get("updated_broker_at")),
            "metadata": _clean_metadata(row),
        })
    return rows


def _parse_deals(deals) -> list[dict[str, Any]]:
    if deals is None or not hasattr(deals, "to_dict"):
        return []
    rows = []
    for row in deals.to_dict("records"):
        broker_deal_id = str(row.get("deal_id") or row.get("dealID") or row.get("exec_id") or "")
        broker_order_id = str(row.get("order_id") or row.get("orderID") or "")
        symbol = str(row.get("code") or "").upper()
        if not broker_deal_id and symbol:
            broker_deal_id = f"{broker_order_id}-{symbol}-{row.get('create_time') or row.get('deal_time') or len(rows)}"
        if not broker_deal_id:
            continue
        rows.append({
            "broker_deal_id": broker_deal_id,
            "broker_order_id": broker_order_id,
            "symbol": symbol,
            "side": str(row.get("trd_side") or row.get("side") or ""),
            "quantity": _f(row.get("qty")),
            "price": _f(row.get("price")),
            "fee": _f(row.get("fee")),
            "currency": str(row.get("currency") or "USD"),
            "executed_at": _iso(row.get("create_time") or row.get("deal_time") or row.get("updated_time")),
            "metadata": _clean_metadata(row),
        })
    return rows


def _parse_acc_info(acc_info, base_currency: str = "USD") -> dict[str, Any]:
    if acc_info is None or len(acc_info) == 0:
        return {}
    row = acc_info.iloc[0].to_dict()
    # Aggregate fields (total_assets, market_val, cash) are already converted to
    # the requested base_currency by moomoo for universal/futures accounts. Prefer
    # the base-specific cash field, falling back to the converted aggregate.
    cash = _f(row.get(f"{base_currency}_cash")) or _f(row.get("cash"))
    return {
        "currency": base_currency,
        "total_assets": _f(row.get("total_assets")),
        "securities_assets": _f(row.get("securities_assets")),
        "cash": cash,
        "market_val": _f(row.get("market_val")),
        "unrealized_pl": _f(row.get("unrealized_pl")),
        "realized_pl": _f(row.get("realized_pl")),
        "power": _f(row.get("power")),
        "avl_withdrawal_cash": _f(row.get("avl_withdrawal_cash")),
        "is_pdt": bool(row.get("is_pdt", False)),
        "pdt_seq": str(row.get("pdt_seq") or ""),
    }


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


def _iso(value: Any) -> str | None:
    if value in (None, "", "N/A"):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raw = str(value)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return raw


def _clean_metadata(row: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in row.items():
        if hasattr(value, "isoformat"):
            clean[key] = value.isoformat()
        elif isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            clean[key] = None
        elif isinstance(value, (str, int, float, bool)) or value is None:
            clean[key] = value
        else:
            clean[key] = str(value)
    return clean


def _dedupe(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        seen[str(row.get(key))] = row
    return list(seen.values())


@app.post("/paper/reset")
def paper_reset():
    """Cancel all open SIMULATE orders and close all SIMULATE positions."""
    try:
        from moomoo import OpenSecTradeContext, RET_OK, TrdEnv, TrdMarket, TrdSide, OrderType, ModifyOrderOp
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    cancelled = 0
    closed = 0
    errors = []

    ctx = None
    try:
        ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.US, host=OPEND_HOST, port=OPEND_PORT)

        # 1. Get all open SIMULATE orders and cancel them
        ret, orders = ctx.order_list_query(trd_env=TrdEnv.SIMULATE)
        if ret == RET_OK and orders is not None and not orders.empty:
            for row in orders.to_dict("records"):
                order_id = str(row.get("order_id") or "")
                status = str(row.get("order_status") or "")
                # Only cancel pending/queued orders
                if order_id and status.upper() not in ("FILLED_ALL", "CANCELLED_ALL", "FAILED", "DISABLED"):
                    try:
                        ctx.modify_order(
                            modify_order_op=ModifyOrderOp.CANCEL,
                            order_id=order_id, qty=0, price=0,
                            trd_env=TrdEnv.SIMULATE,
                        )
                        cancelled += 1
                    except Exception as exc:
                        errors.append(f"cancel {order_id}: {exc}")

        # 2. Get all SIMULATE positions and close them with market orders
        ret2, positions = ctx.position_list_query(trd_env=TrdEnv.SIMULATE)
        if ret2 == RET_OK and positions is not None and not positions.empty:
            for row in positions.to_dict("records"):
                code = str(row.get("code") or "")
                qty = float(row.get("qty") or 0)
                if not code or qty <= 0:
                    continue
                close_side = TrdSide.SELL  # long positions
                try:
                    ctx.place_order(
                        price=0, qty=qty, code=code,
                        trd_side=close_side, order_type=OrderType.MARKET,
                        trd_env=TrdEnv.SIMULATE,
                    )
                    closed += 1
                except Exception as exc:
                    errors.append(f"close {code}: {exc}")

        return {
            "reset": True,
            "cancelled_orders": cancelled,
            "closed_positions": closed,
            "errors": errors,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if ctx is not None:
            ctx.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)

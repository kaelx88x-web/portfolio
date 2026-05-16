import concurrent.futures
import math
import os
import re
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

APPDATA_DIR = os.path.join(os.path.dirname(__file__), ".runtime", "appdata")
os.makedirs(APPDATA_DIR, exist_ok=True)
os.environ.setdefault("appdata", APPDATA_DIR)
os.environ.setdefault("APPDATA", APPDATA_DIR)

OPEND_HOST = os.getenv("MOOMOO_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("MOOMOO_OPEND_PORT", "11111"))
MOOMOO_ENV = os.getenv("MOOMOO_ENV", "paper")
MOOMOO_READ_ONLY = os.getenv("MOOMOO_READ_ONLY", "true").lower() != "false"

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
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm
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

    all_accounts = []
    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, acc_list = ctx.get_acc_list()
            if ret != RET_OK or acc_list is None or acc_list.empty:
                continue
            for row in acc_list.to_dict("records"):
                trd_env = str(row.get("trd_env", ""))
                acc_status = str(row.get("acc_status", ""))
                uni_card_num = str(row.get("uni_card_num") or row.get("card_num") or "")
                trdmarket_auth = row.get("trdmarket_auth") or []
                markets = [str(m) for m in trdmarket_auth] if isinstance(trdmarket_auth, list) else []
                all_accounts.append({
                    "firm": str(firm),
                    "acc_id": str(row.get("acc_id")),
                    "trd_env": trd_env,
                    "acc_type": str(row.get("acc_type") or ""),
                    "acc_status": acc_status,
                    "acc_role": str(row.get("acc_role") or ""),
                    "uni_card_num": uni_card_num,
                    "card_num": str(row.get("card_num") or ""),
                    "sim_acc_type": str(row.get("sim_acc_type") or ""),
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


@app.get("/cashflow")
def cashflow(days: int = 30, prefer_real: bool = True):
    """Return account cash flow for the last N calendar days, queried by clearing_date."""
    if days < 1 or days > 180:
        raise HTTPException(status_code=400, detail="days must be between 1 and 180.")

    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    # Build list of dates to query (last N calendar days, skip weekends)
    from datetime import date, timedelta
    today = date.today()
    dates_to_query = []
    for i in range(days):
        d = today - timedelta(days=i)
        if d.weekday() < 5:  # Mon–Fri only
            dates_to_query.append(d.strftime("%Y-%m-%d"))

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
                parsed = []
                for row in rows:
                    parsed.append({
                        "cashflow_id": str(row.get("cashflow_id") or ""),
                        "clearing_date": str(row.get("clearing_date") or clearing_date),
                        "settlement_date": str(row.get("settlement_date") or ""),
                        "currency": str(row.get("currency") or "USD"),
                        "cashflow_type": str(row.get("cashflow_type") or ""),
                        "cashflow_direction": str(row.get("cashflow_direction") or ""),
                        "amount": _f(row.get("cashflow_amount")),
                        "remark": str(row.get("cashflow_remark") or ""),
                    })
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
def positions(prefer_real: bool = True):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, include_orders=False, include_deals=False)
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


@app.post("/sync")
def sync(prefer_real: bool = True):
    bundle = _fetch_account_bundle(prefer_real=prefer_real)
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

            if prefer_real and str(account.get("trd_env")) != "REAL":
                continue

            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            ret, acc_info = ctx.accinfo_query(
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
                refresh_cache=True,
                currency="USD",
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

            account_info = _parse_acc_info(acc_info if ret == RET_OK else None)

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


def _parse_acc_info(acc_info) -> dict[str, Any]:
    if acc_info is None or len(acc_info) == 0:
        return {}
    row = acc_info.iloc[0].to_dict()
    # USD_cash is the currency-specific field; fall back to generic cash (deprecated)
    cash = _f(row.get("USD_cash")) or _f(row.get("cash"))
    return {
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)

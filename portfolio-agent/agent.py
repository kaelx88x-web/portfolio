#!/usr/bin/env python3
"""
PortfolioAI Local Agent v1.0.0
Polls local moomoo-service and pushes data to the SaaS server.

Usage:
    python agent.py [--config path/to/config.json]
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

AGENT_VERSION = "1.0.0"
DEFAULT_CONFIG = Path(__file__).parent / "config.json"


def load_config(path: Path) -> dict:
    if not path.exists():
        print(f"ERROR: Config file not found: {path}")
        print("Copy config.example.json to config.json and fill in your values.")
        sys.exit(1)
    with open(path) as f:
        cfg = json.load(f)
    required = ["server_url", "api_key", "moomoo_service_url"]
    for key in required:
        if not cfg.get(key):
            print(f"ERROR: Missing required config key: {key}")
            sys.exit(1)
    return cfg


def setup_logging(level: str) -> logging.Logger:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        level=getattr(logging, level.upper(), logging.INFO),
    )
    return logging.getLogger("portfolio-agent")


def fetch_local(client: httpx.Client, base: str, path: str) -> dict | None:
    """Fetch from local moomoo-service. Returns None on any error."""
    try:
        r = client.get(f"{base.rstrip('/')}{path}", timeout=8)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def build_payload(local_base: str) -> dict | None:
    """
    Collect all data from local moomoo-service into one push payload.
    Returns None if the service is unreachable.
    """
    with httpx.Client() as client:
        status = fetch_local(client, local_base, "/status")
        if status is None:
            return None  # service is down

        paper = fetch_local(client, local_base, "/paper/dashboard")

    payload = {
        "push_type": "full",
        "agent_version": AGENT_VERSION,
        "status": status,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }

    if paper and not paper.get("error"):
        payload.update({
            "account":      paper.get("account"),
            "account_info": paper.get("account_info"),
            "positions":    paper.get("positions", []),
            "orders":       paper.get("orders", []),
            "deals":        paper.get("deals", []),
        })

    return payload


def push_to_server(
    payload: dict, server_url: str, api_key: str, log: logging.Logger
) -> bool:
    """Push payload to SaaS server. Returns True on success."""
    url = f"{server_url.rstrip('/')}/api/agent/push"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(url, json=payload, headers=headers)
        if r.status_code == 401:
            log.error("Push failed: Invalid API key. Check config.json.")
            return False
        if not r.is_success:
            log.warning("Push failed: server returned %s — %s", r.status_code, r.text[:200])
            return False
        data = r.json()
        log.info(
            "Push successful (%s) — server acknowledged: %s",
            payload.get("push_type"),
            data.get("received_at", "ok"),
        )
        return True
    except httpx.ConnectError:
        log.warning("Cannot reach server at %s. Will retry.", server_url)
        return False
    except Exception as exc:
        log.warning("Push error: %s", exc)
        return False


def run(cfg: dict, log: logging.Logger) -> None:
    push_interval = int(cfg.get("push_interval_seconds", 300))
    retry_interval = int(cfg.get("retry_interval_seconds", 30))
    local_base = cfg["moomoo_service_url"]
    server_url = cfg["server_url"]
    api_key = cfg["api_key"]

    log.info("PortfolioAI Agent v%s started.", AGENT_VERSION)
    log.info("Local service: %s", local_base)
    log.info("Server:        %s", server_url)
    log.info("Push interval: %ss  |  Retry interval: %ss", push_interval, retry_interval)

    last_push_success = False

    while True:
        try:
            log.debug("Collecting data from moomoo-service…")
            payload = build_payload(local_base)

            if payload is None:
                if last_push_success:
                    log.warning("moomoo-service unreachable (PC may have slept). Retrying…")
                    last_push_success = False
                else:
                    log.debug("moomoo-service still unreachable. Waiting…")
                time.sleep(retry_interval)
                continue

            success = push_to_server(payload, server_url, api_key, log)
            last_push_success = success

            if success:
                log.debug("Sleeping %ss until next push…", push_interval)
                time.sleep(push_interval)
            else:
                time.sleep(retry_interval)

        except KeyboardInterrupt:
            log.info("Agent stopped by user.")
            break
        except Exception as exc:
            log.error("Unexpected error: %s. Retrying in %ss.", exc, retry_interval)
            time.sleep(retry_interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="PortfolioAI Local Agent")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Path to config.json")
    args = parser.parse_args()

    cfg = load_config(args.config)
    log = setup_logging(cfg.get("log_level", "INFO"))
    run(cfg, log)


if __name__ == "__main__":
    main()

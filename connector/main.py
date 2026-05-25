#!/usr/bin/env python3
# connector/main.py
"""
Portfolio Connector — entry point.
Bootstraps config, bridge, pusher, and tray.
"""
import sys

from connector.config import load_config, is_configured
from connector.logger import setup_logger
from connector.bridge import Bridge
from connector.pusher import Pusher
from connector.state import AppState


def main() -> None:
    log = setup_logger()
    log.info("Portfolio Connector starting")

    state = AppState()

    # ── First-run setup ──────────────────────────────────────────────────────
    if not is_configured():
        log.info("No config found — opening setup window")
        state.status = "unconfigured"

        completed = []
        def on_setup_complete(_cfg):
            # config is written to disk by setup.show(); load_config() re-reads it below
            completed.append(True)

        from connector.windows import setup
        setup.show(on_complete=on_setup_complete)

        if not completed:
            log.info("Setup cancelled — exiting")
            sys.exit(0)

    # setup.show() writes config.json to disk; load_config() reads it back here
    cfg = load_config()
    log.info("Config loaded — server: %s", cfg.get("server_url", "(unknown)"))

    # ── Bridge ───────────────────────────────────────────────────────────────
    bridge = Bridge()
    state.status = "starting"
    try:
        bridge.start()
    except Exception as exc:
        log.error("Failed to start moomoo-service: %s", exc)
        sys.exit(1)

    # ── Pusher ───────────────────────────────────────────────────────────────
    pusher = Pusher(bridge=bridge, state=state, cfg=cfg)
    pusher.start()

    # ── Tray (blocks until Exit clicked) ────────────────────────────────────
    from connector.tray import ConnectorTray
    from connector.windows import settings, logs

    def on_push_now():
        pusher.push_now()

    def on_settings():
        def on_saved(new_cfg):
            # Hot-reload config into pusher
            pusher._cfg = new_cfg
            log.info("Settings saved and reloaded")
        settings.show(on_saved=on_saved)

    def on_logs():
        logs.show()

    def on_exit():
        log.info("Exit requested")
        pusher.stop()
        bridge.stop()
        tray.stop()

    tray = ConnectorTray(
        state=state,
        on_push_now=on_push_now,
        on_settings=on_settings,
        on_logs=on_logs,
        on_exit=on_exit,
    )
    tray.run()  # blocks
    log.info("Connector exited cleanly")


if __name__ == "__main__":
    main()

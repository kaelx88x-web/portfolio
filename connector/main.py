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
        def on_setup_complete(cfg):
            completed.append(cfg)

        from connector.windows import setup
        setup.show(on_complete=on_setup_complete)

        if not completed:
            log.info("Setup cancelled — exiting")
            sys.exit(0)

    cfg = load_config()
    log.info("Config loaded — server: %s", cfg["server_url"])

    # ── Bridge ───────────────────────────────────────────────────────────────
    bridge = Bridge()
    state.status = "starting"
    bridge.start()

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

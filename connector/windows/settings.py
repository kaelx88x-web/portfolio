# connector/windows/settings.py
"""Settings window — runs in its own thread with its own mainloop."""
import threading
import tkinter as tk
from tkinter import ttk

from connector.config import load_config, save_config
from connector.autostart import enable_autostart, disable_autostart, is_autostart_enabled
from connector.logger import get_logger

_log = get_logger()


def show(on_saved=None) -> None:
    """Open settings window in a daemon thread."""
    def _run():
        cfg = load_config()
        root = tk.Tk()
        root.title("Portfolio Connector — Settings")
        root.resizable(False, False)
        root.geometry("420x310")
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 420) // 2
        y = (root.winfo_screenheight() - 310) // 2
        root.geometry(f"+{x}+{y}")

        tk.Label(root, text="Settings",
                 font=("Segoe UI", 13, "bold")).pack(pady=(18, 10))

        fields = [
            ("API Key",            "api_key",               cfg.get("api_key", "")),
            ("Server URL",         "server_url",            cfg.get("server_url", "")),
            ("Push interval (s)",  "push_interval_seconds", str(cfg.get("push_interval_seconds", 300))),
            ("Retry interval (s)", "retry_interval_seconds",str(cfg.get("retry_interval_seconds", 30))),
        ]
        vars_ = {}
        for label, key, val in fields:
            tk.Label(root, text=label, anchor="w",
                     font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(6, 0))
            v = tk.StringVar(value=val)
            vars_[key] = v
            font = ("Consolas", 9) if key == "api_key" else ("Segoe UI", 9)
            ttk.Entry(root, textvariable=v, width=52, font=font).pack(padx=24, pady=(1, 0))

        autostart_var = tk.BooleanVar(value=is_autostart_enabled())
        ttk.Checkbutton(root, text="Start with Windows",
                        variable=autostart_var).pack(anchor="w", padx=24, pady=(10, 0))

        status_var = tk.StringVar()
        tk.Label(root, textvariable=status_var, fg="#22c55e",
                 font=("Segoe UI", 8)).pack()

        def on_save():
            new_cfg = {
                k: (int(v.get()) if k.endswith("_seconds") else v.get().strip())
                for k, v in vars_.items()
            }
            new_cfg["autostart"] = autostart_var.get()
            save_config(new_cfg)
            if autostart_var.get():
                try:
                    enable_autostart()
                except Exception as e:
                    _log.warning("Autostart failed: %s", e)
            else:
                disable_autostart()
            status_var.set("✓ Saved")
            if on_saved:
                on_saved(new_cfg)

        ttk.Button(root, text="Save", command=on_save).pack(pady=(4, 0))
        root.mainloop()

    threading.Thread(target=_run, daemon=True, name="settings-window").start()

# connector/windows/setup.py
"""
First-run setup dialog.
IMPORTANT: tkinter must run on the main thread or a thread with its own mainloop().
Never call show() from the pusher or bridge threads.
"""
import threading
import tkinter as tk
from tkinter import ttk

from connector.config import save_config, DEFAULT_SERVER_URL
from connector.autostart import enable_autostart, disable_autostart
from connector.logger import get_logger

_log = get_logger()


def show(on_complete) -> None:
    """
    Open the setup dialog on the calling thread (must be main thread).
    Calls on_complete(cfg: dict) when user clicks Connect successfully.
    Blocks until the window is closed.
    """
    def _run():
        root = tk.Tk()
        root.title("Portfolio Connector — Setup")
        root.resizable(False, False)
        root.geometry("420x260")

        root.update_idletasks()
        x = (root.winfo_screenwidth() - 420) // 2
        y = (root.winfo_screenheight() - 260) // 2
        root.geometry(f"+{x}+{y}")

        tk.Label(root, text="Connect to Portfolio App",
                 font=("Segoe UI", 13, "bold")).pack(pady=(18, 4))
        tk.Label(root, text="Paste your API key from Settings → Agent",
                 font=("Segoe UI", 9), fg="#666").pack()

        tk.Label(root, text="API Key", anchor="w",
                 font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(14, 0))
        key_var = tk.StringVar()
        key_entry = ttk.Entry(root, textvariable=key_var, width=52, font=("Consolas", 9))
        key_entry.pack(padx=24, pady=(2, 0))
        key_entry.focus()

        tk.Label(root, text="Server URL", anchor="w",
                 font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(10, 0))
        url_var = tk.StringVar(value=DEFAULT_SERVER_URL)
        ttk.Entry(root, textvariable=url_var, width=52).pack(padx=24, pady=(2, 0))

        autostart_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(root, text="Start with Windows",
                        variable=autostart_var).pack(anchor="w", padx=24, pady=(10, 0))

        error_var = tk.StringVar()
        tk.Label(root, textvariable=error_var, fg="red",
                 font=("Segoe UI", 8)).pack()

        def on_connect():
            key = key_var.get().strip()
            url = url_var.get().strip()
            if not key.startswith("agent_"):
                error_var.set("API key must start with 'agent_'")
                return
            if not url.startswith("http"):
                error_var.set("Server URL must start with http:// or https://")
                return
            cfg = {
                "server_url": url,
                "api_key": key,
                "push_interval_seconds": 300,
                "retry_interval_seconds": 30,
                "autostart": autostart_var.get(),
            }
            save_config(cfg)
            if autostart_var.get():
                try:
                    enable_autostart()
                except Exception as e:
                    _log.warning("Autostart registration failed: %s", e)
            else:
                disable_autostart()
            root.destroy()
            on_complete(cfg)

        ttk.Button(root, text="Connect →", command=on_connect).pack(pady=(6, 0))
        root.mainloop()

    _run()

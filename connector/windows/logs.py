# connector/windows/logs.py
"""Log viewer window — tails connector.log, refreshes every 2 seconds."""
import threading
import tkinter as tk
from tkinter import ttk

from connector.logger import log_path


def show() -> None:
    """Open log viewer in a daemon thread."""
    def _run():
        root = tk.Tk()
        root.title("Portfolio Connector — Logs")
        root.geometry("680x420")
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 680) // 2
        y = (root.winfo_screenheight() - 420) // 2
        root.geometry(f"+{x}+{y}")

        tk.Label(root, text="Connector Logs",
                 font=("Segoe UI", 11, "bold")).pack(pady=(12, 4))

        frame = tk.Frame(root)
        frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        text = tk.Text(frame, font=("Consolas", 8), wrap="none",
                       bg="#0d1117", fg="#c9d1d9", state="disabled")
        vsb = ttk.Scrollbar(frame, orient="vertical", command=text.yview)
        text.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        text.pack(side="left", fill="both", expand=True)

        path = log_path()
        _last_size = [0]
        _follow = [True]

        def refresh():
            if not path.exists():
                root.after(2000, refresh)
                return
            size = path.stat().st_size
            if size != _last_size[0]:
                _last_size[0] = size
                with open(path, encoding="utf-8", errors="replace") as f:
                    content = f.read()
                text.configure(state="normal")
                text.delete("1.0", "end")
                text.insert("end", content)
                text.configure(state="disabled")
                if _follow[0]:
                    text.see("end")
            root.after(2000, refresh)

        follow_var = tk.BooleanVar(value=True)

        def toggle_follow():
            _follow[0] = follow_var.get()

        ttk.Checkbutton(root, text="Follow (auto-scroll)",
                        variable=follow_var, command=toggle_follow).pack(pady=(0, 6))

        root.after(100, refresh)
        root.mainloop()

    threading.Thread(target=_run, daemon=True, name="logs-window").start()

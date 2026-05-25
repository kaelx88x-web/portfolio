# PortfolioAI Local Agent

Runs on your PC alongside Moomoo OpenD. Pushes broker data to your PortfolioAI SaaS account every 5 minutes (configurable).

## Requirements

- Python 3.9+
- Moomoo OpenD running on your PC
- `moomoo-service` running (`python main.py` in the `moomoo-service/` folder)

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Copy the config template:
   ```
   cp config.example.json config.json
   ```

3. Edit `config.json`:
   - `server_url` — your PortfolioAI server URL
   - `api_key` — from **Settings > Agent** in the web app
   - `moomoo_service_url` — keep as `http://localhost:8001` unless you changed the port

4. Run the agent:
   ```
   python agent.py
   ```

## Auto-start on Windows

To run the agent automatically when Windows starts:

1. Open **Task Scheduler**
2. Create Basic Task → "PortfolioAI Agent"
3. Trigger: **At log on**
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\path\to\portfolio-agent\agent.py`
   - Start in: `C:\path\to\portfolio-agent\`

## Behaviour after sleep/wake

The agent detects when moomoo-service is unreachable (e.g. the PC just woke up and OpenD hasn't reconnected yet) and retries every 30 seconds. As soon as OpenD reconnects, the agent pushes data automatically — no manual action needed.

## Configuration options

| Key | Default | Description |
|-----|---------|-------------|
| `server_url` | — | Your PortfolioAI server URL (required) |
| `api_key` | — | Your agent API key from Settings > Agent (required) |
| `moomoo_service_url` | — | Local moomoo-service address (required) |
| `push_interval_seconds` | `300` | How often to push when connected (seconds) |
| `retry_interval_seconds` | `30` | How often to retry when service is unreachable |
| `log_level` | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

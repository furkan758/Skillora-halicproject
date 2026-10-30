import os
import json
import socket
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import uvicorn

from app.config import get_settings


def is_skillora_running(host: str, port: int) -> bool:
    try:
        with urlopen(f"http://{host}:{port}/health", timeout=1) as response:
            result = json.load(response)
        return isinstance(result, dict) and result.get("service") == "skillora-api"
    except (OSError, ValueError, HTTPError, URLError):
        return False


def main() -> int:
    get_settings()  # Load this project's .env before reading server options.
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "8000"))
    if is_skillora_running(host, port):
        print(f"Skillora is already running at http://{host}:{port}")
        print(f"Open the API documentation: http://{host}:{port}/docs")
        print("Stop the existing server with Ctrl+C before starting another one.")
        return 0
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind((host, port))
    except OSError:
        print(f"Cannot use {host}:{port}. Another application is using it or Windows has reserved it.")
        print("Close the other server, or change API_PORT in this project's .env file.")
        return 1
    print(f"Skillora backend: http://{host}:{port}")
    print(f"API documentation: http://{host}:{port}/docs")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


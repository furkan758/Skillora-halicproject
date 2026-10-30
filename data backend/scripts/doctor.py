import sys

import pyodbc

from app.config import get_settings
from app.database import Database
from app.errors import ApiError
from app.repositories.skillora import SkilloraRepository


def main():
    settings = get_settings()
    print("Python:", sys.version.split()[0])
    print("ODBC drivers:", ", ".join(pyodbc.drivers()))
    print("Server:", settings.server or "not configured")
    print("Database:", settings.database or "not configured")
    print("Authentication:", settings.auth)
    result = SkilloraRepository(Database(settings)).ready()
    print("SQL Server and Skillora schema:", result["status"])


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        raise SystemExit(f"Connection check failed: {error.message}") from None


"""Print the current LocalDB named-pipe URL for a compatible jTDS driver."""
import os
from pathlib import Path
import re
import shutil
import subprocess

from app.config import get_settings
from app.database import Database
from app.errors import ApiError


def main():
    settings = get_settings()
    if not settings.server.lower().startswith("(localdb)\\"):
        print("This helper is for LocalDB. Use the configured SQL Server host in DBeaver.")
        return
    # A short read starts the named LocalDB instance if it is currently idle.
    with Database(settings).connect() as connection:
        count = connection.execute("SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID(N'dbo')").fetchone()[0]
    executable = shutil.which("SqlLocalDB")
    if executable is None:
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        for version in ("170", "160", "150"):
            candidate = program_files / "Microsoft SQL Server" / version / "Tools" / "Binn" / "SqlLocalDB.exe"
            if candidate.exists():
                executable = str(candidate)
                break
    if executable is None:
        raise SystemExit("SqlLocalDB.exe was not found. Check the LocalDB installation.")
    instance = settings.server.split("\\", 1)[1]
    result = subprocess.run([executable, "info", instance], capture_output=True, text=True, check=True)
    match = re.search(r"LOCALDB#[A-Za-z0-9]+", result.stdout, re.IGNORECASE)
    if match is None:
        raise SystemExit("No running LocalDB named pipe was found.")
    domain = os.environ.get("USERDOMAIN", os.environ.get("COMPUTERNAME", ""))
    print("Database:", settings.database)
    print("Tables:", count)
    print("Windows authentication; leave the username and password fields empty.")
    print("DBeaver driver: SQL Server (Old driver, jTDS), with the LocalDB-compatible jTDS 1.3.3 JAR.")
    print("Current JDBC URL:")
    print(f"jdbc:jtds:sqlserver://./{settings.database};instance={match.group()};namedPipe=true;domain={domain}")
    print("The pipe can change when LocalDB restarts. Run this helper again if that happens.")
    print("Driver setup instructions: docs/DBEAVER.md")


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        raise SystemExit(error.message) from None


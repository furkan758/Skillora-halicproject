"""Install SQL objects in the explicitly configured database."""
import argparse
from dataclasses import replace
from pathlib import Path
import re

from app.config import ROOT, get_settings
from app.database import Database
from app.errors import ApiError


def execute_file(connection, path: Path):
    for batch in re.split(r"(?im)^\s*GO\s*(?:--[^\n]*)?$", path.read_text(encoding="utf-8-sig")):
        if batch.strip():
            cursor = connection.execute(batch)
            while cursor.nextset():
                pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fresh", action="store_true", help="Install the original schema and views in an empty database.")
    parser.add_argument("--seed", action="store_true", help="Install the optional catalog seed.")
    parser.add_argument("--create-database", action="store_true", help="Create the named database only if it does not exist.")
    args = parser.parse_args()
    settings = get_settings()
    if args.create_database:
        with Database(replace(settings, database="master")).connect() as connection:
            exists = connection.execute("SELECT DB_ID(?)", settings.database).fetchone()[0]
            if exists is None:
                # SQL identifiers cannot be bound; bracket escaping keeps the configured name literal.
                database_name = settings.database.replace("]", "]]")
                connection.execute(f"CREATE DATABASE [{database_name}]")
                print("Created the configured database.")
    files = []
    if args.fresh:
        files.append("01_schema_ddl.sql")
    if args.seed:
        files.append("02_data_seed.sql")
    if args.fresh:
        files += ["03_views.sql", "04_operations.sql"]
    files += ["07_api_operations.sql", "08_lifecycle.sql", "09_employee_versions.sql"]
    with Database(settings).connect() as connection:
        for name in files:
            execute_file(connection, ROOT / "database" / name)
            print("Installed " + name)
    print("Database installation completed. Existing databases were not reset.")


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        raise SystemExit(f"Setup failed: {error.code}: {error.message}") from None


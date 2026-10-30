"""Request-local SQL connections. Stored procedures own write transactions."""
from contextlib import contextmanager
from typing import Any

import pyodbc

from .config import Settings
from .errors import ApiError, database_error

SESSION_OPTIONS = """
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF; SET NOCOUNT ON;
"""


class Database:
    def __init__(self, settings: Settings):
        self.settings = settings

    @contextmanager
    def connect(self):
        connection = None
        try:
            connection_string = self.settings.connection_string()
            connection = pyodbc.connect(connection_string, autocommit=True, timeout=self.settings.connection_timeout)
            connection.timeout = self.settings.query_timeout
            connection.execute(SESSION_OPTIONS)
            yield connection
        except ValueError:
            raise ApiError(503, "database_not_configured", "Configure the SQL Server connection in the backend .env file.") from None
        except pyodbc.Error as error:
            raise database_error(error) from None
        finally:
            if connection is not None:
                connection.close()

    def query(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connect() as connection:
            cursor = connection.execute(sql, params)
            while cursor.description is None:
                if not cursor.nextset():
                    return []
            names = [column[0] for column in cursor.description]
            return [dict(zip(names, row)) for row in cursor.fetchall()]

    def procedure(self, name: str, params: tuple[Any, ...] = ()) -> list[list[dict[str, Any]]]:
        # Procedure names are constants in repository methods, never user input.
        placeholders = ", ".join("?" for _ in params)
        results = []
        with self.connect() as connection:
            cursor = connection.execute(f"EXEC dbo.{name} {placeholders}", params)
            while True:
                if cursor.description is not None:
                    names = [column[0] for column in cursor.description]
                    results.append([dict(zip(names, row)) for row in cursor.fetchall()])
                if not cursor.nextset():
                    break
        return results


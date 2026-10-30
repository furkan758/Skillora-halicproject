"""Environment settings; importing the application never opens a database."""
from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    server: str = ""
    database: str = ""
    driver: str = "ODBC Driver 17 for SQL Server"
    auth: str = "windows"
    username: str = ""
    password: str = ""
    encrypt: str = "yes"
    trust_server_certificate: str = "no"
    connection_timeout: int = 5
    query_timeout: int = 15
    cors_origins: tuple[str, ...] = ("http://127.0.0.1:5173", "http://localhost:5173")

    def connection_string(self) -> str:
        if not self.server or not self.database:
            raise ValueError("Set SQL_SERVER and SQL_DATABASE in .env.")
        if self.auth not in {"windows", "sql"}:
            raise ValueError("SQL_AUTH must be windows or sql.")
        if self.auth == "sql" and (not self.username or not self.password):
            raise ValueError("SQL authentication requires a username and password.")
        if self.encrypt not in {"yes", "no", "strict"} or self.trust_server_certificate not in {"yes", "no"}:
            raise ValueError("Invalid SQL encryption settings.")

        # ODBC braced values escape semicolons and closing braces in credentials.
        def value(text: str) -> str:
            return "{" + text.replace("}", "}}") + "}"

        fields = {"DRIVER": self.driver, "SERVER": self.server, "DATABASE": self.database}
        if self.auth == "windows":
            fields["Trusted_Connection"] = "yes"
        else:
            fields.update(UID=self.username, PWD=self.password)
        fields.update(Encrypt=self.encrypt, TrustServerCertificate=self.trust_server_certificate)
        return ";".join(f"{key}={value(item)}" for key, item in fields.items()) + ";"


@lru_cache
def get_settings() -> Settings:
    load_dotenv(ROOT / ".env", override=False)
    return Settings(
        server=os.getenv("SQL_SERVER", ""),
        database=os.getenv("SQL_DATABASE", ""),
        driver=os.getenv("SQL_DRIVER", "ODBC Driver 17 for SQL Server"),
        auth=os.getenv("SQL_AUTH", "windows").lower(),
        username=os.getenv("SQL_USERNAME", ""),
        password=os.getenv("SQL_PASSWORD", ""),
        encrypt=os.getenv("SQL_ENCRYPT", "yes").lower(),
        trust_server_certificate=os.getenv("SQL_TRUST_SERVER_CERTIFICATE", "no").lower(),
        connection_timeout=int(os.getenv("SQL_CONNECTION_TIMEOUT", "5")),
        query_timeout=int(os.getenv("SQL_QUERY_TIMEOUT", "15")),
        cors_origins=tuple(origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if origin.strip()),
    )


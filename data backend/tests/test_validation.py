import pyodbc
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import database_error
from app.main import create_app


@pytest.fixture
def no_database():
    with TestClient(create_app(Settings())) as client:
        yield client


def test_liveness_and_docs_do_not_require_sql(no_database):
    assert no_database.get("/health").json()["status"] == "ok"
    assert no_database.get("/docs").status_code == 200
    assert no_database.get("/openapi.json").status_code == 200
    response = no_database.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["code"] == "database_not_configured"


@pytest.mark.parametrize("body", [{"name": " "}, {"name": "X", "folderId": "1"},
    {"name": "X", "folderId": True}, {"name": "X", "folderId": 1, "unexpected": 1}])
def test_invalid_skill_never_reaches_sql(no_database, body):
    assert no_database.post("/api/skills", json=body).status_code == 422


def test_ids_and_pages_are_validated(no_database):
    assert no_database.get("/api/employees/0").status_code == 422
    assert no_database.get("/api/employees?page=0").status_code == 422
    assert no_database.post("/api/scenarios/candidates", json={"skillId": 1, "page": -1}).status_code == 422


def test_sql_errors_hide_raw_query_and_password():
    error = database_error(pyodbc.Error("42000", "[SQL Server]Scenario changed (51045) secret SQL"))
    assert error.status == 409 and error.code == "stale_scenario"
    assert "secret" not in error.message


def test_odbc_connection_values_are_escaped():
    connection = Settings(server="server", database="db", auth="sql", username="user", password="x};UID=other").connection_string()
    assert "PWD={x}};UID=other}" in connection


def test_cors_is_limited_to_frontend_origins(no_database):
    response = no_database.options("/api/employees", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    response = no_database.options("/api/employees", headers={"Origin": "https://other.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in response.headers

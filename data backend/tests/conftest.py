from dataclasses import replace
import os
import uuid

from fastapi.testclient import TestClient
import pyodbc
import pytest

from app.config import ROOT, Settings
from app.database import SESSION_OPTIONS
from app.main import create_app
from scripts.install_database import execute_file


@pytest.fixture(scope="session")
def sql_settings():
    server = os.getenv("SKILLORA_TEST_SERVER")
    if not server:
        pytest.skip("Set SKILLORA_TEST_SERVER to run disposable SQL integration tests.")
    database = "SkilloraApiTest_" + uuid.uuid4().hex[:12]
    settings = Settings(server=server, database=database,
                        driver=os.getenv("SKILLORA_TEST_DRIVER", "ODBC Driver 17 for SQL Server"),
                        encrypt="no" if server.lower().startswith("(localdb)") else "yes",
                        trust_server_certificate="yes")
    admin = pyodbc.connect(replace(settings, database="master").connection_string(), autocommit=True)
    created = False
    try:
        admin.execute(f"CREATE DATABASE [{database}]")
        created = True
        connection = pyodbc.connect(settings.connection_string(), autocommit=True)
        try:
            connection.execute(SESSION_OPTIONS)
            for name in ["01_schema_ddl.sql", "02_data_seed.sql", "03_views.sql", "04_operations.sql", "07_api_operations.sql", "08_lifecycle.sql", "09_employee_versions.sql"]:
                execute_file(connection, ROOT / "database" / name)
        finally:
            connection.close()
        yield settings
    finally:
        # This exact fresh random database is the only database this fixture may remove.
        if created and database.startswith("SkilloraApiTest_"):
            admin.execute(f"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE")
            admin.execute(f"DROP DATABASE [{database}]")
        admin.close()


@pytest.fixture
def client(sql_settings):
    with TestClient(create_app(sql_settings)) as client:
        yield client


@pytest.fixture
def resources(client):
    folder = client.post("/api/folders", json={"name": "Test " + uuid.uuid4().hex[:10]}).json()
    skill = client.post("/api/skills", json={"name": "Skill " + uuid.uuid4().hex[:10], "folderId": folder["id"]}).json()
    department = client.get("/api/departments").json()[0]
    return {"folder": folder, "skill": skill, "department": department}


def employee_payload(resources, level=5, available=True, first_name="Test", skills=True):
    return {"firstName": first_name, "lastName": "Person", "departmentId": resources["department"]["id"],
            "jobTitle": "Developer", "gender": "Not specified", "isAvailable": available,
            "skills": [{"skillId": resources["skill"]["id"], "proficiencyLevel": level,
                        "experienceYears": 2.5}] if skills else []}


def scenario_payload(resources, employees, title=None):
    return {"clientName": "Test client", "projectTitle": title or "Project " + uuid.uuid4().hex[:10],
            "projectBrief": "Integration fixture", "requiredPeople": len(employees), "onlyAvailable": True,
            "requirements": [{"skillId": resources["skill"]["id"], "count": len(employees)}],
            "assignments": [{"employeeId": person["id"], "skillId": resources["skill"]["id"]} for person in employees]}

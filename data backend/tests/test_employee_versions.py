from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
import pyodbc

from app.database import SESSION_OPTIONS
from app.main import create_app
from app.config import ROOT
from scripts.install_database import execute_file
from conftest import employee_payload


def create_person(client, resources):
    payload = employee_payload(resources)
    response = client.post("/api/employees", json=payload)
    assert response.status_code == 201, response.text
    return payload, response.json()


def test_employee_requires_valid_viewed_version(client, resources):
    payload, person = create_person(client, resources)
    url = f'/api/employees/{person["id"]}'
    missing = client.put(url, json=payload)
    assert missing.status_code == 422
    assert missing.json()["code"] == "employee_version_required"
    for version in [True, 1, "1", "0xINVALID", "0x00000000000000001"]:
        assert client.put(url, json={**payload, "expectedVersion": version}).status_code == 422
    assert client.post("/api/employees", json={**payload, "expectedVersion": person["version"]}).status_code == 422
    assert client.get(url).json() == person


def test_stale_employee_form_cannot_overwrite_profile_or_assessments(client, resources):
    payload, person = create_person(client, resources)
    url = f'/api/employees/{person["id"]}'
    first_payload = {**payload, "expectedVersion": person["version"], "isAvailable": False,
                     "skills": [{**payload["skills"][0], "proficiencyLevel": 2}]}
    first = client.put(url, json=first_payload)
    assert first.status_code == 200, (person["version"], first.text)
    assert first.json()["version"] != person["version"]
    stale = client.put(url, json={**payload, "expectedVersion": person["version"], "jobTitle": "Old form"})
    assert stale.status_code == 409 and stale.json()["code"] == "stale_employee"
    assert client.get(url).json() == first.json()
    retry = client.put(url, json={**first_payload, "expectedVersion": first.json()["version"], "jobTitle": "Reviewed latest"})
    assert retry.status_code == 200
    assert retry.json()["isAvailable"] is False
    assert retry.json()["skills"][0]["proficiencyLevel"] == 2


def test_parallel_employee_edits_accept_only_one_current_version(client, resources, sql_settings):
    payload, person = create_person(client, resources)
    url = f'/api/employees/{person["id"]}'
    def write(title):
        with TestClient(create_app(sql_settings)) as other:
            return other.put(url, json={**payload, "expectedVersion": person["version"], "jobTitle": title})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(write, ["First tab", "Second tab"]))
    assert sorted(result.status_code for result in results) == [200, 409]
    winner = next(result.json() for result in results if result.status_code == 200)
    assert client.get(url).json() == winner


def test_skill_retirement_invalidates_old_employee_form_even_after_restore(client, resources):
    payload, person = create_person(client, resources)
    skill_url = f'/api/skills/{resources["skill"]["id"]}'
    assert client.request("DELETE", skill_url, json={"confirmAssignedRemoval": True}).status_code == 204
    url = f'/api/employees/{person["id"]}'
    retired_conflict = client.put(url, json={**payload, "expectedVersion": person["version"]})
    assert retired_conflict.status_code == 409 and retired_conflict.json()["code"] == "stale_employee"
    assert client.post(skill_url + "/restore").status_code == 200
    latest = client.get(url).json()
    assert latest["skills"] == [] and latest["version"] != person["version"]
    stale = client.put(url, json={**payload, "expectedVersion": person["version"]})
    assert stale.status_code == 409
    assert client.get(url).json()["skills"] == []


def test_sql_profile_and_skill_changes_invalidate_open_forms(client, resources, sql_settings):
    payload, person = create_person(client, resources)
    url = f'/api/employees/{person["id"]}'
    with pyodbc.connect(sql_settings.connection_string(), autocommit=True) as connection:
        connection.execute(SESSION_OPTIONS)
        connection.execute("UPDATE dbo.EMPLOYEE_SKILLS SET ProficiencyLevel=2 WHERE EmployeeID=?", person["id"])
        after_skill = client.get(url).json()
        assert after_skill["version"] != person["version"]
        assert client.put(url, json={**payload, "expectedVersion": person["version"]}).status_code == 409
        connection.execute("UPDATE dbo.EMPLOYEES SET IsAvailable=0 WHERE EmployeeID=?", person["id"])
        after_profile = client.get(url).json()
        assert after_profile["version"] != after_skill["version"]
        assert client.put(url, json={**payload, "expectedVersion": after_skill["version"]}).status_code == 409
        assert after_profile["skills"][0]["proficiencyLevel"] == 2


def test_employee_migration_is_repeatable_and_keeps_data(client, resources, sql_settings):
    _, person = create_person(client, resources)
    with pyodbc.connect(sql_settings.connection_string(), autocommit=True) as connection:
        execute_file(connection, ROOT / "database" / "09_employee_versions.sql")
        execute_file(connection, ROOT / "database" / "09_employee_versions.sql")
    assert client.get(f'/api/employees/{person["id"]}').json() == person

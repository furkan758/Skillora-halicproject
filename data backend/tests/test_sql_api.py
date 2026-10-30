from concurrent.futures import ThreadPoolExecutor
import uuid

from fastapi.testclient import TestClient
import pyodbc
import pytest

from app.database import SESSION_OPTIONS
from app.main import create_app
from conftest import employee_payload, scenario_payload

pytestmark = pytest.mark.integration


def create_employee(client, resources, **kwargs):
    response = client.post("/api/employees", json=employee_payload(resources, **kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def test_catalog_page_counts_and_protected_default(client):
    assert client.get("/health/ready").status_code == 200
    catalog = client.get("/api/catalog").json()
    assert len(catalog["folders"]) >= 16 and len(catalog["skills"]) >= 39
    first = client.get("/api/folders").json()
    assert first["pageSize"] == 15 and len(first["items"]) == 15
    second = client.get("/api/folders?page=2").json()
    assert second["total"] == first["total"] and second["items"]
    assert len(client.get("/api/skills").json()["items"]) == 15
    assert client.get("/api/skills?page=2").json()["items"]
    default = next(folder for folder in catalog["folders"] if folder["isDefault"])
    assert client.delete(f'/api/folders/{default["id"]}').status_code == 409
    assert client.put(f'/api/folders/{default["id"]}', json={"name": "Changed"}).status_code == 409


def test_catalog_crud_duplicate_names_and_moving_folder(client, resources):
    skill, folder = resources["skill"], resources["folder"]
    assert client.post("/api/folders", json={"name": "  " + folder["name"].upper() + "  "}).status_code == 409
    changed = client.put(f'/api/skills/{skill["id"]}', json={"name": skill["name"] + " renamed", "folderId": folder["id"]})
    assert changed.status_code == 200
    assert client.delete(f'/api/folders/{folder["id"]}').status_code == 204
    moved = client.get(f'/api/skills/{skill["id"]}').json()
    assert moved["folderName"] == "Unsorted" and moved["id"] == skill["id"]
    assert client.get(f'/api/folders/{folder["id"]}').status_code == 404


def test_employee_profile_skills_and_validation_rollback(client, resources):
    employee = create_employee(client, resources, level=None)
    assert employee["skills"][0]["proficiencyLevel"] is None
    assert employee["skills"][0]["experienceYears"] == 2.5
    assert client.get("/api/employees").json()["total"] > 0
    assert client.get(f'/api/employees/{employee["id"]}').status_code == 200
    body = employee_payload(resources, level=4)
    body["expectedVersion"] = employee["version"]
    body["firstName"] = "Changed"
    body["skills"][0]["skillId"] = 2147483647
    assert client.put(f'/api/employees/{employee["id"]}', json=body).status_code == 422
    assert client.get(f'/api/employees/{employee["id"]}').json()["firstName"] == employee["firstName"]
    body = employee_payload(resources, level=4)
    body["expectedVersion"] = employee["version"]
    assert client.put(f'/api/employees/{employee["id"]}', json=body).json()["skills"][0]["proficiencyLevel"] == 4


def test_people_are_paginated_before_skills_are_joined(client, resources):
    name = "Page" + uuid.uuid4().hex[:8]
    for _ in range(16):
        create_employee(client, resources, first_name=name)
    first = client.get("/api/employees", params={"q": name}).json()
    second = client.get("/api/employees", params={"q": name, "page": 2}).json()
    assert first["total"] == 16 and len(first["items"]) == 15
    assert len(second["items"]) == 1
    assert len({person["id"] for person in first["items"] + second["items"]}) == 16


def test_candidate_ranking_pages_availability_and_unknown_levels(client, resources):
    people = [create_employee(client, resources, level=level, first_name=f"Candidate{index}")
              for index, level in enumerate([1, 5, 4, 2, 5, 3])]
    create_employee(client, resources, level=None)
    create_employee(client, resources, level=5, available=False)
    request = {"skillId": resources["skill"]["id"], "onlyAvailable": True}
    first = client.post("/api/scenarios/candidates", json=request).json()
    assert first["total"] == 6 and len(first["items"]) == 5
    assert [item["compatibility"] for item in first["items"]] == [100, 100, 80, 60, 40]
    second = client.post("/api/scenarios/candidates", json={**request, "page": 2}).json()
    assert len(second["items"]) == 1 and second["items"][0]["compatibility"] == 20
    empty = client.post("/api/scenarios/candidates", json={**request, "page": 99}).json()
    assert empty["items"] == [] and empty["total"] == 6
    excluded = client.post("/api/scenarios/candidates", json={**request, "excludedEmployeeIds": [people[0]["id"]]}).json()
    assert excluded["total"] == 5


def test_scenario_score_suffix_reopen_and_stale_edit(client, resources):
    people = [create_employee(client, resources, level=level) for level in [5, 4, 5]]
    body = scenario_payload(resources, people)
    response = client.post("/api/scenarios", json=body)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["averageCompatibility"] == 93 and saved["selectedPeople"] == 3
    assert saved["version"] == 1 and len(saved["assignments"]) == 3
    assert client.get("/api/scenarios").json()["items"]
    duplicate = client.post("/api/scenarios", json=body).json()
    assert duplicate["projectTitle"] == body["projectTitle"] + " (2)"
    assert client.get(f'/api/scenarios/{saved["id"]}').json() == saved
    assert client.put(f'/api/scenarios/{saved["id"]}', json=body).status_code == 422
    edit = {**body, "expectedVersion": 1, "projectBrief": "Changed brief"}
    changed = client.put(f'/api/scenarios/{saved["id"]}', json=edit).json()
    assert changed["id"] == saved["id"] and changed["createdAt"] == saved["createdAt"] and changed["version"] == 2
    assert client.put(f'/api/scenarios/{saved["id"]}', json=edit).status_code == 409


def test_duplicate_employee_and_incomplete_quotas_are_rejected(client, resources):
    person = create_employee(client, resources)
    body = scenario_payload(resources, [person, person])
    assert client.post("/api/scenarios", json=body).status_code == 422
    body = scenario_payload(resources, [person])
    body["requiredPeople"] = 2
    assert client.post("/api/scenarios", json=body).status_code == 422
    body = scenario_payload(resources, [person])
    body["assignments"] = []
    assert client.post("/api/scenarios", json=body).status_code == 422


def test_eligibility_rechecked_at_save(client, resources):
    person = create_employee(client, resources, available=False)
    response = client.post("/api/scenarios", json=scenario_payload(resources, [person]))
    assert response.status_code == 409 and response.json()["code"] == "ineligible_selection"


def test_confirmed_skill_removal_preserves_saved_assessment(client, resources):
    person = create_employee(client, resources, level=5)
    saved = client.post("/api/scenarios", json=scenario_payload(resources, [person])).json()
    # A profile edit must not rewrite the already selected proficiency.
    changed = client.put(f'/api/employees/{person["id"]}', json={**employee_payload(resources, level=2), "expectedVersion": person["version"]})
    assert changed.status_code == 200
    assert client.get(f'/api/scenarios/{saved["id"]}').json()["averageCompatibility"] == 100
    response = client.delete(f'/api/skills/{resources["skill"]["id"]}')
    assert response.status_code == 409 and response.json()["affectedEmployees"][0]["id"] == person["id"]
    confirmed = client.request("DELETE", f'/api/skills/{resources["skill"]["id"]}', json={"confirmAssignedRemoval": True})
    assert confirmed.status_code == 204
    assert client.get(f'/api/employees/{person["id"]}').json()["skills"] == []
    assert client.get(f'/api/scenarios/{saved["id"]}').json()["averageCompatibility"] == 100


def test_employee_retirement_keeps_history(client, resources):
    person = create_employee(client, resources)
    saved = client.post("/api/scenarios", json=scenario_payload(resources, [person])).json()
    assert client.delete(f'/api/employees/{person["id"]}').status_code == 204
    assert client.get(f'/api/employees/{person["id"]}').status_code == 404
    assert client.get(f'/api/scenarios/{saved["id"]}').json()["selectedPeople"] == 1


def test_parallel_saves_allocate_distinct_titles(client, resources, sql_settings):
    person = create_employee(client, resources)
    body = scenario_payload(resources, [person])
    def save(_):
        with TestClient(create_app(sql_settings)) as parallel:
            return parallel.post("/api/scenarios", json=body)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(save, range(2)))
    assert all(response.status_code == 201 for response in responses)
    assert {response.json()["projectTitle"] for response in responses} == {body["projectTitle"], body["projectTitle"] + " (2)"}


def test_parallel_edits_allow_only_one_current_version(client, resources, sql_settings):
    person = create_employee(client, resources)
    body = scenario_payload(resources, [person])
    saved = client.post("/api/scenarios", json=body).json()
    def edit(index):
        with TestClient(create_app(sql_settings)) as parallel:
            return parallel.put(f'/api/scenarios/{saved["id"]}',
                json={**body, "expectedVersion": 1, "projectBrief": f"Edit {index}"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(edit, range(2)))
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert client.get(f'/api/scenarios/{saved["id"]}').json()["version"] == 2


def test_team_average_weights_people_across_different_skills(client, resources):
    people = [create_employee(client, resources, level=5) for _ in range(2)]
    other_skill = client.post("/api/skills", json={"name": "Second " + uuid.uuid4().hex[:8],
        "folderId": resources["folder"]["id"]}).json()
    other_resources = {**resources, "skill": other_skill}
    third = create_employee(client, other_resources, level=4)
    body = scenario_payload(resources, people + [third])
    body["requirements"] = [{"skillId": resources["skill"]["id"], "count": 2},
                            {"skillId": other_skill["id"], "count": 1}]
    body["assignments"][-1]["skillId"] = other_skill["id"]
    saved = client.post("/api/scenarios", json=body)
    assert saved.status_code == 201, saved.text
    assert saved.json()["averageCompatibility"] == 93


def test_search_strings_are_values_not_sql(client):
    for endpoint in ["folders", "skills", "employees", "scenarios"]:
        response = client.get("/api/" + endpoint, params={"q": "' OR 1=1--"})
        assert response.status_code == 200 and response.json()["total"] == 0


def test_api_role_can_write_through_procedures_without_direct_table_writes(sql_settings):
    connection = pyodbc.connect(sql_settings.connection_string(), autocommit=True)
    try:
        connection.execute(SESSION_OPTIONS)
        connection.execute("CREATE USER ApiFixture WITHOUT LOGIN; ALTER ROLE skillora_app ADD MEMBER ApiFixture;")
        cursor = connection.cursor()
        cursor.execute("EXECUTE AS USER=N'ApiFixture';")
        cursor.execute("EXEC dbo.usp_SaveFolder ?, ?, ?", "Role " + uuid.uuid4().hex[:8], None, None)
        assert cursor.fetchone()[0] > 0
        while cursor.nextset():
            pass
        assert cursor.execute("SELECT COUNT(*) FROM dbo.vw_SCENARIO_REQUIREMENTS").fetchone()[0] >= 0
        with pytest.raises(pyodbc.Error):
            cursor.execute("UPDATE dbo.SCENARIOS SET ProjectBrief=N'Bypass'")
        cursor.execute("REVERT")
    finally:
        connection.close()

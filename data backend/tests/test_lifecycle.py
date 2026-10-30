import pytest
from conftest import employee_payload, scenario_payload
from app.database import Database
pytestmark = pytest.mark.integration

def test_restore_skill_keeps_identity_without_restoring_assignments(client, resources):
    person = client.post("/api/employees", json=employee_payload(resources)).json()
    scenario = client.post("/api/scenarios", json=scenario_payload(resources, [person])).json()
    skill = resources["skill"]
    assert client.request("DELETE", f"/api/skills/{skill['id']}", json={"confirmAssignedRemoval":True}).status_code == 204
    duplicate = client.post("/api/skills", json={"name":skill["name"],"folderId":resources["folder"]["id"]})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "retired_skill"
    assert duplicate.json()["retiredSkillId"] == skill["id"]
    retired = client.get("/api/retired-skills", params={"q":skill["name"]}).json()
    assert retired["total"] == 1 and retired["items"][0]["id"] == skill["id"]
    restored = client.post(f"/api/skills/{skill['id']}/restore")
    assert restored.status_code == 200 and restored.json()["id"] == skill["id"]
    assert restored.json()["teamMemberCount"] == 0
    assert client.get(f"/api/employees/{person['id']}").json()["skills"] == []
    assert client.get(f"/api/scenarios/{scenario['id']}").json()["averageCompatibility"] == 100
    assert client.post(f"/api/skills/{skill['id']}/restore").status_code == 200
    assert client.get("/api/retired-skills", params={"q":skill["name"]}).json()["total"] == 0

def test_scenario_archive_restore_and_versioned_delete(client, resources, sql_settings):
    person = client.post("/api/employees", json=employee_payload(resources)).json()
    payload = scenario_payload(resources, [person])
    record = client.post("/api/scenarios", json=payload).json()
    base = f"/api/scenarios/{record['id']}"
    assert client.request("DELETE", base, json={"expectedVersion":1}).json()["code"] == "archive_required"
    archived = client.post(base+"/archive", json={"expectedVersion":1})
    assert archived.status_code == 200
    assert archived.json()["status"] == "ARCHIVED" and archived.json()["version"] == 2
    assert archived.json()["assignments"] == record["assignments"]
    assert client.get("/api/scenarios", params={"q":record["projectTitle"]}).json()["total"] == 0
    assert client.get("/api/scenarios", params={"q":record["projectTitle"],"status":"ARCHIVED"}).json()["total"] == 1
    assert client.put(base, json={**payload,"expectedVersion":2}).json()["code"] == "archived_scenario"
    assert client.post(base+"/restore", json={"expectedVersion":1}).json()["code"] == "stale_scenario"
    restored = client.post(base+"/restore", json={"expectedVersion":2}).json()
    assert restored["status"] == "SAVED" and restored["version"] == 3
    assert restored["averageCompatibility"] == record["averageCompatibility"]
    assert client.post(base+"/archive", json={"expectedVersion":3}).json()["version"] == 4
    assert client.request("DELETE", base, json={"expectedVersion":3}).status_code == 409
    assert client.request("DELETE", base, json={"expectedVersion":4}).status_code == 204
    assert client.get(base).status_code == 404
    assert client.get(f"/api/employees/{person['id']}").status_code == 200
    db = Database(sql_settings)
    for table in ["SCENARIO_ASSIGNMENTS","SCENARIO_REQUIREMENTS"]:
        assert db.query(f"SELECT COUNT(*) AS Total FROM dbo.{table} WHERE ScenarioID=?", (record["id"],))[0]["Total"] == 0

def test_missing_lifecycle_versions_are_rejected(client):
    assert client.post("/api/scenarios/1/archive",json={}).status_code == 422
    assert client.request("DELETE","/api/scenarios/1",json={"expectedVersion":True}).status_code == 422
    assert client.post("/api/skills/2147483647/restore").status_code == 404

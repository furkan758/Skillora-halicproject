import uuid
import pytest
from conftest import employee_payload

pytestmark = pytest.mark.integration

def test_directory_search_covers_names_roles_active_skills_and_filters(client, resources):
    token = uuid.uuid4().hex[:10]
    role = "API Reviewer " + token
    extra = client.post("/api/skills", json={"name":"Other "+token,"folderId":resources["folder"]["id"]}).json()
    people = []
    for index in range(2):
        payload = employee_payload(resources, level=None if index else 4, available=index==0, first_name="Directory"+token+str(index))
        payload["jobTitle"] = role
        payload["skills"].append({"skillId":extra["id"],"proficiencyLevel":3,"experienceYears":None})
        response = client.post("/api/employees",json=payload)
        assert response.status_code == 201
        people.append(response.json())
    for query in [role, role.lower(), resources["skill"]["name"]]:
        page = client.get("/api/employees",params={"q":query}).json()
        assert page["total"] == 2
        assert {p["id"] for p in page["items"]} == {p["id"] for p in people}
        assert all(len(p["skills"]) == 2 for p in page["items"])
    available = client.get("/api/employees",params={"q":role,"available":"true","departmentId":resources["department"]["id"]}).json()
    assert available["total"] == 1 and available["items"][0]["id"] == people[0]["id"]
    name = client.get("/api/employees",params={"q":people[0]["firstName"]}).json()
    assert name["total"] == 1
    assert client.request("DELETE",f'/api/skills/{resources["skill"]["id"]}',json={"confirmAssignedRemoval":True}).status_code == 204
    assert client.get("/api/employees",params={"q":resources["skill"]["name"]}).json()["total"] == 0
    assert client.get("/api/employees",params={"q":role}).json()["total"] == 2
    assert client.delete(f'/api/employees/{people[0]["id"]}').status_code == 204
    assert client.get("/api/employees",params={"q":role}).json()["total"] == 1

def test_skill_search_pages_distinct_people_and_returns_their_complete_profiles(client, resources):
    # Both skill names match; each person must still count only once.
    extra = client.post("/api/skills",json={"name":"Extra "+resources["skill"]["name"],"folderId":resources["folder"]["id"]}).json()
    created = []
    for index in range(16):
        payload = employee_payload(resources,first_name=f"SearchPerson{index:02d}")
        payload["skills"].append({"skillId":extra["id"],"proficiencyLevel":2,"experienceYears":1.5})
        response = client.post("/api/employees",json=payload)
        assert response.status_code == 201
        created.append(response.json()["id"])
    first = client.get("/api/employees",params={"q":resources["skill"]["name"],"page":1}).json()
    second = client.get("/api/employees",params={"q":resources["skill"]["name"],"page":2}).json()
    assert first["total"] == second["total"] == 16
    assert len(first["items"]) == 15 and len(second["items"]) == 1
    rows = first["items"] + second["items"]
    assert {p["id"] for p in rows} == set(created)
    assert all(len(p["skills"]) == 2 for p in rows)

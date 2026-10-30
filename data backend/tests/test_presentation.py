import pytest
from app.database import Database
from app.repositories.skillora import SkilloraRepository
from scripts.seed_presentation import seed_presentation

pytestmark = pytest.mark.integration

def test_presentation_seed_is_repeatable_and_real_pages_are_complete(sql_settings, client):
    repo = SkilloraRepository(Database(sql_settings))
    first = seed_presentation(repo)
    second = seed_presentation(repo)
    assert first == second
    assert first["overview"]["employeeCount"] >= 42
    assert first["overview"]["skillCount"] >= 90
    assert first["folders"] >= 20
    assert first["scenarios"] >= 16
    overview = client.get("/api/overview").json()
    assert overview == repo.overview()
    assert overview["employeeCount"] == client.get("/api/employees").json()["total"]
    react = next(s for s in repo.catalog()["skills"] if s["name"] == "React")
    one = client.post("/api/scenarios/candidates", json={"skillId": react["id"], "onlyAvailable": True, "page": 1}).json()
    two = client.post("/api/scenarios/candidates", json={"skillId": react["id"], "onlyAvailable": True, "page": 2}).json()
    assert len(one["items"]) == 5 and two["items"]
    assert one["items"][-1]["compatibility"] >= two["items"][0]["compatibility"]
    saved = client.get("/api/scenarios?q=Corporate%20website").json()
    assert any(s["projectTitle"].endswith("(2)") for s in saved["items"])
    assert client.get("/api/scenarios?page=2").json()["items"]

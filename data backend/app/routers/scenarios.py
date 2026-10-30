from typing import Literal

from fastapi import APIRouter, Response

from ..dependencies import Repository
from ..responses import Candidate, Page, Scenario, ScenarioHeader
from ..schemas import CandidateInput, ScenarioInput, ScenarioVersion
from .catalog import PageNumber, RecordId, Search

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


@router.post("/candidates", response_model=Page[Candidate])
def candidates(data: CandidateInput, repo: Repository):
    """Rank one required skill before paging; exclude employees selected in other slots."""
    return repo.candidates(data)


@router.get("", response_model=Page[ScenarioHeader])
def scenarios(repo: Repository, page: PageNumber = 1, q: Search = "",
              status: Literal["DRAFT", "SAVED", "ARCHIVED"] | None = None):
    return repo.list_scenarios(page, q.strip(), status)


@router.get("/{scenario_id}", response_model=Scenario)
def get_scenario(scenario_id: RecordId, repo: Repository):
    """Return requirements, saved selections and version for reopening every step."""
    return repo.get_scenario(scenario_id)


@router.post("", response_model=Scenario, status_code=201)
def create_scenario(data: ScenarioInput, repo: Repository):
    """Validate and save the complete team; SQL allocates the unique display title."""
    return repo.save_scenario(data)


@router.put("/{scenario_id}", response_model=Scenario)
def update_scenario(scenario_id: RecordId, data: ScenarioInput, repo: Repository):
    """Require expectedVersion to prevent overwriting another user's changes."""
    return repo.save_scenario(data, scenario_id)


@router.post("/{scenario_id}/archive", response_model=Scenario)
def archive_scenario(scenario_id: RecordId, data: ScenarioVersion, repo: Repository):
    return repo.scenario_lifecycle(scenario_id, data.expectedVersion, "archive")


@router.post("/{scenario_id}/restore", response_model=Scenario)
def restore_scenario(scenario_id: RecordId, data: ScenarioVersion, repo: Repository):
    return repo.scenario_lifecycle(scenario_id, data.expectedVersion, "restore")


@router.delete("/{scenario_id}", status_code=204)
def delete_scenario(scenario_id: RecordId, data: ScenarioVersion, repo: Repository):
    """Permanently remove only an archived scenario or a legacy draft."""
    repo.scenario_lifecycle(scenario_id, data.expectedVersion, "delete")
    return Response(status_code=204)


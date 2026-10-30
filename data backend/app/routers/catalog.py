from typing import Annotated

from fastapi import APIRouter, Body, Path, Query, Response

from ..dependencies import Repository
from ..responses import Catalog, Department, Folder, Overview, Page, Skill
from ..schemas import ConfirmRemoval, FolderInput, SkillInput

router = APIRouter(tags=["Catalog"])
RecordId = Annotated[int, Path(gt=0, le=2147483647)]
PageNumber = Annotated[int, Query(ge=1, le=1000000)]
Search = Annotated[str, Query(max_length=200)]


@router.get("/overview", response_model=Overview)
def overview(repo: Repository):
    """Workspace totals across every page, independent of directory filters."""
    return repo.overview()


@router.get("/departments", response_model=list[Department])
def departments(repo: Repository):
    return repo.departments()


@router.get("/catalog", response_model=Catalog)
def catalog(repo: Repository):
    """Full ID-based catalog for selection controls; list endpoints are paginated."""
    return repo.catalog()


@router.get("/folders", response_model=Page[Folder])
def folders(repo: Repository, page: PageNumber = 1, q: Search = ""):
    return repo.list_folders(page, q.strip())


@router.get("/folders/{folder_id}", response_model=Folder)
def get_folder(folder_id: RecordId, repo: Repository):
    return repo.get_folder(folder_id)


@router.post("/folders", response_model=Folder, status_code=201)
def create_folder(data: FolderInput, repo: Repository):
    return repo.save_folder(data)


@router.put("/folders/{folder_id}", response_model=Folder)
def update_folder(folder_id: RecordId, data: FolderInput, repo: Repository):
    return repo.save_folder(data, folder_id)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: RecordId, repo: Repository):
    repo.delete_folder(folder_id)
    return Response(status_code=204)


@router.get("/skills", response_model=Page[Skill])
def skills(repo: Repository, page: PageNumber = 1, q: Search = "",
           folderId: Annotated[int | None, Query(gt=0, le=2147483647)] = None):
    return repo.list_skills(page, q.strip(), folderId)


@router.get("/retired-skills", response_model=Page[Skill])
def retired_skills(repo: Repository, page: PageNumber = 1, q: Search = ""):
    return repo.retired_skills(page, q.strip())


@router.post("/skills/{skill_id}/restore", response_model=Skill)
def restore_skill(skill_id: RecordId, repo: Repository):
    """Restore the original skill ID without reactivating employee assignments."""
    return repo.restore_skill(skill_id)


@router.get("/skills/{skill_id}", response_model=Skill)
def get_skill(skill_id: RecordId, repo: Repository):
    return repo.get_skill(skill_id)


@router.post("/skills", response_model=Skill, status_code=201)
def create_skill(data: SkillInput, repo: Repository):
    return repo.save_skill(data)


@router.put("/skills/{skill_id}", response_model=Skill)
def update_skill(skill_id: RecordId, data: SkillInput, repo: Repository):
    return repo.save_skill(data, skill_id)


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(skill_id: RecordId, repo: Repository,
                 confirmation: Annotated[ConfirmRemoval | None, Body()] = None):
    """Assigned skills return HTTP 409 with affectedEmployees until confirmed."""
    repo.delete_skill(skill_id, confirmation.confirmAssignedRemoval if confirmation else False)
    return Response(status_code=204)


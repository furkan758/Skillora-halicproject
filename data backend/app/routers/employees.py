from typing import Annotated

from fastapi import APIRouter, Query, Response

from ..dependencies import Repository
from ..responses import Employee, Page
from ..schemas import EmployeeInput
from .catalog import PageNumber, RecordId, Search

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=Page[Employee])
def employees(repo: Repository, page: PageNumber = 1, q: Search = "",
              departmentId: Annotated[int | None, Query(gt=0, le=2147483647)] = None,
              available: bool | None = None):
    return repo.list_employees(page, q.strip(), departmentId, available)


@router.get("/{employee_id}", response_model=Employee)
def get_employee(employee_id: RecordId, repo: Repository):
    return repo.get_employee(employee_id)


@router.post("", response_model=Employee, status_code=201)
def create_employee(data: EmployeeInput, repo: Repository):
    """Save the profile and all skill assessments atomically."""
    return repo.save_employee(data)


@router.put("/{employee_id}", response_model=Employee)
def update_employee(employee_id: RecordId, data: EmployeeInput, repo: Repository):
    """Require the viewed expectedVersion; atomically replace profile and skills."""
    return repo.save_employee(data, employee_id)


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: RecordId, repo: Repository):
    repo.delete_employee(employee_id)
    return Response(status_code=204)


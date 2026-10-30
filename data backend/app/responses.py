"""Public response contracts used by OpenAPI and the frontend integration."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    pageSize: int
    totalPages: int


class Department(BaseModel):
    id: int
    name: str


class Overview(BaseModel):
    employeeCount: int
    availableCount: int
    departmentCount: int
    skillCount: int


class Folder(Department):
    description: str | None
    isDefault: bool
    skillCount: int


class Skill(Department):
    folderId: int
    folderName: str
    description: str | None
    teamMemberCount: int
    averageProficiency: float | None


class Catalog(BaseModel):
    folders: list[Folder]
    skills: list[Skill]


class EmployeeSkill(BaseModel):
    skillId: int
    skillName: str
    folderId: int
    proficiencyLevel: int | None
    experienceYears: float | None


class Employee(BaseModel):
    id: int
    version: str
    firstName: str
    lastName: str
    name: str
    gender: str
    jobTitle: str
    departmentId: int
    department: str
    isAvailable: bool
    skills: list[EmployeeSkill]


class Candidate(BaseModel):
    employee: Employee
    skillId: int
    proficiencyLevel: int
    compatibility: int


class ScenarioHeader(BaseModel):
    id: int
    clientName: str
    baseTitle: str
    projectTitle: str
    projectBrief: str
    requiredPeople: int
    onlyAvailable: bool
    status: str
    version: int
    createdAt: str
    updatedAt: str
    selectedPeople: int
    averageCompatibility: int | None


class ScenarioRequirement(BaseModel):
    skillId: int
    skillName: str
    count: int
    isActive: bool


class ScenarioAssignment(BaseModel):
    employeeId: int
    skillId: int
    firstName: str
    lastName: str
    department: str
    jobTitle: str
    proficiencyAtSelection: int
    compatibility: int
    selectedAt: str


class Scenario(ScenarioHeader):
    requirements: list[ScenarioRequirement]
    assignments: list[ScenarioAssignment]


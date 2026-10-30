"""ID-based request contracts aligned with the existing SQL schema."""
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Id = Annotated[int, Field(strict=True, gt=0, le=2147483647)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Level = Annotated[int, Field(strict=True, ge=1, le=5)]
Count = Annotated[int, Field(strict=True, ge=1, le=100)]
EmployeeVersion = Annotated[str, StringConstraints(pattern=r"^0x[0-9A-Fa-f]{16}$")]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FolderInput(RequestModel):
    name: Name
    description: Annotated[str, Field(max_length=500)] | None = None


class SkillInput(FolderInput):
    folderId: Id


class EmployeeSkillInput(RequestModel):
    skillId: Id
    proficiencyLevel: Level | None = None
    experienceYears: Annotated[Decimal, Field(ge=0, le=Decimal("999.9"), decimal_places=1, allow_inf_nan=False)] | None = None


class EmployeeInput(RequestModel):
    firstName: Name
    lastName: Name
    departmentId: Id
    jobTitle: Name = "Team member"
    gender: Literal["Male", "Female", "Not specified", "Prefer not to say"] | None = None
    isAvailable: Annotated[bool, Field(strict=True)] = True
    skills: list[EmployeeSkillInput] = Field(default_factory=list, max_length=500)
    expectedVersion: EmployeeVersion | None = None

    @model_validator(mode="after")
    def unique_skills(self):
        ids = [skill.skillId for skill in self.skills]
        if len(ids) != len(set(ids)):
            raise ValueError("Each skill can be assigned only once per employee.")
        return self


class Requirement(RequestModel):
    skillId: Id
    count: Count


class ScenarioDraft(RequestModel):
    clientName: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    projectTitle: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    projectBrief: Annotated[str, Field(max_length=20000)] = ""
    requiredPeople: Count
    onlyAvailable: Annotated[bool, Field(strict=True)] = False
    requirements: list[Requirement] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def check_quotas(self):
        ids = [item.skillId for item in self.requirements]
        if len(ids) != len(set(ids)):
            raise ValueError("Each required skill must appear only once.")
        if sum(item.count for item in self.requirements) != self.requiredPeople:
            raise ValueError("Skill quotas must total the requested headcount.")
        return self


class Selection(RequestModel):
    employeeId: Id
    skillId: Id


class ScenarioInput(ScenarioDraft):
    assignments: list[Selection] = Field(min_length=1, max_length=100)
    expectedVersion: Id | None = None

    @model_validator(mode="after")
    def check_team(self):
        ids = [item.employeeId for item in self.assignments]
        if len(ids) != len(set(ids)):
            raise ValueError("An employee can fill only one place in this scenario.")
        needed = {item.skillId: item.count for item in self.requirements}
        actual: dict[int, int] = {}
        for item in self.assignments:
            actual[item.skillId] = actual.get(item.skillId, 0) + 1
        if actual != needed:
            raise ValueError("Fill every skill quota exactly before saving.")
        return self


class CandidateInput(RequestModel):
    skillId: Id
    onlyAvailable: Annotated[bool, Field(strict=True)] = False
    excludedEmployeeIds: list[Id] = Field(default_factory=list, max_length=100)
    page: Annotated[int, Field(strict=True, ge=1, le=1000000)] = 1


class ConfirmRemoval(RequestModel):
    confirmAssignedRemoval: Annotated[bool, Field(strict=True)] = False


class ScenarioVersion(RequestModel):
    expectedVersion: Id


def page_result(items: list, total: int, page: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page, "pageSize": size,
            "totalPages": (total + size - 1) // size}

"""Stable English API errors without exposing SQL text or credentials."""
import logging
import re
from typing import Any

import pyodbc

logger = logging.getLogger("skillora")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, **details: Any):
        self.status = status
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


SQL_ERRORS = {
    51069: (409, "stale_employee", "This employee has changed since you opened the form. Your draft is kept. Reload the latest profile before saving."),
    51067: (409, "archive_required", "Archive this scenario before permanently deleting it."),
    51068: (409, "invalid_lifecycle", "This operation is not available for the scenario's current status."),
    51010: (409, "protected_folder", "The Unsorted folder cannot be renamed or removed."),
    51021: (503, "write_busy", "Another operation is in progress. Please try again."),
    51022: (404, "folder_not_found", "Folder not found."),
    51023: (503, "catalog_not_ready", "The default folder is missing. Check database setup."),
    51024: (404, "skill_not_found", "Skill not found."),
    51030: (409, "assigned_skill", "This skill is assigned to employees. Review them and confirm removal."),
    51040: (422, "invalid_scenario", "Check the project title, client and headcount."),
    51041: (422, "invalid_assignments", "Requirements and selections must be valid lists."),
    51042: (422, "invalid_quotas", "Unique skill quotas must total the requested headcount."),
    51043: (422, "incomplete_team", "Fill every quota with distinct employees."),
    51044: (404, "scenario_not_found", "Scenario not found."),
    51045: (409, "stale_scenario", "This scenario was changed by another user. Reload it before saving."),
    51046: (409, "archived_scenario", "An archived scenario cannot be edited."),
    51047: (409, "ineligible_selection", "A selected employee or skill is no longer eligible. Review the team."),
    51048: (409, "ineligible_selection", "A selected employee is unavailable, unassessed or no longer eligible."),
    51050: (422, "invalid_page", "Check the page and availability filter."),
    51051: (422, "invalid_exclusions", "Excluded employee IDs must be integers."),
    51060: (422, "invalid_folder", "Enter a folder name between 1 and 100 characters."),
    51061: (422, "invalid_skill", "Enter a valid skill and active folder."),
    51062: (422, "invalid_employee", "Check the employee profile and department."),
    51063: (422, "invalid_employee_skills", "Check skill IDs, experience and proficiency levels."),
    51064: (404, "employee_not_found", "Employee not found."),
    2601: (409, "duplicate_record", "A record with this name or relationship already exists."),
    2627: (409, "duplicate_record", "A record with this name or relationship already exists."),
    547: (409, "related_record", "This operation conflicts with related records or a database rule."),
}


def database_error(error: pyodbc.Error) -> ApiError:
    text = " ".join(str(arg) for arg in error.args)
    for number in re.findall(r"\((\d+)\)", text):
        if int(number) in SQL_ERRORS:
            return ApiError(*SQL_ERRORS[int(number)])
    state = str(error.args[0]) if error.args else ""
    if state.startswith(("08", "28", "IM", "HYT")):
        logger.warning("SQL Server unavailable (SQLSTATE %s)", state)
        return ApiError(503, "database_unavailable", "SQL Server is unavailable. Check the connection settings and server status.")
    logger.error("Unhandled database error (SQLSTATE %s)", state)
    return ApiError(500, "database_error", "The database operation could not be completed.")


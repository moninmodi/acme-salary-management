"""FastAPI routes for employees, salary history, and dashboard reports."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

import pymysql
from fastapi import APIRouter, HTTPException, Query

from backend.config import settings
from backend.repositories import employees as employee_repository
from backend.repositories import salaries as salary_repository
from backend.schemas import (
    DashboardSummary,
    EmployeePage,
    EmployeeRecord,
    QuestionRequest,
    QuestionResponse,
    SalaryHistory,
    SalaryRecordCreate,
    SalaryRecordCreated,
)
from backend.services.insights import (
    GeminiQuestionService,
    QuestionFeatureDisabled,
    QuestionRequestError,
)
from backend.services.salaries import SalaryRecordError, SalaryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
salary_service = SalaryService()
question_service = GeminiQuestionService(
    api_key=settings.gemini_api_key,
    model=settings.gemini_model,
)


def _today_utc() -> str:
    """Return the current UTC date for effective-salary lookups."""
    return datetime.now(timezone.utc).date().isoformat()


@router.get("/health")
def health() -> dict[str, str]:
    """Report that the API process is responding."""
    return {"status": "ok"}


@router.get("/features")
def features() -> dict[str, bool]:
    """Expose optional features so the UI can show their configured state."""
    return {"natural_language_questions": question_service.enabled}


@router.get("/options")
def options() -> dict[str, list[str]]:
    """Return distinct values used by employee-directory filters."""
    return employee_repository.get_filter_options()


@router.get("/employees", response_model=EmployeePage)
def list_employees(
    search: str = Query(default="", max_length=120),
    country: str = "",
    department: str = "",
    job_title: str = "",
    employment_status: str = "",
    sort: Literal["name", "salary", "country", "department"] = "name",
    direction: Literal["asc", "desc"] = "asc",
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> EmployeePage:
    """Return a bounded, filtered, and sorted employee page."""
    as_of = _today_utc()
    rows, total = employee_repository.list_employees(
        search=search.strip(), country=country, department=department, job_title=job_title,
        employment_status=employment_status, sort=sort, direction=direction,
        limit=limit, offset=offset, as_of=as_of,
    )
    return EmployeePage(items=rows, total=total, limit=limit, offset=offset, as_of=as_of)


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    search: str = "", country: str = "", department: str = "", job_title: str = "", employment_status: str = "",
) -> DashboardSummary:
    """Summarize employee distributions and salaries for active filters."""
    report = employee_repository.get_dashboard_summary(
        search=search.strip(), country=country, department=department,
        job_title=job_title, employment_status=employment_status, as_of=_today_utc(),
    )
    return DashboardSummary(**report)


@router.get("/employees/{employee_id}", response_model=EmployeeRecord)
def get_employee(employee_id: int) -> EmployeeRecord:
    """Return an employee with compensation effective on today's UTC date."""
    record = employee_repository.get_employee(employee_id, _today_utc())
    if record is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeRecord(**record)


@router.get("/employees/{employee_id}/history", response_model=SalaryHistory)
def get_salary_history(employee_id: int) -> SalaryHistory:
    """Return every historical and scheduled salary record for an employee."""
    records = salary_repository.get_salary_history(employee_id)
    if records is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return SalaryHistory(items=records)


@router.post("/employees/{employee_id}/salaries", response_model=SalaryRecordCreated, status_code=201)
def create_salary_record(employee_id: int, record: SalaryRecordCreate) -> SalaryRecordCreated:
    """Append a current or future salary version without overwriting history."""
    try:
        result = salary_service.create_record(employee_id, record)
    except SalaryRecordError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except pymysql.MySQLError as exc:
        logger.exception("MariaDB salary-record write failed")
        raise HTTPException(status_code=500, detail="Could not save salary record") from exc
    return SalaryRecordCreated(**result)


@router.post("/questions", response_model=QuestionResponse)
def ask_question(request: QuestionRequest) -> QuestionResponse:
    """Answer an HR question using validated, read-only aggregate insights."""
    try:
        answer = question_service.answer(request.question)
    except QuestionFeatureDisabled as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except QuestionRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except pymysql.MySQLError as exc:
        logger.exception("MariaDB question query failed")
        raise HTTPException(status_code=500, detail="Could not answer this question") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return QuestionResponse(**answer)

"""Validated request and response models for the salary management API."""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SalaryRecordCreate(BaseModel):
    """Request body for appending an effective-dated salary record."""

    salary_minor: int = Field(ge=0, le=10**15)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    effective_date: date
    reason: str = Field(min_length=3, max_length=500)
    changed_by: str = Field(default="HR Manager", min_length=1, max_length=120)


class EmployeeRecord(BaseModel):
    """Employee details with compensation effective on the requested date."""

    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    country: str
    department: str
    job_title: str
    employment_status: Literal["Active", "Inactive"]
    created_at: str
    salary_minor: int | None
    currency: str | None
    salary_effective_date: date | None


class EmployeePage(BaseModel):
    """Paginated employee results and the full filtered result count."""

    items: list[EmployeeRecord]
    total: int
    limit: int
    offset: int
    as_of: date


class CountryDistribution(BaseModel):
    """Employee count for one country."""

    country: str
    employee_count: int


class DepartmentDistribution(BaseModel):
    """Employee count for one department."""

    department: str
    employee_count: int


class CurrencySalarySummary(BaseModel):
    """Current salary statistics for one currency group."""

    currency: str
    employee_count: int
    payroll_minor: int
    average_minor: float
    median_minor: float
    min_minor: int
    max_minor: int


class DashboardSummary(BaseModel):
    """Employee distribution and currency-specific compensation summary."""

    total_employees: int
    by_country: list[CountryDistribution]
    by_department: list[DepartmentDistribution]
    salary_by_currency: list[CurrencySalarySummary]


class SalaryRecord(BaseModel):
    """Persisted salary history item, including prior and new compensation."""

    id: int
    previous_salary_minor: int | None
    previous_currency: str | None
    new_salary_minor: int
    currency: str
    effective_date: date
    reason: str
    changed_by: str
    changed_at: str


class SalaryHistory(BaseModel):
    """All effective-dated salary records for one employee."""

    items: list[SalaryRecord]


class SalaryRecordCreated(BaseModel):
    """Response after a salary record is appended."""

    id: int
    employee_id: int
    salary_minor: int
    currency: str
    effective_date: date
    status: Literal["current", "scheduled"]
    changed_at: str


class QuestionRequest(BaseModel):
    """Plain-language HR question routed to validated insight functions."""

    question: str = Field(min_length=3, max_length=300)


class InsightToolFilters(BaseModel):
    """Optional dimensions accepted by aggregate insight tools."""

    model_config = ConfigDict(extra="forbid")

    country: str | None = None
    department: str | None = None
    job_title: str | None = None
    employment_status: Literal["Active", "Inactive"] | None = None
    currency: str | None = None


class GetSummaryArguments(InsightToolFilters):
    """Validated argument schema for the summary insight."""


class GetBreakdownArguments(InsightToolFilters):
    """Validated argument schema for an insight grouped by one dimension."""

    by: Literal["country", "department", "designation", "employment_status", "currency"]


class GetOutliersArguments(InsightToolFilters):
    """Validated argument schema for 1.5×IQR salary outliers."""


class QuestionResponse(BaseModel):
    """Model explanation with the exact aggregate insight used to produce it."""

    answer: str
    tool_name: Literal["get_summary", "get_breakdown", "get_outliers"]
    group_by: str | None
    filters: dict[str, str]
    total_employees: int | None
    results: list[dict]
    supported_examples: list[str]

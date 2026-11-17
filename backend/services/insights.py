"""Testable aggregate insight functions used by the dashboard and Gemini tools."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from statistics import median
from typing import Any

from backend.repositories import employees as employee_repository
from backend.schemas import GetBreakdownArguments, GetOutliersArguments, GetSummaryArguments

OUTLIER_IQR_MULTIPLIER = 1.5
FILTER_OPTION_KEYS = {
    "country": "countries",
    "department": "departments",
    "job_title": "job_titles",
    "employment_status": "employment_statuses",
    "currency": "currencies",
}
GROUP_COLUMNS = {"country", "department", "designation", "employment_status", "currency"}


class InsightArgumentError(ValueError):
    """Raised when a requested insight uses an unknown filter or dimension."""


class QuestionFeatureDisabled(RuntimeError):
    """Raised when natural-language questions are not configured."""


class QuestionRequestError(ValueError):
    """Raised when the model returns an unsupported or invalid tool request."""


SUPPORTED_EXAMPLES = [
    "How many employees are in India?",
    "Show salary averages by department in India.",
    "What is the median salary by currency?",
    "Which salary records are outliers in the United States?",
]

_COMMON_FILTERS = {
    "country": {"type": "string", "description": "Country name from the employee directory."},
    "department": {"type": "string", "description": "Department name from the employee directory."},
    "job_title": {"type": "string", "description": "Job title from the employee directory."},
    "employment_status": {"type": "string", "enum": ["Active", "Inactive"]},
    "currency": {"type": "string", "description": "ISO currency code."},
}
_TOOL_DECLARATIONS = [{
    "name": "get_summary",
    "description": "Get employee count and salary statistics grouped by currency.",
    "parameters_json_schema": {"type": "object", "properties": _COMMON_FILTERS},
}, {
    "name": "get_breakdown",
    "description": "Get employee count and salary statistics by an allowed dimension. Salary results remain separated by currency.",
    "parameters_json_schema": {
        "type": "object",
        "properties": {**_COMMON_FILTERS, "by": {
            "type": "string", "enum": ["country", "department", "designation", "employment_status", "currency"],
        }},
        "required": ["by"],
    },
}, {
    "name": "get_outliers",
    "description": "Count salary outliers using the 1.5 times IQR rule separately within each currency.",
    "parameters_json_schema": {"type": "object", "properties": _COMMON_FILTERS},
}]


class GeminiQuestionService:
    """Use Gemini to select safe aggregate tools and phrase verified results."""

    def __init__(self, api_key: str, model: str, insight_service=None, client=None):
        """Set up an optional Gemini client and injectable insight functions."""
        self.model = model
        self.insights = insight_service or InsightService()
        self.client = client
        if api_key and self.client is None:
            from google import genai

            self.client = genai.Client(api_key=api_key)
        self.enabled = bool(api_key or client)

    @staticmethod
    def _get(value: Any, key: str, default=None):
        """Read a field from either SDK response objects or test dictionaries."""
        return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)

    def _generate(self, question: str):
        """Request one constrained tool call; automatic execution stays disabled."""
        return self.client.models.generate_content(
            model=self.model,
            contents=question,
            config={
                "system_instruction": (
                    "You route HR questions to exactly one supplied read-only aggregate tool. "
                    "Never invent filters or request employee-level records. Only use supported fields."
                ),
                "tools": [{"function_declarations": _TOOL_DECLARATIONS}],
                "tool_config": {"function_calling_config": {"mode": "ANY"}},
                "automatic_function_calling": {"disable": True},
            },
        )

    def _run_tool(self, name: str, raw_arguments: dict) -> tuple[dict, dict, str | None]:
        """Validate the selected tool arguments and execute its allowlisted insight."""
        models = {
            "get_summary": GetSummaryArguments,
            "get_breakdown": GetBreakdownArguments,
            "get_outliers": GetOutliersArguments,
        }
        if name not in models:
            raise QuestionRequestError("The requested insight is not supported")
        try:
            arguments = models[name].model_validate(raw_arguments)
        except Exception as exc:
            raise QuestionRequestError("The requested insight arguments are invalid") from exc
        values = arguments.model_dump(exclude_none=True)
        group_by = values.pop("by", None)
        try:
            if name == "get_summary":
                result = self.insights.get_summary(values)
                rows = result["salary_by_currency"]
            elif name == "get_breakdown":
                result = self.insights.get_breakdown(group_by, values)
                rows = result["results"]
            else:
                result = self.insights.get_outliers(values)
                rows = result["results"]
        except InsightArgumentError as exc:
            raise QuestionRequestError(str(exc)) from exc
        return result, values, group_by

    def answer(self, question: str) -> dict:
        """Call a validated aggregate insight, then phrase its data for HR."""
        if not self.enabled:
            raise QuestionFeatureDisabled("Ask a question is disabled until GEMINI_API_KEY is configured")
        try:
            response = self._generate(question)
        except Exception as exc:
            raise RuntimeError("Gemini could not interpret the question") from exc
        candidates = self._get(response, "candidates", []) or []
        content = self._get(candidates[0], "content") if candidates else None
        parts = self._get(content, "parts", []) or []
        function_calls = [self._get(part, "function_call") for part in parts]
        function_calls = [call for call in function_calls if call is not None]
        if len(function_calls) != 1:
            raise QuestionRequestError("Could not map the question to one supported HR insight")
        call = function_calls[0]
        name = self._get(call, "name", "")
        arguments = self._get(call, "args", {}) or {}
        aggregate, filters, group_by = self._run_tool(name, arguments)
        rows = aggregate.get("salary_by_currency", aggregate.get("results", []))
        prompt = (
            "Answer the HR question in one or two concise sentences using only this verified aggregate data. "
            "Do not calculate new values or combine currencies. State when there are no matching records.\n"
            f"Question: {question}\nVerified insight: {json.dumps(aggregate, separators=(',', ':'))}"
        )
        try:
            phrasing = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={"automatic_function_calling": {"disable": True}},
            )
            answer = self._get(phrasing, "text", "")
        except Exception as exc:
            raise RuntimeError("Gemini could not phrase the verified result") from exc
        if not answer:
            raise RuntimeError("Gemini returned an empty answer")
        return {
            "answer": answer,
            "tool_name": name,
            "group_by": group_by,
            "filters": filters,
            "total_employees": aggregate.get("total_employees"),
            "results": rows,
            "supported_examples": SUPPORTED_EXAMPLES,
        }


def _quantile(values: list[int], probability: float) -> float:
    """Return a linearly interpolated quantile from numeric values."""
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    position = (len(ordered) - 1) * probability
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _statistics(values: list[int]) -> dict[str, int | float]:
    """Calculate totals and central/range statistics for a salary cohort."""
    return {
        "employee_count": len(values),
        "payroll_minor": sum(values),
        "average_minor": sum(values) / len(values),
        "median_minor": median(values),
        "min_minor": min(values),
        "max_minor": max(values),
    }


class InsightService:
    """Run allowlisted, read-only compensation aggregates with validated filters."""

    def __init__(self, today_provider=None):
        """Create the service with an optional date provider for deterministic tests."""
        self.today_provider = today_provider or self._today_utc

    @staticmethod
    def _today_utc() -> str:
        """Return today's UTC date for effective-salary selection."""
        return datetime.now(timezone.utc).date().isoformat()

    def normalize_filters(self, filters: dict[str, str | None]) -> dict[str, str]:
        """Validate model-provided filter values against current directory options."""
        options = employee_repository.get_filter_options()
        normalized: dict[str, str] = {}
        for field, option_key in FILTER_OPTION_KEYS.items():
            value = filters.get(field)
            if not value:
                continue
            match = next(
                (known for known in options[option_key] if known.casefold() == value.casefold()),
                None,
            )
            if match is None:
                raise InsightArgumentError(f"Unknown {field.replace('_', ' ')} filter: {value}")
            normalized[field] = match
        return normalized

    def get_summary(self, filters: dict[str, str | None] | None = None) -> dict:
        """Return employee count and salary statistics grouped by currency."""
        selected = self.normalize_filters(filters or {})
        data = employee_repository.get_dashboard_summary(
            search="",
            country=selected.get("country", ""),
            department=selected.get("department", ""),
            job_title=selected.get("job_title", ""),
            employment_status=selected.get("employment_status", ""),
            currency=selected.get("currency", ""),
            as_of=self.today_provider(),
        )
        return {
            "filters": selected,
            "total_employees": data["total_employees"],
            "salary_by_currency": data["salary_by_currency"],
        }

    def get_breakdown(self, by: str, filters: dict[str, str | None] | None = None) -> dict:
        """Return currency-separated salary statistics grouped by an approved dimension."""
        if by not in GROUP_COLUMNS:
            raise InsightArgumentError("Breakdown must be by country, department, designation, status, or currency")
        selected = self.normalize_filters(filters or {})
        samples = employee_repository.get_salary_values(
            group_by=by,
            filters=selected,
            as_of=self.today_provider(),
        )
        groups: dict[tuple[str | None, str], list[int]] = {}
        for sample in samples:
            group_value = sample.get("group_value")
            if by == "currency":
                group_value = sample["currency"]
            key = (group_value, sample["currency"])
            groups.setdefault(key, []).append(sample["salary_minor"])
        results = []
        for (group_value, currency), salaries in sorted(groups.items(), key=lambda item: str(item[0])):
            results.append({"group": group_value, "currency": currency, **_statistics(salaries)})
        return {"group_by": by, "filters": selected, "results": results}

    def get_outliers(self, filters: dict[str, str | None] | None = None) -> dict:
        """Return aggregate salary outlier counts using 1.5×IQR within each currency."""
        selected = self.normalize_filters(filters or {})
        samples = employee_repository.get_salary_values(
            group_by="currency",
            filters=selected,
            as_of=self.today_provider(),
        )
        by_currency: dict[str, list[int]] = {}
        for sample in samples:
            by_currency.setdefault(sample["currency"], []).append(sample["salary_minor"])
        results = []
        for currency, salaries in sorted(by_currency.items()):
            first_quartile = _quantile(salaries, 0.25)
            third_quartile = _quantile(salaries, 0.75)
            interquartile_range = third_quartile - first_quartile
            lower_fence = first_quartile - OUTLIER_IQR_MULTIPLIER * interquartile_range
            upper_fence = third_quartile + OUTLIER_IQR_MULTIPLIER * interquartile_range
            below = sum(salary < lower_fence for salary in salaries)
            above = sum(salary > upper_fence for salary in salaries)
            results.append({
                "currency": currency,
                "employee_count": len(salaries),
                "q1_minor": first_quartile,
                "q3_minor": third_quartile,
                "lower_fence_minor": lower_fence,
                "upper_fence_minor": upper_fence,
                "lower_outlier_count": below,
                "upper_outlier_count": above,
                "outlier_count": below + above,
            })
        return {"filters": selected, "iqr_multiplier": OUTLIER_IQR_MULTIPLIER, "results": results}

"""Gemini question flow with a fake model client and fake insights: no network, no database."""
import json
import unittest

from google.genai import types

from backend.services.insights import (
    GeminiQuestionService,
    InsightArgumentError,
    QuestionFeatureDisabled,
    QuestionRequestError,
)
from tests.fakes import FakeGeminiClient, model_text, model_tool_call

SUMMARY = {
    "filters": {"country": "India"},
    "total_employees": 2,
    "salary_by_currency": [{"currency": "INR", "employee_count": 2, "payroll_minor": 18_000_000}],
}


class FakeInsights:
    """Record which insight was executed and return canned aggregates."""

    def __init__(self, error=None):
        """Optionally raise ``error`` from every insight call."""
        self.calls = []
        self.error = error

    def _run(self, name, *args):
        """Record the call, then raise or return a canned result."""
        self.calls.append((name, *args))
        if self.error:
            raise self.error
        return SUMMARY if name == "summary" else {"results": [{"currency": "INR", "group": "India"}]}

    def get_summary(self, filters):
        """Fake summary insight."""
        return self._run("summary", filters)

    def get_breakdown(self, by, filters):
        """Fake breakdown insight."""
        return self._run("breakdown", by, filters)

    def get_outliers(self, filters):
        """Fake outlier insight."""
        return self._run("outliers", filters)


def make(*responses, insights=None):
    """Build an enabled service around a fake client; returns (service, client, insights)."""
    client = FakeGeminiClient(*responses)
    insights = insights or FakeInsights()
    return GeminiQuestionService("key", "gemini-test", insight_service=insights, client=client), client, insights


class QuestionServiceTests(unittest.TestCase):
    """Routing, validation and phrasing rules for natural-language questions."""

    def test_disabled_without_key_or_client(self):
        """No key means the feature reports itself disabled with setup guidance."""
        service = GeminiQuestionService(api_key="", model="m", insight_service=FakeInsights())
        self.assertFalse(service.enabled)
        with self.assertRaisesRegex(QuestionFeatureDisabled, "GEMINI_API_KEY"):
            service.answer("How many employees?")

    def test_request_config_is_valid_for_the_gemini_sdk(self):
        """The tool declarations and config pass the real SDK's validation (no network needed)."""
        service, client, _ = make(model_tool_call("get_summary", {}), model_text("ok"))
        service.answer("Summary please")
        config = types.GenerateContentConfig.model_validate(client.requests[0]["config"])
        declarations = config.tools[0].function_declarations
        self.assertEqual(declarations[1].parameters_json_schema["required"], ["by"])

    def test_runs_the_selected_tool_and_returns_verified_rows(self):
        """The validated tool runs once and its aggregates are returned with the answer."""
        service, client, insights = make(model_tool_call("get_summary", {"country": "India"}),
                                         model_text("India has 2 employees."))
        result = service.answer("How many employees are in India?")
        self.assertEqual(insights.calls, [("summary", {"country": "India"})])
        self.assertEqual(result["tool_name"], "get_summary")
        self.assertEqual(result["results"], SUMMARY["salary_by_currency"])
        self.assertEqual(result["answer"], "India has 2 employees.")
        self.assertEqual(len(client.requests), 2)

    def test_tool_request_forces_one_function_call_without_auto_execution(self):
        """The first request offers only declared tools and disables automatic calling."""
        service, client, _ = make(model_tool_call("get_summary", {}), model_text("ok"))
        service.answer("Summary please")
        config = client.requests[0]["config"]
        self.assertEqual(config["tool_config"]["function_calling_config"]["mode"], "ANY")
        self.assertTrue(config["automatic_function_calling"]["disable"])
        names = [d["name"] for d in config["tools"][0]["function_declarations"]]
        self.assertEqual(names, ["get_summary", "get_breakdown", "get_outliers"])

    def test_phrasing_prompt_contains_only_the_aggregate(self):
        """Gemini receives the question and the computed aggregate JSON, nothing else."""
        service, client, _ = make(model_tool_call("get_summary", {"country": "India"}), model_text("ok"))
        service.answer("How many employees are in India?")
        prompt = client.requests[1]["contents"]
        self.assertIn(json.dumps(SUMMARY, separators=(",", ":")), prompt)
        self.assertNotIn("first_name", prompt)

    def test_breakdown_passes_dimension_separately_from_filters(self):
        """The 'by' argument is not treated as a filter."""
        service, _, insights = make(model_tool_call("get_breakdown", {"by": "country", "currency": "INR"}),
                                    model_text("ok"))
        result = service.answer("Pay by country in INR")
        self.assertEqual(insights.calls, [("breakdown", "country", {"currency": "INR"})])
        self.assertEqual((result["group_by"], result["filters"]), ("country", {"currency": "INR"}))

    def test_rejects_unknown_tools_and_invalid_arguments_before_querying(self):
        """Anything outside the allowlist fails validation and no insight runs."""
        for call in (model_tool_call("run_sql", {"sql": "SELECT *"}),
                     model_tool_call("get_breakdown", {"by": "salary"}),
                     model_tool_call("get_summary", {"employee_id": 1})):
            service, _, insights = make(call)
            with self.assertRaises(QuestionRequestError):
                service.answer("anything")
            self.assertEqual(insights.calls, [])

    def test_requires_exactly_one_function_call(self):
        """A text-only reply cannot be mapped to a verified insight."""
        service, _, _ = make(model_text("I think about 5,000 people."))
        with self.assertRaisesRegex(QuestionRequestError, "one supported HR insight"):
            service.answer("How many?")

    def test_unknown_filter_value_becomes_request_error(self):
        """An unknown country from the model surfaces as a 422-style error."""
        insights = FakeInsights(error=InsightArgumentError("Unknown country filter: Mars"))
        service, _, _ = make(model_tool_call("get_summary", {"country": "Mars"}), insights=insights)
        with self.assertRaisesRegex(QuestionRequestError, "Mars"):
            service.answer("Employees on Mars?")

    def test_model_failures_are_reported_as_runtime_errors(self):
        """Network/model errors and empty answers map to a 502-style error."""
        service, _, _ = make(ConnectionError("down"))
        with self.assertRaisesRegex(RuntimeError, "could not interpret"):
            service.answer("anything")
        service, _, _ = make(model_tool_call("get_summary", {}), model_text(""))
        with self.assertRaisesRegex(RuntimeError, "empty answer"):
            service.answer("anything")

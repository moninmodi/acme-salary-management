import React, { useEffect, useState } from 'react';
import { ArrowUpRight, MessageCircleQuestion, Send } from 'lucide-react';
import { askQuestion, getFeatures } from '../lib/api';
import { formatMoney } from '../lib/format';

const EXAMPLES = [
  'How many employees are in India?',
  'Show employee count by department.',
  'What is the average salary in USD?',
  'What is total payroll by country?',
];

function AnswerRow({ result, toolName, groupBy }) {
  const label = [groupBy && groupBy !== 'currency' ? result.group : null, result.currency]
    .filter(Boolean).join(' · ') || result.currency || 'Employees';
  if (toolName === 'get_outliers') {
    return <div className="question-result-row"><span>{label}</span><strong>{result.outlier_count.toLocaleString()} outliers · {result.employee_count.toLocaleString()} salaries</strong></div>;
  }
  return <div className="question-result-row question-salary-row">
    <span>{label}</span>
    <div>
      {result.employee_count !== undefined && <strong>{result.employee_count.toLocaleString()} employees</strong>}
      {result.payroll_minor !== undefined && <strong>Payroll {formatMoney(result.payroll_minor, result.currency)}</strong>}
      {result.average_minor !== undefined && <span>Average {formatMoney(result.average_minor, result.currency)}</span>}
      {result.median_minor !== undefined && <span>Median {formatMoney(result.median_minor, result.currency)}</span>}
      {result.min_minor !== undefined && <span>Range {formatMoney(result.min_minor, result.currency)}–{formatMoney(result.max_minor, result.currency)}</span>}
    </div>
  </div>;
}

export default function QuestionPanel() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionsEnabled, setQuestionsEnabled] = useState(false);
  const [featureLoaded, setFeatureLoaded] = useState(false);

  useEffect(() => {
    getFeatures()
      .then((features) => setQuestionsEnabled(features.natural_language_questions))
      .catch(() => setQuestionsEnabled(false))
      .finally(() => setFeatureLoaded(true));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      setResponse(await askQuestion(question));
    } catch (requestError) {
      setError(requestError.message);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  return <section className="question-panel" aria-labelledby="question-heading">
    <div className="question-panel-heading">
      <span className="question-icon"><MessageCircleQuestion size={18} /></span>
      <div><h2 id="question-heading">Ask about compensation</h2><p>Ask an HR question in your own words.</p></div>
      <span className="deterministic-tag">{questionsEnabled ? 'Gemini · verified data' : 'Optional AI feature'}</span>
    </div>
    {!questionsEnabled && featureLoaded && <p className="question-disabled">Question answering is disabled. Add a Gemini API key to <code>.env</code> and restart the API to enable it.</p>}
    <form className="question-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="hr-question">Your question</label>
      <input id="hr-question" value={question} onChange={(event) => setQuestion(event.target.value)}
        placeholder="e.g. What is the average salary in USD?" maxLength="300" required disabled={!questionsEnabled} />
      <button type="submit" disabled={loading || !questionsEnabled}><Send size={15} />{loading ? 'Asking…' : 'Ask'}</button>
    </form>
    {questionsEnabled && <div className="question-examples"><span>Try</span>{EXAMPLES.map((example) => <button key={example} onClick={() => setQuestion(example)}>{example}<ArrowUpRight size={12} /></button>)}</div>}
    {error && <div className="question-error" role="alert">{error}</div>}
    {response && <div className="question-answer" aria-live="polite">
      <div className="answer-text"><strong>Answer</strong><p>{response.answer}</p></div>
      {Object.keys(response.filters).length > 0 && <div className="answer-filters">
        <span>Filters applied</span>{Object.entries(response.filters).map(([key, value]) => <span className="answer-filter-chip" key={key}>{key.replace('_', ' ')}: {value}</span>)}
      </div>}
      <div className="question-results">
        {response.total_employees !== null && <div className="question-result-row"><span>Employees in filtered population</span><strong>{response.total_employees.toLocaleString()}</strong></div>}
        {response.results.map((result, index) => <AnswerRow key={`${result.group}-${result.currency}-${index}`}
          result={result} toolName={response.tool_name} groupBy={response.group_by} />)}
      </div>
      <p className="question-method">Verified with {response.tool_name.replaceAll('_', ' ')}{response.group_by ? ` · grouped by ${response.group_by}` : ''}. Salary values stay separated by currency.</p>
    </div>}
  </section>;
}

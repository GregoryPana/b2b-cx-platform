import pathlib
filepath = pathlib.Path(r'c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\frontend\installation-dashboard\src\App.jsx')
content = filepath.read_text(encoding='utf-8')

replacements = [
    (
        '''    const hasStarted = scoredValues.length > 0;
    const totalChecks = hasStarted ? questionBank.length : 0;
    const answeredCount = hasStarted ? scoredValues.length : 0;
    const outstandingCount = hasStarted ? Math.max(totalChecks - answeredCount, 0) : 0;
    const completion = totalChecks ? answeredCount / totalChecks : 0;''',
        '''    const hasStarted = scoredValues.length > 0 || header.customerName !== '' || header.location !== '';
    const totalChecks = questionBank.length;
    const answeredCount = scoredValues.length;
    const outstandingCount = Math.max(totalChecks - answeredCount, 0);
    const completion = totalChecks ? answeredCount / totalChecks : 0;'''
    ),
    (
        '''        <div className="stat-card">
          <span>Checks completed</span>
          <strong>{summary.hasStarted ? summary.answeredCount : "--"}</strong>
          <span>Out of {summary.hasStarted ? summary.totalChecks : "--"} required</span>
        </div>
        <div className="stat-card">
          <span>Questions left</span>
          <strong>{summary.hasStarted ? summary.outstandingCount : "--"}</strong>
          <span>Answers still needed before submit</span>
        </div>
        <div className="stat-card">
          <span>Problem alerts</span>
          <strong>{summary.hasStarted ? summary.riskItems.length : "--"}</strong>
          <span>Found in this survey</span>
        </div>''',
        '''        <div className="stat-card">
          <span>Checks completed</span>
          <strong>{summary.answeredCount}</strong>
          <span>Out of {summary.totalChecks} required</span>
        </div>
        <div className="stat-card">
          <span>Questions left</span>
          <strong>{summary.outstandingCount}</strong>
          <span>Answers still needed before submit</span>
        </div>
        <div className="stat-card">
          <span>Problem alerts</span>
          <strong>{summary.riskItems.length}</strong>
          <span>Found in this survey</span>
        </div>'''
    ),
    (
        '''          <p className="assignment-note">
            {summary.hasStarted ? `${summary.outstandingCount} questions left` : "No active survey"}
          </p>
          <p className="assignment-note">
            {summary.hasStarted && summary.safetyFlags.length ? "Safety follow-up needed" : "Safety clear"}
          </p>''',
        '''          <p className="assignment-note">
            {summary.totalChecks > 0 ? `${summary.outstandingCount} questions left` : "No active survey"}
          </p>
          <p className="assignment-note">
            {summary.safetyFlags.length ? "Safety follow-up needed" : "Safety clear"}
          </p>'''
    ),
    (
        '''    const riskItems = hasStarted
      ? questionBank.filter((question, index) => {
          const number = getQuestionNumber(question, index);
          const raw = responses[number]?.score;
          if (raw === "" || raw === undefined || raw === null) return false;
          const score = Number(raw);
          return !Number.isNaN(score) && score <= 2;
        })
      : [];
    const safetyFlags = hasStarted
      ? questionBank.filter((question, index) => {
          const number = getQuestionNumber(question, index);
          const raw = responses[number]?.score;
          if (raw === "" || raw === undefined || raw === null) return false;
          const score = Number(raw);
          return question.category.includes("Safety") && !Number.isNaN(score) && score <= 2;
        })
      : [];''',
        '''    const riskItems = questionBank.filter((question, index) => {
      const number = getQuestionNumber(question, index);
      const raw = responses[number]?.score;
      if (raw === "" || raw === undefined || raw === null) return false;
      const score = Number(raw);
      return !Number.isNaN(score) && score <= 2;
    });
    
    const safetyFlags = questionBank.filter((question, index) => {
      const number = getQuestionNumber(question, index);
      const raw = responses[number]?.score;
      if (raw === "" || raw === undefined || raw === null) return false;
      const score = Number(raw);
      return question.category.includes("Safety") && !Number.isNaN(score) && score <= 2;
    });'''
    )
]

for old, new in replacements:
    old_crlf = old.replace('\\n', '\\r\\n')
    if old in content:
        content = content.replace(old, new)
    elif old_crlf in content:
        content = content.replace(old_crlf, new)
    else:
        print(f'NOT FOUND:\\n{old}\\n')

filepath.write_text(content, encoding='utf-8')
print('Done')

import pathlib

filepath = pathlib.Path(r'c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\frontend\installation-dashboard\src\App.jsx')
content = filepath.read_text(encoding='utf-8')

replacements = [
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
        </div>
        <div className="stat-card">
          <span>Overall score</span>
          <strong>{summary.average ? summary.average.toFixed(2) : "--"}</strong>
          <span>Based on completed answers</span>
        </div>''',
        '''        <div className="stat-card" style={{borderColor: '#2563eb', backgroundColor: '#eff6ff'}}>
          <span>Total Surveys Completed</span>
          <strong style={{color: '#1e3a8a'}}>{historyRows.length}</strong>
          <span>Sent to review</span>
        </div>
        <div className="stat-card" style={{borderColor: '#16a34a', backgroundColor: '#f0fdf4'}}>
          <span>Businesses Serviced</span>
          <strong style={{color: '#14532d'}}>{businessSummaries.length}</strong>
          <span>Unique locations visited</span>
        </div>
        <div className="stat-card" style={{borderColor: '#dc2626', backgroundColor: '#fef2f2'}}>
          <span>Problem alerts</span>
          <strong style={{color: '#7f1d1d'}}>{historyRows.filter(r => r.threshold_band === 'rework' || r.threshold_band === 'critical').length}</strong>
          <span>Rework/Critical issues logged</span>
        </div>
        <div className="stat-card" style={{borderColor: '#ca8a04', backgroundColor: '#fefce8'}}>
          <span>System Avg Score</span>
          <strong style={{color: '#713f12'}}>{historyRows.length > 0 ? (historyRows.reduce((acc, row) => acc + Number(row.overall_score || row.score || 0), 0) / historyRows.length).toFixed(2) : "--"}</strong>
          <span>Across all surveys</span>
        </div>'''
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

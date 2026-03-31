import pathlib

filepath = pathlib.Path(r'c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\frontend\installation-dashboard\src\App.jsx')
content = filepath.read_text(encoding='utf-8')

# Fix Top Dashboard (stat-grid)
stat_grid_replacement = (
    '''      <div className="stat-grid">
        <div className="stat-card" style={{borderColor: '#2563eb', backgroundColor: '#eff6ff'}}>
          <span>Total Surveys Completed</span>
          <strong style={{color: '#1e3a8a'}}>{systemStats.totalSurveys}</strong>
          <span>Sent to review</span>
        </div>
        <div className="stat-card" style={{borderColor: '#16a34a', backgroundColor: '#f0fdf4'}}>
          <span>Businesses Serviced</span>
          <strong style={{color: '#14532d'}}>{systemStats.uniqueBusinesses}</strong>
          <span>Unique locations visited</span>
        </div>
        <div className="stat-card" style={{borderColor: '#dc2626', backgroundColor: '#fef2f2'}}>
          <span>Problem alerts</span>
          <strong style={{color: '#7f1d1d'}}>{systemStats.problemCount}</strong>
          <span>Rework/Critical issues logged</span>
        </div>
        <div className="stat-card" style={{borderColor: '#ca8a04', backgroundColor: '#fefce8'}}>
          <span>System Avg Score</span>
          <strong style={{color: '#713f12'}}>{systemStats.avgScore ? systemStats.avgScore.toFixed(2) : "--"}</strong>
          <span>Across all surveys</span>
        </div>
      </div>'''
)

# Detect current stat-grid and replace it.
import re
pattern = re.compile(r'<div className=\"stat-grid\">.*?<\/div>\s+<\/div>', re.DOTALL)
content = pattern.sub(stat_grid_replacement + '\n', content)

filepath.write_text(content, encoding='utf-8')
print('Done')

import pathlib

filepath = pathlib.Path(r"c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\frontend\installation-dashboard\src\App.jsx")
content = filepath.read_text(encoding="utf-8")

replacements = [
    (
        '''      if (row.inspector_name) record.inspectors.add(row.inspector_name);''',
        '''      if (row.representative_name) record.inspectors.add(row.representative_name);'''
    ),
    (
        '''                <td>{row.inspector_name || row.inspector || "—"}</td>''',
        '''                <td>{row.representative_name || row.representative || "—"}</td>'''
    ),
    (
        '''                      <strong>{row.inspector_name || row.inspector || "—"}</strong>''',
        '''                      <strong>{row.representative_name || row.representative || "—"}</strong>'''
    ),
    (
        '''    inspectorName: "",''',
        '''    representativeName: "",'''
    ),
    (
        '''        inspectors: Array.from(record.inspectors).join(", ") || "—",''',
        '''        representatives: Array.from(record.inspectors).join(", ") || "—",'''
    )
]

for old, new in replacements:
    old_crlf = old.replace("\\n", "\\r\\n")
    if old in content:
        content = content.replace(old, new)
    elif old_crlf in content:
        content = content.replace(old_crlf, new)
    else:
        print(f"NOT FOUND:\\n{old}\\n")

filepath.write_text(content, encoding="utf-8")
print("Done")

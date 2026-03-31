import pathlib

filepath = pathlib.Path(r"c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\frontend\installation-dashboard\src\App.jsx")
content = filepath.read_text(encoding="utf-8")

replacements = [
    (
        '''      setError("Complete inspector/header fields and all seven scores before submitting.");''',
        '''      setError("Complete representative/header fields and all seven scores before submitting.");'''
    ),
    (
        '''          inspectors: new Set(),''',
        '''          representatives: new Set(),'''
    ),
    (
        '''      if (row.representative_name) record.inspectors.add(row.representative_name);''',
        '''      if (row.representative_name) record.representatives.add(row.representative_name);'''
    ),
    (
        '''        representatives: Array.from(record.inspectors).join(", ") || "—",''',
        '''        representatives: Array.from(record.representatives).join(", ") || "—",'''
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

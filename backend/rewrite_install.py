import pathlib

filepath = pathlib.Path(r"c:\Users\hpillay\Desktop\projects\B2B\b2b-cx-platform\backend\app\api\installation.py")
content = filepath.read_text(encoding="utf-8")

replacements = [
    (
        '''class InstallationAssessmentCreate(BaseModel):
    inspector_name: str | None = Field(default=None, max_length=255)
    customer_name: str = Field(..., max_length=255)
    customer_type: str = Field(..., pattern=r"^(B2B|B2C)$")
    location: str = Field(..., max_length=255)
    work_date: date
    execution_party: str = Field(..., pattern=r"^(Field Team|Contractor)$")
    team_name: str | None = Field(default=None, max_length=255)
    contractor_name: str | None = Field(default=None, max_length=255)
    responses: list[InstallationQuestionResponse]

    @validator("team_name", always=True)
    def validate_team_name(cls, value, values):
        if values.get("execution_party") == "Field Team" and not value:
            raise ValueError("Team name is required for Field Team installs")
        return value

    @validator("contractor_name", always=True)
    def validate_contractor_name(cls, value, values):
        if values.get("execution_party") == "Contractor" and not value:
            raise ValueError("Contractor name is required for contractor installs")
        return value''',
        '''class InstallationAssessmentCreate(BaseModel):
    representative_name: str | None = Field(default=None, max_length=255)
    customer_name: str = Field(..., max_length=255)
    customer_type: str = Field(..., pattern=r"^(B2B|B2C)$")
    location: str = Field(..., max_length=255)
    work_date: date
    responses: list[InstallationQuestionResponse]'''
    ),
    (
        '''class InstallationAssessmentRecord(BaseModel):
    id: str
    inspector_name: str
    customer_name: str
    customer_type: str
    location: str
    work_date: date
    execution_party: str
    team_name: str | None
    contractor_name: str | None
    overall_score: float''',
        '''class InstallationAssessmentRecord(BaseModel):
    id: str
    representative_name: str
    customer_name: str
    customer_type: str
    location: str
    work_date: date
    overall_score: float'''
    ),
    (
        '''    inspector_name = (payload.inspector_name or current_user.name or current_user.preferred_username or "Unknown Inspector").strip()
    assessment_id = str(uuid4())

    insert_payload = {
        "id": assessment_id,
        "inspector_name": inspector_name,
        "customer_name": payload.customer_name.strip(),
        "customer_type": payload.customer_type,
        "location": payload.location.strip(),
        "work_date": payload.work_date,
        "execution_party": payload.execution_party,
        "team_name": payload.team_name.strip() if payload.team_name else None,
        "contractor_name": payload.contractor_name.strip() if payload.contractor_name else None,
        "overall_score": round(overall_score, 2),
        "threshold_band": band["key"],
    }''',
        '''    representative_name = (payload.representative_name or current_user.name or current_user.preferred_username or "Unknown Representative").strip()
    assessment_id = str(uuid4())

    insert_payload = {
        "id": assessment_id,
        "representative_name": representative_name,
        "customer_name": payload.customer_name.strip(),
        "customer_type": payload.customer_type,
        "location": payload.location.strip(),
        "work_date": payload.work_date,
        "overall_score": round(overall_score, 2),
        "threshold_band": band["key"],
    }'''
    ),
    (
        '''                INSERT INTO installation_assessments (
                    id, inspector_name, customer_name, customer_type, location,
                    work_date, execution_party, team_name, contractor_name,
                    overall_score, threshold_band
                ) VALUES (
                    :id, :inspector_name, :customer_name, :customer_type, :location,
                    :work_date, :execution_party, :team_name, :contractor_name,
                    :overall_score, :threshold_band
                )''',
        '''                INSERT INTO installation_assessments (
                    id, representative_name, customer_name, customer_type, location,
                    work_date, overall_score, threshold_band
                ) VALUES (
                    :id, :representative_name, :customer_name, :customer_type, :location,
                    :work_date, :overall_score, :threshold_band
                )'''
    ),
    (
        '''            SELECT
                id,
                inspector_name,
                customer_name,
                customer_type,
                location,
                work_date,
                execution_party,
                team_name,
                contractor_name,
                overall_score,
                threshold_band,
                created_at''',
        '''            SELECT
                id,
                representative_name,
                customer_name,
                customer_type,
                location,
                work_date,
                overall_score,
                threshold_band,
                created_at'''
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

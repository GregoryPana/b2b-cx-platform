from pydantic import BaseModel


class NpsSummary(BaseModel):
    nps: float | None
    promoters: int
    detractors: int
    passives: int
    total_responses: int


class CoverageSummary(BaseModel):
    total_active_businesses: int
    businesses_visited_ytd: int
    coverage_percent: float
    businesses_not_visited: int
    repeat_visits: int


class CategoryBreakdownItem(BaseModel):
    category: str
    average_score: float
    response_count: int

from pydantic import BaseModel, Field
from typing import Literal

class InsightResponse(BaseModel):
    insight: str = Field(description="A brief, encouraging actionable business insight.")
    trend_percentage: float = Field(description="Percentage change (e.g. 15.5 for +15.5%). Must be a number.")
    trend_direction: Literal["up", "down"] = Field(description="Must be 'up' or 'down'.")
    trend_comparison: str = Field(description="A short comparison phrase, e.g., 'vs semana pasada'.")

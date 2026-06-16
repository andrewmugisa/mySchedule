"""
schemas.py — Pydantic models for request validation and response serialization
"""

from __future__ import annotations
from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel


# ─── Week ────────────────────────────────────────────────────────────────────

class WeekOut(BaseModel):
    week_number: int
    start_date:  date
    end_date:    date
    is_break:    bool

    class Config:
        from_attributes = True


# ─── Course ──────────────────────────────────────────────────────────────────

class CourseIn(BaseModel):
    code:       str
    title:      str
    short_name: str
    color:      str
    professor:  Optional[str] = None
    credits:    Optional[int] = None

class CourseOut(CourseIn):
    course_id: int

    class Config:
        from_attributes = True


# ─── CourseSection ───────────────────────────────────────────────────────────

class SectionIn(BaseModel):
    course_id:      int
    section_number: str
    type:           str
    weight_percent: Decimal
    room:           Optional[str] = None
    day_of_week:    Optional[str] = None
    start_time:     Optional[time] = None
    end_time:       Optional[time] = None

class SectionOut(SectionIn):
    section_id: int

    class Config:
        from_attributes = True


# ─── Assessment ──────────────────────────────────────────────────────────────

class AssessmentIn(BaseModel):
    section_id:     int
    title:          str
    type:           str
    quiz_type:      Optional[str]      = None
    week_number:    Optional[int]      = None
    weight_percent: Decimal
    release_date:   Optional[datetime] = None
    due_date:       Optional[datetime] = None
    score:          Optional[Decimal]  = Decimal("0")
    max_score:      Optional[Decimal]  = None  # "out of" value e.g. 10

class AssessmentOut(AssessmentIn):
    assessment_id: int

    class Config:
        from_attributes = True


# Grade input: what you got vs what it was out of
class AssessmentGradeIn(BaseModel):
    got:      Decimal   # marks received, e.g. 9
    out_of:   Decimal   # total marks, e.g. 10


# ─── Event ───────────────────────────────────────────────────────────────────

class EventIn(BaseModel):
    section_id:   Optional[int]      = None
    title:        str
    type:         str
    start_time:   datetime
    end_time:     datetime
    week_number:  Optional[int]      = None
    location:     Optional[str]      = None
    notes:        Optional[str]      = None
    is_cancelled: bool               = False
    is_recurring: bool               = False
    recur_days:   Optional[str]      = None
    recur_end:    Optional[date]     = None

class EventOut(EventIn):
    event_id: int

    class Config:
        from_attributes = True


# ─── WeeklyKnowledge ─────────────────────────────────────────────────────────

class WeeklyKnowledgeIn(BaseModel):
    course_id:   int
    week_number: int
    topics:      List[Any] = []

class WeeklyKnowledgeOut(WeeklyKnowledgeIn):
    knowledge_id: int

    class Config:
        from_attributes = True

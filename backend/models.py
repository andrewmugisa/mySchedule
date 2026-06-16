"""
models.py — SQLAlchemy ORM models for all 6 tables
"""

from sqlalchemy import (
    Column, Integer, SmallInteger, String, Boolean,
    Date, Time, Numeric, Text, ForeignKey, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class Course(Base):
    __tablename__ = "courses"

    course_id  = Column(Integer, primary_key=True, index=True)
    code       = Column(String(20), nullable=False)
    title      = Column(String(100), nullable=False)
    short_name = Column(String(30), nullable=False)
    color      = Column(String(7), nullable=False)
    professor  = Column(String(100))
    credits    = Column(SmallInteger)

    sections         = relationship("CourseSection", back_populates="course", cascade="all, delete")
    weekly_knowledge = relationship("WeeklyKnowledge", back_populates="course", cascade="all, delete")


class CourseSection(Base):
    __tablename__ = "course_sections"

    section_id     = Column(Integer, primary_key=True, index=True)
    course_id      = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    section_number = Column(String(10), nullable=False)
    type           = Column(String(10), nullable=False)   # THEORY | LAB | HYBRID
    weight_percent = Column(Numeric(5, 2), nullable=False)
    room           = Column(String(20))
    day_of_week    = Column(String(10))
    start_time     = Column(Time)
    end_time       = Column(Time)

    course      = relationship("Course", back_populates="sections")
    events      = relationship("Event", back_populates="section")
    assessments = relationship("Assessment", back_populates="section", cascade="all, delete")


class Week(Base):
    __tablename__ = "weeks"

    week_number = Column(SmallInteger, primary_key=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=False)
    is_break    = Column(Boolean, nullable=False, default=False)


class Assessment(Base):
    __tablename__ = "assessments"

    assessment_id  = Column(Integer, primary_key=True, index=True)
    section_id     = Column(Integer, ForeignKey("course_sections.section_id", ondelete="CASCADE"), nullable=False)
    title          = Column(String(150), nullable=False)
    type           = Column(String(20), nullable=False)   # LAB | ASSIGNMENT | MIDTERM | FINAL | PROJECT | PRESENTATION | QUIZ
    quiz_type      = Column(String(10))                   # POP | PRE_LAB | REGULAR (nullable)
    week_number    = Column(SmallInteger, ForeignKey("weeks.week_number"))
    weight_percent = Column(Numeric(5, 2), nullable=False)
    release_date   = Column(TIMESTAMP(timezone=True))
    due_date       = Column(TIMESTAMP(timezone=True))
    score          = Column(Numeric(6, 2), nullable=False, default=0)

    section = relationship("CourseSection", back_populates="assessments")


class Event(Base):
    __tablename__ = "events"

    event_id     = Column(Integer, primary_key=True, index=True)
    section_id   = Column(Integer, ForeignKey("course_sections.section_id", ondelete="SET NULL"))
    title        = Column(String(150), nullable=False)
    type         = Column(String(10), nullable=False)     # CLASS | PERSONAL
    start_time   = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time     = Column(TIMESTAMP(timezone=True), nullable=False)
    week_number  = Column(SmallInteger, ForeignKey("weeks.week_number"))
    location     = Column(String(50))
    notes        = Column(Text)
    is_cancelled = Column(Boolean, nullable=False, default=False)
    is_recurring = Column(Boolean, nullable=False, default=False)
    recur_days   = Column(String(50))   # MON,WED,FRI
    recur_end    = Column(Date)

    section = relationship("CourseSection", back_populates="events")


class WeeklyKnowledge(Base):
    __tablename__ = "weekly_knowledge"

    knowledge_id = Column(Integer, primary_key=True, index=True)
    course_id    = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    week_number  = Column(SmallInteger, ForeignKey("weeks.week_number"), nullable=False)
    topics       = Column(JSONB, nullable=False, default=list)

    course = relationship("Course", back_populates="weekly_knowledge")

"""
main.py — FastAPI application
All CRUD endpoints for: courses, sections, weeks, assessments, events, weekly_knowledge
On startup: creates tables and seeds data if the weeks table is empty.
"""

import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from database import Base, engine, get_db
from models import Course, CourseSection, Week, Assessment, Event, WeeklyKnowledge
from schemas import (
    CourseIn, CourseOut,
    SectionIn, SectionOut,
    WeekOut,
    AssessmentIn, AssessmentOut,
    EventIn, EventOut,
    WeeklyKnowledgeIn, WeeklyKnowledgeOut,
)

app = FastAPI(title="PATS API")

# Allow the frontend container to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Startup: create tables + seed ───────────────────────────────────────────

@app.on_event("startup")
def startup():
    """Create all tables, then seed if weeks table is empty."""
    Base.metadata.create_all(bind=engine)

    db = next(get_db())
    try:
        if db.query(Week).count() == 0:
            _seed(db)
    finally:
        db.close()


def _seed(db: Session):
    """Insert all weeks, the OOP course, sections, events, assessments, and weekly knowledge."""

    # Weeks
    weeks_data = [
        (1,  "2026-05-11", "2026-05-17", False),
        (2,  "2026-05-18", "2026-05-24", False),
        (3,  "2026-05-25", "2026-05-31", False),
        (4,  "2026-06-01", "2026-06-07", False),
        (5,  "2026-06-08", "2026-06-14", False),
        (6,  "2026-06-15", "2026-06-21", False),
        (7,  "2026-06-22", "2026-06-28", False),
        (8,  "2026-06-29", "2026-07-05", True),
        (9,  "2026-07-06", "2026-07-12", False),
        (10, "2026-07-13", "2026-07-19", False),
        (11, "2026-07-20", "2026-07-26", False),
        (12, "2026-07-27", "2026-08-02", False),
        (13, "2026-08-03", "2026-08-09", False),
        (14, "2026-08-10", "2026-08-16", False),
        (15, "2026-08-17", "2026-08-24", False),
    ]
    for wn, sd, ed, ib in weeks_data:
        db.add(Week(week_number=wn, start_date=sd, end_date=ed, is_break=ib))
    db.flush()

    # Course
    course = Course(
        code="CST8132",
        title="Object-Oriented Programming",
        short_name="OOP",
        color="#E63946",
        professor="Howard Rosenblum / Todd Kelley",
        credits=3,
    )
    db.add(course)
    db.flush()

    # Sections
    theory = CourseSection(
        course_id=course.course_id,
        section_number="300",
        type="THEORY",
        weight_percent="50.00",
        room="T334",
        day_of_week="FRIDAY",
        start_time="10:30",
        end_time="12:30",
    )
    lab = CourseSection(
        course_id=course.course_id,
        section_number="301",
        type="LAB",
        weight_percent="50.00",
        room="WB419",
        day_of_week="MONDAY",
        start_time="12:30",
        end_time="14:30",
    )
    db.add(theory)
    db.add(lab)
    db.flush()

    # Events — Theory (Friday)
    theory_events = [
        ("2026-05-15 10:30:00-04", "2026-05-15 12:30:00-04", 1),
        ("2026-05-22 10:30:00-04", "2026-05-22 12:30:00-04", 2),
        ("2026-05-29 10:30:00-04", "2026-05-29 12:30:00-04", 3),
        ("2026-06-05 10:30:00-04", "2026-06-05 12:30:00-04", 4),
        ("2026-06-12 10:30:00-04", "2026-06-12 12:30:00-04", 5),
        ("2026-06-19 10:30:00-04", "2026-06-19 12:30:00-04", 6),
        ("2026-06-26 10:30:00-04", "2026-06-26 12:30:00-04", 7),
        ("2026-07-10 10:30:00-04", "2026-07-10 12:30:00-04", 9),
        ("2026-07-17 10:30:00-04", "2026-07-17 12:30:00-04", 10),
        ("2026-07-24 10:30:00-04", "2026-07-24 12:30:00-04", 11),
        ("2026-07-31 10:30:00-04", "2026-07-31 12:30:00-04", 12),
        ("2026-08-07 10:30:00-04", "2026-08-07 12:30:00-04", 13),
        ("2026-08-14 10:30:00-04", "2026-08-14 12:30:00-04", 14),
        ("2026-08-21 10:30:00-04", "2026-08-21 12:30:00-04", 15),
    ]
    for st, et, wn in theory_events:
        db.add(Event(
            section_id=theory.section_id,
            title="OOP Theory",
            type="CLASS",
            start_time=st,
            end_time=et,
            week_number=wn,
            location="T334",
            is_recurring=True,
            recur_days="FRIDAY",
            recur_end="2026-08-21",
        ))

    # Events — Lab (Monday)
    lab_events = [
        ("2026-05-11 12:30:00-04", "2026-05-11 14:30:00-04", 1),
        ("2026-05-19 12:30:00-04", "2026-05-19 14:30:00-04", 2),
        ("2026-05-25 12:30:00-04", "2026-05-25 14:30:00-04", 3),
        ("2026-06-01 12:30:00-04", "2026-06-01 14:30:00-04", 4),
        ("2026-06-08 12:30:00-04", "2026-06-08 14:30:00-04", 5),
        ("2026-06-15 12:30:00-04", "2026-06-15 14:30:00-04", 6),
        ("2026-06-22 12:30:00-04", "2026-06-22 14:30:00-04", 7),
        ("2026-07-06 12:30:00-04", "2026-07-06 14:30:00-04", 9),
        ("2026-07-13 12:30:00-04", "2026-07-13 14:30:00-04", 10),
        ("2026-07-20 12:30:00-04", "2026-07-20 14:30:00-04", 11),
        ("2026-07-27 12:30:00-04", "2026-07-27 14:30:00-04", 12),
        ("2026-08-03 12:30:00-04", "2026-08-03 14:30:00-04", 13),
        ("2026-08-10 12:30:00-04", "2026-08-10 14:30:00-04", 14),
        ("2026-08-17 12:30:00-04", "2026-08-17 14:30:00-04", 15),
    ]
    for st, et, wn in lab_events:
        db.add(Event(
            section_id=lab.section_id,
            title="OOP Lab",
            type="CLASS",
            start_time=st,
            end_time=et,
            week_number=wn,
            location="WB419",
            is_recurring=True,
            recur_days="MONDAY",
            recur_end="2026-08-17",
        ))

    # Personal events
    db.add(Event(
        section_id=None,
        title="Sleep",
        type="PERSONAL",
        start_time="2026-05-11 23:00:00-04",
        end_time="2026-05-12 06:30:00-04",
        is_recurring=True,
        recur_days="MON,TUE,WED,THU,FRI,SAT,SUN",
        recur_end="2026-08-24",
    ))
    db.add(Event(
        section_id=None,
        title="Gym",
        type="PERSONAL",
        start_time="2026-05-11 17:00:00-04",
        end_time="2026-05-11 18:30:00-04",
        is_recurring=True,
        recur_days="MON,WED,FRI",
        recur_end="2026-08-24",
    ))

    db.flush()

    # Assessments — Theory section
    theory_assessments = [
        ("Hybrid Activity 1", "QUIZ",       None,    2,  "1.00",  "2026-05-22 23:59:00-04"),
        ("Hybrid Activity 2", "QUIZ",       None,    3,  "1.00",  "2026-05-29 23:59:00-04"),
        ("Assignment 1",      "ASSIGNMENT", None,    7,  "10.00", None),
        ("Midterm",           "MIDTERM",    None,    7,  "15.00", None),
        ("Assignment 2",      "ASSIGNMENT", None,    11, "10.00", "2026-08-02 23:59:00-04"),
        ("Final Exam",        "FINAL",      None,    15, "25.00", None),
    ]
    for title, atype, qtype, wn, wp, dd in theory_assessments:
        db.add(Assessment(
            section_id=theory.section_id,
            title=title,
            type=atype,
            quiz_type=qtype,
            week_number=wn,
            weight_percent=wp,
            due_date=dd,
        ))

    # Assessments — Lab section
    lab_assessments = [
        ("Lab Exercise 1", "LAB",      3,  "4.00",  None),
        ("Lab Exercise 2", "LAB",      5,  "4.00",  None),
        ("Lab Exercise 3", "LAB",      6,  "4.00",  None),
        ("Lab Exercise 4", "LAB",      9,  "4.00",  "2026-07-15 13:30:00-04"),
        ("Lab Exercise 5", "LAB",      10, "4.00",  "2026-07-29 13:30:00-04"),
        ("Lab Exercise 6", "LAB",      12, "4.00",  "2026-08-05 13:30:00-04"),
        ("Lab Exam (SBA)", "LAB_EXAM", 14, "10.00", "2026-08-12 13:30:00-04"),
    ]
    for title, atype, wn, wp, dd in lab_assessments:
        db.add(Assessment(
            section_id=lab.section_id,
            title=title,
            type=atype,
            week_number=wn,
            weight_percent=wp,
            due_date=dd,
        ))

    # Weekly knowledge
    knowledge_data = [
        (1, [{"topic": "Multidimensional Arrays", "subtopics": ["2D arrays", "array traversal"]}]),
        (2, [
            {"topic": "Exception Handling", "subtopics": ["try/catch", "throw", "checked vs unchecked"]},
            {"topic": "File I/O", "subtopics": ["FileReader", "BufferedWriter"]},
        ]),
        (3, [
            {"topic": "Objects and Classes", "subtopics": ["encapsulation", "access modifiers"]},
            {"topic": "Inheritance", "subtopics": ["extends", "super", "overriding"]},
        ]),
    ]
    for wn, topics in knowledge_data:
        db.add(WeeklyKnowledge(
            course_id=course.course_id,
            week_number=wn,
            topics=topics,
        ))

    db.commit()


# ─── Weeks ───────────────────────────────────────────────────────────────────

@app.get("/api/weeks", response_model=List[WeekOut])
def get_weeks(db: Session = Depends(get_db)):
    """Return all 15 academic weeks."""
    return db.query(Week).order_by(Week.week_number).all()


@app.get("/api/weeks/{week_number}", response_model=WeekOut)
def get_week(week_number: int, db: Session = Depends(get_db)):
    week = db.query(Week).filter(Week.week_number == week_number).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    return week


# ─── Courses ─────────────────────────────────────────────────────────────────

@app.get("/api/courses", response_model=List[CourseOut])
def get_courses(db: Session = Depends(get_db)):
    """Return all courses."""
    return db.query(Course).order_by(Course.course_id).all()


@app.get("/api/courses/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@app.post("/api/courses", response_model=CourseOut, status_code=201)
def create_course(body: CourseIn, db: Session = Depends(get_db)):
    course = Course(**body.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@app.put("/api/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, body: CourseIn, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for k, v in body.model_dump().items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course


@app.delete("/api/courses/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()


# ─── Sections ────────────────────────────────────────────────────────────────

@app.get("/api/sections", response_model=List[SectionOut])
def get_sections(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Return all sections, optionally filtered by course_id."""
    q = db.query(CourseSection)
    if course_id:
        q = q.filter(CourseSection.course_id == course_id)
    return q.order_by(CourseSection.section_id).all()


@app.get("/api/sections/{section_id}", response_model=SectionOut)
def get_section(section_id: int, db: Session = Depends(get_db)):
    s = db.query(CourseSection).filter(CourseSection.section_id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    return s


@app.post("/api/sections", response_model=SectionOut, status_code=201)
def create_section(body: SectionIn, db: Session = Depends(get_db)):
    section = CourseSection(**body.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@app.put("/api/sections/{section_id}", response_model=SectionOut)
def update_section(section_id: int, body: SectionIn, db: Session = Depends(get_db)):
    s = db.query(CourseSection).filter(CourseSection.section_id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@app.delete("/api/sections/{section_id}", status_code=204)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    s = db.query(CourseSection).filter(CourseSection.section_id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(s)
    db.commit()


# ─── Assessments ─────────────────────────────────────────────────────────────

@app.get("/api/assessments", response_model=List[AssessmentOut])
def get_assessments(
    section_id:  Optional[int] = None,
    week_number: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Return assessments, optionally filtered by section or week."""
    q = db.query(Assessment)
    if section_id:
        q = q.filter(Assessment.section_id == section_id)
    if week_number:
        q = q.filter(Assessment.week_number == week_number)
    return q.order_by(Assessment.week_number, Assessment.assessment_id).all()


@app.get("/api/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    a = db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


@app.post("/api/assessments", response_model=AssessmentOut, status_code=201)
def create_assessment(body: AssessmentIn, db: Session = Depends(get_db)):
    a = Assessment(**body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@app.put("/api/assessments/{assessment_id}", response_model=AssessmentOut)
def update_assessment(assessment_id: int, body: AssessmentIn, db: Session = Depends(get_db)):
    a = db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


@app.delete("/api/assessments/{assessment_id}", status_code=204)
def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    a = db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.delete(a)
    db.commit()


# ─── Events ──────────────────────────────────────────────────────────────────

@app.get("/api/events", response_model=List[EventOut])
def get_events(
    week_number: Optional[int] = None,
    section_id:  Optional[int] = None,
    type:        Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return events, optionally filtered by week, section, or type."""
    q = db.query(Event)
    if week_number:
        q = q.filter(Event.week_number == week_number)
    if section_id:
        q = q.filter(Event.section_id == section_id)
    if type:
        q = q.filter(Event.type == type)
    return q.order_by(Event.start_time).all()


@app.get("/api/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.event_id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return e


@app.post("/api/events", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db)):
    e = Event(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@app.put("/api/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, body: EventIn, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.event_id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


@app.delete("/api/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.event_id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(e)
    db.commit()


# ─── Weekly Knowledge ─────────────────────────────────────────────────────────

@app.get("/api/knowledge", response_model=List[WeeklyKnowledgeOut])
def get_knowledge(
    course_id:   Optional[int] = None,
    week_number: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Return weekly knowledge entries, optionally filtered by course or week."""
    q = db.query(WeeklyKnowledge)
    if course_id:
        q = q.filter(WeeklyKnowledge.course_id == course_id)
    if week_number:
        q = q.filter(WeeklyKnowledge.week_number == week_number)
    return q.order_by(WeeklyKnowledge.week_number).all()


@app.get("/api/knowledge/{knowledge_id}", response_model=WeeklyKnowledgeOut)
def get_knowledge_entry(knowledge_id: int, db: Session = Depends(get_db)):
    k = db.query(WeeklyKnowledge).filter(WeeklyKnowledge.knowledge_id == knowledge_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Entry not found")
    return k


@app.post("/api/knowledge", response_model=WeeklyKnowledgeOut, status_code=201)
def create_knowledge(body: WeeklyKnowledgeIn, db: Session = Depends(get_db)):
    k = WeeklyKnowledge(**body.model_dump())
    db.add(k)
    db.commit()
    db.refresh(k)
    return k


@app.put("/api/knowledge/{knowledge_id}", response_model=WeeklyKnowledgeOut)
def update_knowledge(knowledge_id: int, body: WeeklyKnowledgeIn, db: Session = Depends(get_db)):
    k = db.query(WeeklyKnowledge).filter(WeeklyKnowledge.knowledge_id == knowledge_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Entry not found")
    for key, val in body.model_dump().items():
        setattr(k, key, val)
    db.commit()
    db.refresh(k)
    return k


@app.delete("/api/knowledge/{knowledge_id}", status_code=204)
def delete_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    k = db.query(WeeklyKnowledge).filter(WeeklyKnowledge.knowledge_id == knowledge_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(k)
    db.commit()

"""Request and generated-output schemas."""

from pydantic import BaseModel, Field


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    meeting_date: str
    duration_seconds: int = Field(default=0, ge=0)
    participants: list[str] = Field(default_factory=list)
    transcript: str = Field(min_length=1)


class MeetingUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    meeting_date: str
    participants: list[str] = Field(default_factory=list)


class ActionItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    owner: str | None = None
    due_date: str | None = None


class ActionItemUpdate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    owner: str | None = None
    due_date: str | None = None
    is_complete: bool = False


class GeneratedActionItem(BaseModel):
    description: str
    owner: str | None = None
    due_date: str | None = None


class GeneratedTopic(BaseModel):
    title: str
    timestamp_seconds: float = 0


class GeneratedNotes(BaseModel):
    overview: str
    topics: list[GeneratedTopic] = Field(default_factory=list)
    action_items: list[GeneratedActionItem] = Field(default_factory=list)


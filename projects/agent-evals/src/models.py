"""Versioned public evaluation contracts. No target runtime imports."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Identifier = Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")]
Verdict = Literal["pass", "fail", "unknown", "not_applicable"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Limits(Model):
    timeout_seconds: float = Field(default=120, gt=0, le=3600)
    max_tool_calls: int = Field(default=50, ge=0, le=10000)
    max_input_tokens: int | None = Field(default=None, gt=0)


class Turn(Model):
    user: str = Field(min_length=1)


class GraderSpec(Model):
    id: Identifier
    required: bool = True
    params: dict[str, Any] = Field(default_factory=dict)


class EvalCase(Model):
    schema_version: Literal[1] = 1
    case_id: Identifier
    version: int = Field(default=1, ge=1)
    description: str
    tags: list[str] = Field(default_factory=list)
    turns: list[Turn] = Field(min_length=1, max_length=20)
    limits: Limits = Field(default_factory=Limits)
    graders: list[GraderSpec] = Field(min_length=1)

    @model_validator(mode="after")
    def require_completion(self):
        if not any(g.id == "runtime.completed" and g.required for g in self.graders):
            raise ValueError("a required runtime.completed grader is mandatory")
        return self


class Suite(Model):
    schema_version: Literal[1] = 1
    name: Identifier
    version: int = Field(default=1, ge=1)
    purpose: Literal["regression", "capability", "integration", "selftest"]
    cases: list[str] = Field(min_length=1)


class SessionLease(Model):
    session_key: str = Field(min_length=1)
    thread_id: str = ""


class TargetConfig(Model):
    kind: Literal["fixture", "yba"]
    fixtures: str | None = None
    base_url: str | None = None
    headers_env: dict[str, str] = Field(default_factory=dict)
    poll_seconds: float = Field(default=1, gt=0, le=30)
    request_timeout_seconds: float = Field(default=15, gt=0, le=60)
    max_response_bytes: int = Field(default=8_000_000, ge=1024, le=32_000_000)
    sessions: list[SessionLease] = Field(default_factory=list)
    isolated_test_environment: bool = False
    environment_revision: str = ""
    declared_revision: str = ""

    @model_validator(mode="after")
    def validate_target(self):
        if self.kind == "fixture":
            if not self.fixtures:
                raise ValueError("fixture target requires fixtures")
        else:
            from urllib.parse import urlsplit

            url = urlsplit(self.base_url or "")
            if url.scheme not in {"http", "https"} or not url.hostname:
                raise ValueError("YBA requires an HTTP(S) base_url")
            if url.username or url.password or url.query or url.fragment:
                raise ValueError("base_url must not contain credentials, query or fragment")
            if not self.isolated_test_environment or not self.sessions:
                raise ValueError("YBA requires explicitly isolated test sessions")
            # Workspace is session-scoped, not thread-scoped: two threads do not isolate trials.
            keys = [s.session_key for s in self.sessions]
            if len(keys) != len(set(keys)):
                raise ValueError("each trial lease must use a distinct session_key")
            if not self.environment_revision or not self.declared_revision:
                raise ValueError("YBA requires declared code and environment revisions")
        return self


class Variant(Model):
    name: Identifier
    target: str
    model: str = ""


class Experiment(Model):
    schema_version: Literal[1] = 1
    name: Identifier
    suite: str
    variants: list[Variant] = Field(min_length=1)
    repetitions: int = Field(default=1, ge=1, le=100)
    concurrency: int = Field(default=1, ge=1, le=32)

    @model_validator(mode="after")
    def unique_variants(self):
        names = [v.name for v in self.variants]
        if len(names) != len(set(names)):
            raise ValueError("variant names must be unique")
        return self


class Event(Model):
    event_id: str
    kind: Literal[
        "user", "assistant", "outbound", "tool_use", "tool_result", "result", "usage", "task", "other"
    ]
    target_run_id: str = ""
    source: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class Artifact(Model):
    name: str
    path: str
    sha256: str
    size: int = Field(ge=0)


class Completeness(Model):
    trace: bool = False
    outbound: bool = False
    state: bool = False
    artifacts: bool = False


class Evidence(Model):
    target_run_id: str
    status: Literal["running", "completed", "failed", "interrupted", "incomplete"]
    events: list[Event] = Field(default_factory=list)
    completeness: Completeness = Field(default_factory=Completeness)
    state: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[Artifact] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class Grade(Model):
    grader_id: str
    grader_version: str = "1"
    required: bool
    verdict: Verdict
    reason: str
    evidence_ids: list[str] = Field(default_factory=list)


class TrialResult(Model):
    trial_id: str
    case_id: str
    variant: str
    repetition: int
    mode: Literal["fixture", "yba"]
    execution_status: Literal["finished", "execution_error", "timeout", "cancelled"]
    verdict: Literal["pass", "fail", "unknown"]
    attribution: str = ""
    grades: list[Grade] = Field(default_factory=list)
    turns: list[Evidence] = Field(default_factory=list)
    elapsed_seconds: float = 0
    error: str = ""
    cleanup: str = "not_needed"
    metrics: dict[str, Any] = Field(default_factory=dict)

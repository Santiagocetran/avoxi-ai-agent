"""Env + YAML loader. Single read at startup; no other module touches
os.environ. All parsing, defaulting and validation (pydantic) live here so
every other module sees a pre-validated AppConfig and trusts it.

Inputs
  .env                     AVOXI_API_TOKEN, LLM_PROVIDER, LLM_API_KEY,
                           LLM_MODEL, optional LLM_BASE_URL, COMPANY_NAME
  config/schedule.yaml     on-call windows

Surface
  load_config() -> AppConfig       # throws only on missing/invalid config

Types
  AppConfig = {
    avoxi:       { token: str; base_url: str };
    llm:         { provider: 'kimi'|'openai'|'gemini';
                   api_key: str; model: str; base_url: str | None };
    schedule:    Schedule;
    company_name: str;
  }

  Schedule = { timezone: str; windows: list[Window] };
  Window   = { name?: str; days: list[Weekday]; start: str; end: str };
  Weekday  = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';

Note: AppConfig.llm.base_url may be None, meaning "use the SDK's default base
URL". The per-provider default URL table lives here so no downstream module
knows which provider is active.
"""

from pathlib import Path
from typing import Literal
import os

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError
import yaml

load_dotenv()

Weekday = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
Provider = Literal["kimi", "openai", "gemini"]

PROVIDER_BASE_URLS: dict[str, str] = {
    "kimi": "https://api.moonshot.cn/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
}


class Window(BaseModel):
    name: str | None = None
    days: list[Weekday]
    start: str = Field(pattern=r"^\d{2}:\d{2}$")
    end: str = Field(pattern=r"^\d{2}:\d{2}(\+1)?$")


class Schedule(BaseModel):
    timezone: str
    windows: list[Window] = Field(min_length=1)


class AvoxiConfig(BaseModel):
    token: str = Field(min_length=1)
    base_url: str = "https://genius.avoxi.com/api/v2"


class LlmConfig(BaseModel):
    provider: Provider
    api_key: str = Field(min_length=1)
    model: str = Field(min_length=1)
    base_url: str | None = None


class AppConfig(BaseModel):
    avoxi: AvoxiConfig
    llm: LlmConfig
    schedule: Schedule
    company_name: str = "your company"


class _Env(BaseModel):
    AVOXI_API_TOKEN: str = Field(min_length=1)
    AVOXI_BASE_URL: str = "https://genius.avoxi.com/api/v2"
    LLM_PROVIDER: Provider
    LLM_API_KEY: str = Field(min_length=1)
    LLM_MODEL: str = Field(min_length=1)
    LLM_BASE_URL: str | None = None
    COMPANY_NAME: str = "your company"


def _format_validation_error(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in issue['loc']) or 'root'}: {issue['msg']}"
        for issue in error.errors()
    )


def load_config() -> AppConfig:
    try:
        env = _Env.model_validate(dict(os.environ))
    except ValidationError as exc:
        raise ValueError(f"Config error - {_format_validation_error(exc)}") from exc

    schedule_path = Path(os.environ.get("SCHEDULE_PATH") or Path.cwd() / "config" / "schedule.yaml")

    try:
        raw = yaml.safe_load(schedule_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RuntimeError(f"Cannot read schedule file: {schedule_path}") from exc

    try:
        schedule = Schedule.model_validate(raw)
    except ValidationError as exc:
        raise ValueError(f"schedule.yaml invalid - {_format_validation_error(exc)}") from exc

    if env.LLM_BASE_URL is not None:
        base_url = env.LLM_BASE_URL
    elif env.LLM_PROVIDER == "openai":
        base_url = None
    else:
        base_url = PROVIDER_BASE_URLS[env.LLM_PROVIDER]

    return AppConfig(
        avoxi=AvoxiConfig(token=env.AVOXI_API_TOKEN, base_url=env.AVOXI_BASE_URL),
        llm=LlmConfig(
            provider=env.LLM_PROVIDER,
            api_key=env.LLM_API_KEY,
            model=env.LLM_MODEL,
            base_url=base_url,
        ),
        schedule=schedule,
        company_name=env.COMPANY_NAME,
    )

"""LangChain tools for x402check (https://x402check.dev)."""

from __future__ import annotations

import json
import os
from typing import Any, Optional, Sequence

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

DEFAULT_BASE = "https://x402check.dev"


class PreflightInput(BaseModel):
    url: str = Field(..., description="Absolute https URL of the x402 seller endpoint")
    fresh: bool = Field(False, description="Force a live probe; ignore cache")


class CompareInput(BaseModel):
    urls: list[str] = Field(..., description="Candidate seller URLs (max 25)")
    fresh: bool = Field(False, description="Force a live probe")


def _base(base_url: Optional[str] = None) -> str:
    return (base_url or os.environ.get("X402CHECK_URL") or DEFAULT_BASE).rstrip("/")


def preflight(
    url: str,
    *,
    base_url: Optional[str] = None,
    fresh: bool = False,
    payment_headers: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    if os.environ.get("X402CHECK_SKIP") == "1":
        return {"url": url, "verdict": "ok", "reasonCodes": ["preflight_skipped"], "history": {"checks": 0}}
    params = {"url": url}
    if fresh:
        params["fresh"] = "1"
    headers = {"accept": "application/json", **(payment_headers or {})}
    with httpx.Client(timeout=30.0) as client:
        res = client.get(f"{_base(base_url)}/preflight", params=params, headers=headers)
        if res.status_code == 402:
            raise RuntimeError("preflight_payment_required")
        res.raise_for_status()
        return res.json()


def preflight_batch(
    urls: Sequence[str],
    *,
    base_url: Optional[str] = None,
    fresh: bool = False,
    payment_headers: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        **(payment_headers or {}),
    }
    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            f"{_base(base_url)}/preflight",
            headers=headers,
            json={"urls": list(urls), "fresh": fresh},
        )
        if res.status_code == 402:
            raise RuntimeError("preflight_payment_required")
        res.raise_for_status()
        return res.json()


def create_x402check_tools(
    *,
    base_url: Optional[str] = None,
    payment_headers: Optional[dict[str, str]] = None,
) -> list[StructuredTool]:
    """Return LangChain StructuredTools: preflight_check, verify_payto, compare_tools."""

    def _preflight(url: str, fresh: bool = False) -> str:
        return json.dumps(preflight(url, base_url=base_url, fresh=fresh, payment_headers=payment_headers))

    def _verify(url: str, fresh: bool = False) -> str:
        check = preflight(url, base_url=base_url, fresh=fresh, payment_headers=payment_headers)
        slim = {
            "url": check.get("url"),
            "verdict": check.get("verdict"),
            "payTo": check.get("payTo"),
            "priceUsd": check.get("priceUsd"),
            "network": check.get("network"),
            "reasonCodes": check.get("reasonCodes", []),
            "payToChanges": (check.get("history") or {}).get("payToChanges", []),
            "priceChanges": (check.get("history") or {}).get("priceChanges", []),
        }
        return json.dumps(slim)

    def _compare(urls: list[str], fresh: bool = False) -> str:
        return json.dumps(
            preflight_batch(urls, base_url=base_url, fresh=fresh, payment_headers=payment_headers)
        )

    return [
        StructuredTool.from_function(
            func=_preflight,
            name="preflight_check",
            description=(
                "Mandatory trust preflight before paying any x402 endpoint. "
                "Returns verdict ok|caution|avoid plus history. Do not pay if avoid."
            ),
            args_schema=PreflightInput,
        ),
        StructuredTool.from_function(
            func=_verify,
            name="verify_payto",
            description="Verify the payTo / receiving wallet an x402 seller demands before signing USDC on Base.",
            args_schema=PreflightInput,
        ),
        StructuredTool.from_function(
            func=_compare,
            name="compare_tools",
            description="Compare several x402 seller URLs before choosing which to pay.",
            args_schema=CompareInput,
        ),
    ]


__all__ = ["preflight", "preflight_batch", "create_x402check_tools"]

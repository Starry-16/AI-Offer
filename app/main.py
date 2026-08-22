"""秋招助手后端入口。

启动方式：python -m uvicorn app.main:app --port 8000
"""

from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import asyncio

from . import seed_data, storage
from .routers import ai, applications, companies, questions, resumes
from .routers import email as email_router
from .services import email_service

app = FastAPI(title="秋招助手")

app.include_router(applications.router)
app.include_router(resumes.router)
app.include_router(questions.router)
app.include_router(companies.router)
app.include_router(ai.router)
app.include_router(email_router.router)


@app.on_event("startup")
async def start_email_scheduler():
    """每 6 小时自动跑一轮邮箱进度同步（未启用时直接返回，开销极小）。"""
    async def _loop():
        while True:
            await asyncio.sleep(6 * 3600)
            try:
                await email_service.sync_once()
            except Exception:
                pass
    asyncio.create_task(_loop())


@app.on_event("startup")
def seed_companies():
    """首次启动时把内置企业库写入 companies 集合。"""
    if not storage.read_all("companies"):
        now = storage.now_str()
        items = []
        for c in seed_data.COMPANY_SEED:
            item = dict(c)
            item.update({"id": storage.new_id(), "created_at": now, "updated_at": now})
            items.append(item)
        storage.write_all("companies", items)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/stats")
def get_stats():
    """概览页统计：投递状态分布、近 7 天动态、题库掌握情况。"""
    apps = storage.read_all("applications")
    questions_all = storage.read_all("questions")
    resumes_all = storage.read_all("resumes")

    status_counts = {}
    for a in apps:
        status_counts[a.get("status", "applied")] = status_counts.get(
            a.get("status", "applied"), 0
        ) + 1

    # 近 7 天动态：按事件与更新时间聚合
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    recent_events = []
    for a in apps:
        for ev in a.get("events", []):
            if ev.get("date", "") >= week_ago:
                recent_events.append(
                    {
                        "company": a.get("company"),
                        "position": a.get("position"),
                        "type": ev.get("type", "进展"),
                        "date": ev.get("date", ""),
                        "note": ev.get("note", ""),
                    }
                )
    recent_events.sort(key=lambda x: x["date"], reverse=True)

    # 待巩固题目（掌握度 <= 2）
    weak_questions = [q for q in questions_all if q.get("mastery", 0) <= 2]

    # 即将面试 / 笔试中的公司
    active = [
        {
            "company": a.get("company"),
            "position": a.get("position"),
            "status": a.get("status"),
            "stage": a.get("stage", ""),
            "category": a.get("category", "秋招"),
        }
        for a in apps
        if a.get("status") in ("written_test", "interview")
    ]

    return {
        "total_applications": len(apps),
        "total_questions": len(questions_all),
        "total_resumes": len(resumes_all),
        "status_counts": status_counts,
        "recent_events": recent_events[:10],
        "weak_questions_count": len(weak_questions),
        "active_processes": active,
    }

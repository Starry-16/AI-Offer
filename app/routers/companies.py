"""企业投递链接库 API + 简历岗位匹配。"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import seed_data, storage

router = APIRouter(prefix="/api/companies", tags=["companies"])


class CompanyIn(BaseModel):
    name: str = Field(min_length=1)
    category: str = "互联网"
    positions: List[str] = []
    url: str = ""


def _load() -> list:
    return storage.read_all("companies")


def _save(items: list) -> None:
    storage.write_all("companies", items)


@router.get("/meta")
def company_meta():
    """前端筛选下拉框用的规范选项。"""
    return {"position_types": seed_data.POSITION_TYPES}


@router.get("")
def list_companies(category: str = "", position: str = "", keyword: str = ""):
    items = _load()
    if category:
        items = [c for c in items if c.get("category") == category]
    if position:
        items = [c for c in items if position in (c.get("positions") or [])]
    if keyword:
        kw = keyword.lower()
        items = [c for c in items if kw in (c.get("name") or "").lower()]
    items.sort(key=lambda x: (x.get("category") or "", x.get("name") or ""))
    return items


@router.post("")
def create_company(body: CompanyIn):
    items = _load()
    if any(c.get("name") == body.name for c in items):
        raise HTTPException(status_code=400, detail="该公司已存在")
    item = body.model_dump()
    now = storage.now_str()
    item.update({"id": storage.new_id(), "created_at": now, "updated_at": now})
    items.append(item)
    _save(items)
    return item


@router.put("/{company_id}")
def update_company(company_id: str, body: CompanyIn):
    items = _load()
    for c in items:
        if c.get("id") == company_id:
            data = body.model_dump()
            data["id"] = company_id
            data["created_at"] = c.get("created_at", "")
            data["updated_at"] = storage.now_str()
            items[items.index(c)] = data
            _save(items)
            return data
    raise HTTPException(status_code=404, detail="企业不存在")


@router.delete("/{company_id}")
def delete_company(company_id: str):
    items = _load()
    new_items = [c for c in items if c.get("id") != company_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="企业不存在")
    _save(new_items)
    return {"ok": True}


@router.post("/seed")
def reseed_companies():
    """导入/更新内置企业库：同名公司刷新分类、岗位与链接，返回新增与更新数量。"""
    items = _load()
    by_name = {c.get("name"): c for c in items}
    now = storage.now_str()
    added = updated = 0
    for c in seed_data.COMPANY_SEED:
        existing = by_name.get(c["name"])
        if existing:
            if any(existing.get(k) != c.get(k) for k in ("category", "positions", "url")):
                existing.update({"category": c["category"], "positions": c["positions"],
                                 "url": c["url"], "updated_at": now})
                updated += 1
            continue
        item = dict(c)
        item.update({"id": storage.new_id(), "created_at": now, "updated_at": now})
        items.append(item)
        added += 1
    _save(items)
    return {"ok": True, "added": added, "updated": updated, "total": len(items)}


# ================= 简历岗位匹配 =================

def _score_resume(text: str) -> dict:
    """对简历文本按岗位分类打分，返回 {岗位: (0-100 分, 命中关键词列表)}。"""
    text = text.lower()
    scores = {}
    for pos, keywords in seed_data.POSITION_KEYWORDS.items():
        raw = 0
        hits = []
        for kw, weight in keywords.items():
            if kw in text:
                raw += weight
                hits.append(kw)
        # 归一化：30 分视为完全匹配，线性映射到 0-100
        score = min(100, round(raw / 30 * 100)) if raw else 0
        scores[pos] = (score, hits)
    return scores


@router.get("/match")
def match_positions(resume_id: str, position: str = ""):
    """根据简历与企业库做匹配，返回按匹配度从高到低排序的企业列表。"""
    resumes = storage.read_all("resumes")
    resume = next((r for r in resumes if r.get("id") == resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    text = " ".join([
        resume.get("target") or "",
        resume.get("content") or "",
        " ".join(resume.get("tags") or []),
        resume.get("note") or "",
    ])
    scores = _score_resume(text)

    results = []
    for c in _load():
        positions = c.get("positions") or []
        if position:
            # 指定岗位类型：只看该类型且企业得有这类岗位
            if position not in positions:
                continue
            score, hits = scores[position]
            best = position
        else:
            # 未指定：取企业各岗位分类中简历得分最高者
            best, score, hits = "", 0, []
            for p in positions:
                s, h = scores.get(p, (0, []))
                if s > score:
                    best, score, hits = p, s, h
        if score <= 0:
            continue
        results.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "category": c.get("category"),
            "url": c.get("url"),
            "positions": positions,
            "matched_position": best,
            "score": score,
            "hits": hits[:8],
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    return {
        "resume_name": resume.get("name", ""),
        "position": position,
        "total": len(results),
        "results": results,
    }

"""笔试/面试题库 API。"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .. import storage

router = APIRouter(prefix="/api/questions", tags=["questions"])


class QuestionIn(BaseModel):
    title: str = Field(min_length=1)
    category: str = "其他"
    answer: str = ""
    difficulty: str = "medium"
    mastery: int = Field(0, ge=0, le=5)
    is_wrong: bool = False
    source: str = ""


def _load() -> list:
    return storage.read_all("questions")


def _save(items: list) -> None:
    storage.write_all("questions", items)


@router.get("")
def list_questions(
    category: Optional[str] = Query(None),
    mastery: Optional[int] = Query(None),
    wrong: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
):
    items = _load()
    if category:
        items = [x for x in items if x.get("category") == category]
    if mastery is not None:
        items = [x for x in items if x.get("mastery", 0) <= mastery]
    if wrong:
        items = [x for x in items if x.get("is_wrong")]
    if keyword:
        kw = keyword.strip().lower()
        items = [
            x
            for x in items
            if kw in (x.get("title") or "").lower()
            or kw in (x.get("answer") or "").lower()
        ]
    items.sort(key=lambda x: (x.get("mastery") or 0, x.get("updated_at") or ""))
    return items


@router.post("")
def create_question(body: QuestionIn):
    items = _load()
    item = body.model_dump()
    item.update(
        id=storage.new_id(),
        created_at=storage.now_str(),
        updated_at=storage.now_str(),
    )
    items.append(item)
    _save(items)
    return item


@router.put("/{question_id}")
def update_question(question_id: str, body: QuestionIn):
    items = _load()
    for i, item in enumerate(items):
        if item["id"] == question_id:
            items[i].update(body.model_dump())
            items[i]["updated_at"] = storage.now_str()
            _save(items)
            return items[i]
    raise HTTPException(status_code=404, detail="题目不存在")


@router.delete("/{question_id}")
def delete_question(question_id: str):
    items = _load()
    remain = [x for x in items if x["id"] != question_id]
    if len(remain) == len(items):
        raise HTTPException(status_code=404, detail="题目不存在")
    _save(remain)
    return {"ok": True}

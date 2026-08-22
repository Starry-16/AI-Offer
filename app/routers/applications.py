"""投递进度管理 API，含智能导入解析。"""

import re
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import storage
from ..services import ai_service
from ..services.app_sync import find_match as _find_match, sync_existing as _sync_existing

router = APIRouter(prefix="/api/applications", tags=["applications"])


class TimelineEvent(BaseModel):
    date: str = ""
    type: str = ""
    note: str = ""


class ApplicationIn(BaseModel):
    company: str = Field(min_length=1)
    position: str = Field(min_length=1)
    category: str = "秋招"  # 秋招 / 实习
    location: str = ""
    channel: str = ""
    status: str = "applied"
    stage: str = ""
    apply_date: str = ""
    link: str = ""
    note: str = ""
    events: List[TimelineEvent] = []


def _load() -> list:
    return storage.read_all("applications")


def _save(items: list) -> None:
    storage.write_all("applications", items)


@router.get("")
def list_applications():
    items = _load()
    items.sort(key=lambda x: (x.get("updated_at") or ""), reverse=True)
    return items


@router.post("")
def create_application(body: ApplicationIn):
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


@router.put("/{app_id}")
def update_application(app_id: str, body: ApplicationIn):
    items = _load()
    for i, item in enumerate(items):
        if item["id"] == app_id:
            items[i].update(body.model_dump())
            items[i]["updated_at"] = storage.now_str()
            _save(items)
            return items[i]
    raise HTTPException(status_code=404, detail="投递记录不存在")


@router.delete("/{app_id}")
def delete_application(app_id: str):
    items = _load()
    remain = [x for x in items if x["id"] != app_id]
    if len(remain) == len(items):
        raise HTTPException(status_code=404, detail="投递记录不存在")
    _save(remain)
    return {"ok": True}


# ============================================================
# 智能导入
# ============================================================

class ParseIn(BaseModel):
    text: str = Field(min_length=1)


class ImportIn(BaseModel):
    records: List[ApplicationIn] = Field(min_length=1)


_STATUS_KEYWORDS = [
    ("offer", ["offer", "Offer", "录用", "录取", "意向书", "已offer"]),
    ("rejected", ["未通过", "感谢信", "淘汰", "婉拒", "不通过", "流程结束", "已结束"]),
    ("declined", ["已放弃", "主动放弃", "撤回"]),
    ("interview", ["面试", "一面", "二面", "三面", "HR面", "hr面", "约面"]),
    ("written_test", ["笔试", "测评", "在线测评", "机试"]),
]


def _map_status(text: str) -> str:
    for status, kws in _STATUS_KEYWORDS:
        if any(k in text for k in kws):
            return status
    return "applied"


def _map_category(text: str) -> str:
    return "实习" if ("实习" in text or "intern" in text.lower()) else "秋招"


def _regex_parse(text: str) -> list:
    """无 AI 时的兜底解析：以日期为锚点，状态机按记录切分，识别状态、实习/秋招关键词。"""
    date_re = re.compile(r"(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2})")
    status_re = re.compile(
        r"(offer|Offer|录用|录取|意向书|未通过|感谢信|淘汰|婉拒|不通过|流程结束|已结束|"
        r"已放弃|撤回|面试|一面|二面|三面|HR面|hr面|笔试|测评|机试|已投递|投递成功)"
    )
    position_hint = re.compile(r"工程师|开发|专员|经理|运营|产品|算法|设计|实习|校招|招聘")

    def is_status_line(line: str) -> bool:
        s = line.replace("状态：", "").replace("状态:", "").strip()
        return len(s) <= 12 and bool(status_re.search(s)) and not position_hint.search(s)

    # 状态机：以日期为锚点把连续行归组为一条记录
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    groups = []
    cur, cur_has_date = [], False
    for line in lines:
        has_date = bool(date_re.search(line))
        # 当前组已有日期，且本行不是“跟在日期后的状态行” → 开启新记录
        if cur and cur_has_date and not (is_status_line(line) and not has_date):
            groups.append(cur)
            cur, cur_has_date = [line], has_date
        else:
            cur.append(line)
            if has_date:
                cur_has_date = True
    if cur:
        groups.append(cur)

    records = []
    for g in groups:
        joined = " ".join(g)
        if len(joined) < 4:
            continue
        date_m = date_re.search(joined)
        position = ""
        for l in g:
            if date_re.search(l) or is_status_line(l):
                continue
            if len(l) > len(position):
                position = l
        records.append({
            "company": "待确认",
            "position": (position or g[0])[:60],
            "category": _map_category(joined),
            "status": _map_status(joined),
            "apply_date": _norm_date(date_m.group(1)) if date_m else "",
            "note": "",
        })
    return records


def _norm_date(s: str) -> str:
    s = s.replace("年", "-").replace("月", "-").replace("日", "").replace("/", "-").replace(".", "-")
    parts = s.split("-")
    if len(parts) == 3:
        return f"{parts[0]}-{int(parts[1]):02d}-{int(parts[2]):02d}"
    return s


async def _fetch_url_text(url: str) -> str:
    """尝试抓取链接，返回纯文本；登录墙/SPA 空壳会抛错。"""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        )
        resp.raise_for_status()
        html = resp.text
    # 去除标签提取纯文本
    text = re.sub(r"<script[\s\S]*?</script>", " ", html)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


@router.post("/import/parse")
async def parse_import(body: ParseIn):
    """解析粘贴的内容（链接或大段文本），返回结构化记录供预览。"""
    text = body.text.strip()
    method = "text"

    # 如果是链接，先尝试抓取
    if re.match(r"^https?://\S+$", text):
        method = "url"
        try:
            fetched = await _fetch_url_text(text)
            # SPA 空壳通常提取不到多少有效文本
            if len(fetched) < 120:
                raise ValueError("提取到的文本过少")
            text = fetched
        except Exception:
            return {
                "records": [],
                "method": "url",
                "need_manual": True,
                "message": "该链接需要登录后才能查看，无法直接抓取。请在浏览器中打开链接，全选复制页面内容（Ctrl+A → Ctrl+C），然后粘贴到这里重新解析。",
            }

    # 优先用 AI 解析
    ai_cfg = ai_service.get_ai_config()
    if (ai_cfg.get("api_key") or "").strip():
        prompt = (
            "你是一个投递记录解析器。请从以下招聘网站文本中提取所有投递记录，"
            "返回严格的 JSON 数组（不要输出任何其他内容、不要 markdown 代码块）。\n"
            "每条记录包含字段：\n"
            '- company: 公司名称（如"哔哩哔哩""字节跳动"，文本中没有则填"待确认"）\n'
            "- position: 岗位名称\n"
            '- category: "实习" 或 "秋招"（含"实习/日常实习/暑期实习/intern"→实习；校招/秋招/校园招聘/正式→秋招；无法判断→秋招）\n'
            '- status: 投递状态，取值之一：applied(已投递)/written_test(笔试测评)/interview(面试中)/offer(已拿offer)/rejected(未通过感谢信)/declined(已放弃)\n'
            "- apply_date: 投递日期，格式 YYYY-MM-DD，没有则空字符串\n"
            "- note: 其他关键信息（如面试进度、薪资），可留空\n\n"
            f"待解析文本：\n{text[:6000]}"
        )
        try:
            reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.2)
            records = _extract_json_array(reply)
            if records:
                # 归一化
                for r in records:
                    valid = {"applied", "written_test", "interview", "offer", "rejected", "declined"}
                    r["status"] = r.get("status") if r.get("status") in valid else _map_status(str(r))
                    r["category"] = "实习" if "实习" in str(r.get("category", "")) else "秋招"
                    r.setdefault("company", "待确认")
                    r.setdefault("position", "")
                    r.setdefault("apply_date", "")
                    r.setdefault("note", "")
                return {"records": records, "method": "ai", "need_manual": False}
        except ai_service.AIConfigError:
            pass  # 落到正则兜底
        except Exception:
            pass

    # 正则兜底
    records = _regex_parse(text)
    return {
        "records": records,
        "method": "regex",
        "need_manual": False,
        "message": "未配置 AI，使用基础解析，请在下方预览中核对修正。",
    }


def _extract_json_array(text: str) -> Optional[list]:
    """从 AI 回复中提取 JSON 数组。"""
    import json as _json
    # 去掉 markdown 代码块
    m = re.search(r"\[[\s\S]*\]", text)
    if not m:
        return None
    try:
        data = _json.loads(m.group(0))
        return data if isinstance(data, list) else None
    except Exception:
        return None


@router.post("/import")
def import_applications(body: ImportIn):
    """批量导入：新记录新增，已有记录同步最新进度，无变化跳过。"""
    items = _load()
    created, updated, unchanged = [], 0, 0
    for rec in body.records:
        item = rec.model_dump()
        exist = _find_match(items, item.get("company", ""), item.get("position", ""), item.get("apply_date", ""))
        if exist is not None:
            if _sync_existing(exist, item):
                updated += 1
            else:
                unchanged += 1
            continue
        item.update(
            id=storage.new_id(),
            created_at=storage.now_str(),
            updated_at=storage.now_str(),
        )
        items.append(item)
        created.append(item)
    _save(items)
    return {"ok": True, "count": len(created), "updated": updated, "skipped": unchanged}

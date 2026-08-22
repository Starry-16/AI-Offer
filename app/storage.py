"""基于本地 JSON 文件的数据存储层。

所有数据保存在项目根目录的 data/ 目录下，无需数据库，
每个集合对应一个 JSON 文件，读写加锁保证并发安全。
"""

import json
import threading
import uuid
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_lock = threading.Lock()

# 集合 -> 初始内容
_COLLECTIONS = {
    "applications": [],
    "resumes": [],
    "questions": [],
    "companies": [],
    "config": {
        "ai": {
            "base_url": "https://api.openai.com/v1",
            "api_key": "",
            "model": "gpt-4o-mini",
        }
    },
}


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def _ensure_init() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for name, default in _COLLECTIONS.items():
        p = _path(name)
        if not p.exists():
            p.write_text(
                json.dumps(default, ensure_ascii=False, indent=2), encoding="utf-8"
            )


def read_all(name: str):
    """读取整个集合，返回 list 或 dict。"""
    with _lock:
        _ensure_init()
        return json.loads(_path(name).read_text(encoding="utf-8"))


def write_all(name: str, data) -> None:
    """整体写回集合。"""
    with _lock:
        _ensure_init()
        _path(name).write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")

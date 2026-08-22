"""投递记录的匹配与进度同步规则（供批量导入和邮箱同步共用）。"""

from .. import storage

# 状态进度次序（rejected/declined 为终态，可从任意阶段到达）
STATUS_RANK = {"applied": 1, "written_test": 2, "interview": 3, "offer": 4, "rejected": 5, "declined": 5}
STATUS_LABEL = {
    "applied": "已投递", "written_test": "笔试/测评", "interview": "面试",
    "offer": "Offer", "rejected": "感谢信", "declined": "已放弃",
}


def find_match(items: list, company: str, position: str, apply_date: str):
    """找与记录匹配的同批次已有投递；两边都有日期且不同 -> 再次投递，不匹配。"""
    c, p = company.strip().lower(), position.strip().lower()
    if not c or not p:
        return None
    d_new = (apply_date or "").strip()
    for it in items:
        if (it.get("company", "").strip().lower() == c
                and it.get("position", "").strip().lower() == p):
            d_old = (it.get("apply_date") or "").strip()
            if d_old and d_new and d_old != d_new:
                continue
            return it
    return None


def sync_existing(exist: dict, item: dict, source: str = "进度同步") -> bool:
    """把最新进度同步到已有记录（状态只允许前进，允许进入终态）。返回是否有变化。"""
    changed = False
    new_st = item.get("status") or ""
    old_st = exist.get("status") or ""
    if (new_st in STATUS_RANK
            and STATUS_RANK.get(new_st, 0) > STATUS_RANK.get(old_st, 0)):
        exist.setdefault("events", []).append({
            "date": storage.now_str()[:10],
            "type": "其他",
            "note": f"{source}：{STATUS_LABEL.get(old_st, old_st or '未知')} → {STATUS_LABEL[new_st]}",
        })
        exist["status"] = new_st
        if item.get("note"):
            exist["note"] = item["note"]  # 状态变化时顺带刷新官网原文备注
        changed = True
    else:
        if not exist.get("note") and item.get("note"):
            exist["note"] = item["note"]
            changed = True
    if not exist.get("apply_date") and item.get("apply_date"):
        exist["apply_date"] = item["apply_date"]
        changed = True
    if changed:
        exist["updated_at"] = storage.now_str()
    return changed

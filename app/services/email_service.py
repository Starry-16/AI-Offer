"""邮箱进度同步：IMAP 拉取招聘通知邮件，AI 解析后同步投递状态。

配置存于 config.email：{enabled, host, port, user, password(授权码), since_days, last_run}
"""

import asyncio
import email
import email.utils
import imaplib
import json
import re
from datetime import datetime, timedelta
from email.header import decode_header

from .. import storage
from . import ai_service
from .app_sync import STATUS_LABEL, STATUS_RANK, sync_existing

# 常见邮箱 IMAP 预设（授权码在对应邮箱网页版设置中生成，不是登录密码）
EMAIL_PRESETS = {
    "qq": {"name": "QQ 邮箱", "host": "imap.qq.com", "port": 993,
           "help": "QQ 邮箱网页版 → 设置 → 账号 → 开启 IMAP/SMTP 服务，生成授权码"},
    "163": {"name": "网易 163", "host": "imap.163.com", "port": 993,
            "help": "163 邮箱网页版 → 设置 → POP3/SMTP/IMAP → 开启 IMAP，生成授权码"},
    "gmail": {"name": "Gmail", "host": "imap.gmail.com", "port": 993,
              "help": "需开启两步验证后创建「应用专用密码」"},
    "outlook": {"name": "Outlook", "host": "outlook.office365.com", "port": 993,
                "help": "使用登录密码或应用密码"},
}

_KEYWORDS = re.compile(
    r"校招|校园招聘|实习|招聘|测评|笔试|面试|offer|感谢信|录用|投递|简历|人才|流程|通知",
    re.I,
)


def _decode_header_str(s: str) -> str:
    if not s:
        return ""
    parts = []
    for text, charset in decode_header(s):
        if isinstance(text, bytes):
            parts.append(text.decode(charset or "utf-8", errors="ignore"))
        else:
            parts.append(text)
    return "".join(parts)


def _strip_html(html: str) -> str:
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text)


def _body_text(msg) -> str:
    texts = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype in ("text/plain", "text/html"):
                try:
                    payload = part.get_payload(decode=True) or b""
                    text = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                    texts.append(_strip_html(text) if ctype == "text/html" else text)
                except Exception:
                    continue
            if sum(len(t) for t in texts) > 3000:
                break
    else:
        try:
            payload = msg.get_payload(decode=True) or b""
            texts.append(payload.decode(msg.get_content_charset() or "utf-8", errors="ignore"))
        except Exception:
            pass
    return re.sub(r"\s+", " ", " ".join(texts)).strip()


def _fetch_recent(cfg: dict, since_days: int, limit: int = 60) -> list:
    """IMAP 拉取最近 N 天的邮件（主题+正文摘要），按招聘关键词预筛。阻塞操作，需放线程执行。"""
    conn = imaplib.IMAP4_SSL(cfg["host"], int(cfg.get("port") or 993))
    try:
        conn.login(cfg["user"], cfg["password"])
        conn.select("INBOX")
        since = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        _, data = conn.search(None, "SINCE", since)
        ids = data[0].split()[-limit:]
        mails = []
        for mid in reversed(ids):
            try:
                _, msgdata = conn.fetch(mid, "(RFC822)")
                msg = email.message_from_bytes(msgdata[0][1])
                subject = _decode_header_str(msg.get("Subject", ""))
                sender = _decode_header_str(msg.get("From", ""))
                body = _body_text(msg)[:600]
                if not _KEYWORDS.search(subject + " " + body):
                    continue
                date_str = ""
                try:
                    date_str = email.utils.parsedate_to_datetime(msg.get("Date")).strftime("%Y-%m-%d")
                except Exception:
                    pass
                mails.append({"subject": subject[:120], "from": sender[:80], "date": date_str, "snippet": body})
            except Exception:
                continue
        return mails
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def _match_application(items: list, company: str, position: str):
    """邮件解析结果 → 匹配已有投递：公司名互相包含；给了岗位再按岗位收窄。"""
    c = (company or "").strip().lower()
    if not c:
        return None
    cands = [it for it in items
             if it.get("company") and (c in it["company"].strip().lower() or it["company"].strip().lower() in c)]
    if not cands:
        return None
    p = (position or "").strip().lower()
    if p:
        for it in cands:
            ip = (it.get("position") or "").strip().lower()
            if ip and (p in ip or ip in p):
                return it
    # 同公司多岗位且邮件没提岗位时，不乱更新
    return cands[0] if len(cands) == 1 else None


_EVENT_TYPE = {"applied": "投递", "written_test": "笔试", "interview": "其他",
               "offer": "Offer", "rejected": "感谢信"}


def _has_company(items: list, company: str) -> bool:
    """台账里是否已有该公司的任何投递（公司名互相包含）。"""
    c = (company or "").strip().lower()
    return bool(c) and any(
        it.get("company") and (c in it["company"].strip().lower() or it["company"].strip().lower() in c)
        for it in items)


def _create_from_email(items: list, r: dict, mails: list):
    """邮件里出现、台账里完全没有的投递 → 自动收录为新记录并追加到 items。"""
    company = (r.get("company") or "").strip()
    if not company:
        return None
    status = r["status"]
    mail_date = ""
    try:
        mail_date = mails[int(r.get("i"))].get("date", "")
    except (TypeError, ValueError, IndexError):
        pass
    now = storage.now_str()
    item = {
        "id": storage.new_id(),
        "company": company,
        "position": (r.get("position") or "").strip() or "待确认",
        "category": "秋招",
        "location": "", "channel": "", "stage": "", "link": "",
        "status": status,
        # 只有投递确认邮件的日期约等于投递日期；后续阶段邮件留空，避免影响导入判重
        "apply_date": mail_date if status == "applied" else "",
        "note": (r.get("summary") or "")[:100],
        "events": [{
            "date": mail_date or now[:10],
            "type": _EVENT_TYPE.get(status, "其他"),
            "note": f"邮件同步自动收录：{STATUS_LABEL[status]}",
        }],
        "created_at": now,
        "updated_at": now,
    }
    items.append(item)
    return item


def _save_last_run(result: dict) -> None:
    cfg = storage.read_all("config")
    cfg.setdefault("email", {})["last_run"] = result
    storage.write_all("config", cfg)


async def sync_once() -> dict:
    """跑一轮邮箱同步（定时任务与手动触发共用）。"""
    cfg = storage.read_all("config").get("email", {})
    if not cfg.get("enabled"):
        return {"ok": False, "message": "邮箱同步未启用"}
    if not (cfg.get("host") and cfg.get("user") and cfg.get("password")):
        return {"ok": False, "message": "请先完整填写邮箱 IMAP 配置"}
    try:
        mails = await asyncio.to_thread(_fetch_recent, cfg, int(cfg.get("since_days") or 14))
    except imaplib.IMAP4.error as e:
        return {"ok": False, "message": f"邮箱登录失败：{e}（请检查账号和授权码）"}
    except Exception as e:
        return {"ok": False, "message": f"邮箱连接失败：{e}"}

    result = {"ok": True, "at": storage.now_str(), "scanned": len(mails),
              "relevant": 0, "updated": 0, "imported": 0, "details": []}
    if not mails:
        _save_last_run(result)
        return result

    items = storage.read_all("applications")
    companies = sorted({it.get("company", "") for it in items if it.get("company")})
    mails_desc = [{"i": i, **m} for i, m in enumerate(mails[:40])]
    prompt = (
        "下面是从候选人邮箱拉取的邮件列表，其中混有招聘流程通知和其他邮件。"
        "请挑出企业发来的秋招/实习流程通知，每封提取：\n"
        "- i：邮件序号（原样返回）\n"
        "- company：公司简称（尽量对齐到已有投递记录中的公司名）\n"
        "- position：岗位名（邮件没提则为空字符串）\n"
        "- status：流程状态，只能是 applied（投递确认/已收到简历）/ written_test（笔试或测评通知）/ "
        "interview（面试通知、邀约、安排）/ offer（录用意向、Offer）/ rejected（感谢信、未通过、流程终止）之一\n"
        "- summary：一句话说明（15 字内）\n"
        "只输出 JSON 数组；与招聘流程无关的邮件（验证码、广告、订阅推送等）不要输出。\n\n"
        f"【已有投递记录的公司】{'、'.join(companies) or '无'}\n\n"
        f"【邮件列表】\n{json.dumps(mails_desc, ensure_ascii=False)}"
    )
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.2)
    except ai_service.AIConfigError as e:
        return {"ok": False, "message": str(e)}

    m = re.search(r"\[[\s\S]*\]", reply)
    parsed = []
    if m:
        try:
            parsed = json.loads(m.group(0))
        except json.JSONDecodeError:
            parsed = []
    parsed = [r for r in parsed if isinstance(r, dict) and r.get("status") in STATUS_RANK]
    result["relevant"] = len(parsed)

    changed = False
    for r in parsed:
        company = (r.get("company") or "").strip()
        if not company:
            continue
        target = _match_application(items, company, r.get("position", ""))
        if target:
            if sync_existing(target, {"status": r["status"]}, source="邮件同步"):
                changed = True
                result["updated"] += 1
                result["details"].append(
                    f"{target.get('company')} · {target.get('position')}：{r.get('summary') or r['status']}")
        elif not _has_company(items, company):
            created = _create_from_email(items, r, mails)
            if created:
                changed = True
                result["imported"] += 1
                result["details"].append(
                    f"新收录 {created['company']} · {created['position']}：{r.get('summary') or STATUS_LABEL[r['status']]}")
        # 同公司有多个岗位、邮件又没指明岗位 → 跳过，避免乱收录
    if changed:
        storage.write_all("applications", items)

    _save_last_run(result)
    return result

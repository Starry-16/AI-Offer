"""邮箱进度同步：配置读写与手动触发。"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import storage
from ..services import email_service

router = APIRouter(prefix="/api/email", tags=["email"])


class EmailConfigIn(BaseModel):
    enabled: bool = False
    host: str = ""
    port: int = 993
    user: str = ""
    password: str = ""   # 授权码；留空表示不修改已保存的
    since_days: int = 14


@router.get("/config")
def get_email_config():
    cfg = storage.read_all("config").get("email", {})
    return {
        "enabled": bool(cfg.get("enabled")),
        "host": cfg.get("host", ""),
        "port": cfg.get("port", 993) or 993,
        "user": cfg.get("user", ""),
        "since_days": cfg.get("since_days", 14) or 14,
        "has_password": bool(cfg.get("password")),
        "last_run": cfg.get("last_run"),
        "presets": email_service.EMAIL_PRESETS,
    }


@router.put("/config")
def update_email_config(body: EmailConfigIn):
    cfg = storage.read_all("config")
    em = cfg.setdefault("email", {})
    em.update({
        "enabled": body.enabled,
        "host": body.host.strip(),
        "port": body.port or 993,
        "user": body.user.strip(),
        "since_days": body.since_days or 14,
    })
    if body.password.strip():
        em["password"] = body.password.strip()
    storage.write_all("config", cfg)
    return {"ok": True}


@router.post("/sync")
async def email_sync_now():
    r = await email_service.sync_once()
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=r.get("message", "同步失败"))
    return r

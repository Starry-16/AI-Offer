"""简历管理 API（含附件上传/下载）。"""

from typing import Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .. import storage

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

# 网申补充信息字段（key → 中文名）：随简历保存，插件自动填写时作为权威信息优先采用
PROFILE_FIELDS = {
    "gender": "性别",
    "birth": "出生年月",
    "ethnicity": "民族",
    "native_place": "籍贯（精确到市）",
    "current_city": "现居住地",
    "id_number": "身份证号",
    "college": "学院名称",
    "ranking": "成绩排名",
    "cultivation": "培养方式",
    "computer_skill": "计算机能力",
    "languages": "编程语言",
    "proficiency": "熟练度",
    "relative_in_company": "有无内部亲属关系",
    "self_eval": "自我评价",
    "height": "身高（厘米）",
    "weight": "体重（公斤）",
    "referral_source": "招聘信息来源",
    "english_cert": "英语四六级成绩",
    "lab_name": "实验室名称",
    "lab_level": "实验室级别",
    "advisor": "导师姓名",
    "wechat": "微信号",
    "qq": "QQ号",
    "work_department": "工作部门",
}

# 结构化实习/工作经历字段（key → 中文名）：resume.experiences 列表的元素键
EXPERIENCE_FIELDS = {
    "company": "公司名称",
    "position": "职位名称",
    "department": "所在部门",
    "work_type": "工作性质",
    "start": "开始时间",
    "end": "结束时间",
    "responsibility": "项目职责/主要工作",
    "description": "工作描述",
}

# 结构化项目经历字段（key → 中文名）：resume.projects 列表的元素键
PROJECT_FIELDS = {
    "name": "项目名称",
    "start": "开始时间",
    "end": "结束时间",
    "responsibility": "项目职责",
    "description": "项目描述",
}

# 附件存储目录与约束
ATTACH_DIR = storage.DATA_DIR / "attachments"
ATTACH_EXTS = {".pdf", ".doc", ".docx", ".md", ".txt"}
ATTACH_MAX = 10 * 1024 * 1024  # 10MB
# 证件照约束（插件自动填写时注入官网的照片上传框）
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_MAX = 5 * 1024 * 1024  # 5MB


def _attach_path(resume_id: str, suffix: str = ""):
    """按简历 id 定位附件文件；suffix 为空时返回已存在的附件路径或 None。"""
    if suffix:
        return ATTACH_DIR / f"{resume_id}{suffix}"
    for ext in ATTACH_EXTS:
        p = ATTACH_DIR / f"{resume_id}{ext}"
        if p.exists():
            return p
    return None


def _photo_path(resume_id: str, suffix: str = ""):
    """按简历 id 定位证件照文件；suffix 为空时返回已存在的照片路径或 None。"""
    if suffix:
        return ATTACH_DIR / f"{resume_id}_photo{suffix}"
    for ext in PHOTO_EXTS:
        p = ATTACH_DIR / f"{resume_id}_photo{ext}"
        if p.exists():
            return p
    return None


class ResumeIn(BaseModel):
    name: str = Field(min_length=1)
    target: str = ""
    content: str = ""
    note: str = ""
    tags: List[str] = []
    profile: Dict[str, str] = {}   # 网申补充信息，键见 PROFILE_FIELDS
    experiences: List[Dict[str, str]] = []  # 结构化实习/工作经历，键见 EXPERIENCE_FIELDS
    projects: List[Dict[str, str]] = []     # 结构化项目经历，键见 PROJECT_FIELDS


def _load() -> list:
    return storage.read_all("resumes")


def _save(items: list) -> None:
    storage.write_all("resumes", items)


@router.get("")
def list_resumes():
    items = _load()
    items.sort(key=lambda x: (x.get("updated_at") or ""), reverse=True)
    return items


@router.post("")
def create_resume(body: ResumeIn):
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


@router.put("/{resume_id}")
def update_resume(resume_id: str, body: ResumeIn):
    items = _load()
    for i, item in enumerate(items):
        if item["id"] == resume_id:
            items[i].update(body.model_dump())
            items[i]["updated_at"] = storage.now_str()
            _save(items)
            return items[i]
    raise HTTPException(status_code=404, detail="简历不存在")


@router.delete("/{resume_id}")
def delete_resume(resume_id: str):
    items = _load()
    remain = [x for x in items if x["id"] != resume_id]
    if len(remain) == len(items):
        raise HTTPException(status_code=404, detail="简历不存在")
    _save(remain)
    old = _attach_path(resume_id)
    if old:
        old.unlink(missing_ok=True)
    photo = _photo_path(resume_id)
    if photo:
        photo.unlink(missing_ok=True)
    return {"ok": True}


# ================= 简历附件 =================

@router.post("/{resume_id}/attachment")
async def upload_attachment(resume_id: str, file: UploadFile = File(...)):
    """上传简历附件（PDF/Word/Markdown/TXT，≤10MB），同窗会覆盖旧附件。"""
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if suffix not in ATTACH_EXTS:
        raise HTTPException(status_code=400, detail="仅支持 PDF / Word / Markdown / TXT 格式")
    data = await file.read()
    if len(data) > ATTACH_MAX:
        raise HTTPException(status_code=400, detail="文件不能超过 10MB")

    ATTACH_DIR.mkdir(parents=True, exist_ok=True)
    old = _attach_path(resume_id)
    if old:
        old.unlink(missing_ok=True)
    _attach_path(resume_id, suffix).write_bytes(data)

    resume["attachment"] = file.filename
    resume["updated_at"] = storage.now_str()
    _save(items)
    return {"ok": True, "attachment": file.filename}


@router.get("/{resume_id}/attachment")
def download_attachment(resume_id: str):
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    path = _attach_path(resume_id)
    if not resume or not path:
        raise HTTPException(status_code=404, detail="附件不存在")
    return FileResponse(path, filename=resume.get("attachment") or path.name)


@router.delete("/{resume_id}/attachment")
def delete_attachment(resume_id: str):
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    old = _attach_path(resume_id)
    if old:
        old.unlink(missing_ok=True)
    resume.pop("attachment", None)
    resume["updated_at"] = storage.now_str()
    _save(items)
    return {"ok": True}


# ================= 证件照 =================

@router.post("/{resume_id}/photo")
async def upload_photo(resume_id: str, file: UploadFile = File(...)):
    """上传证件照（JPG/PNG/WebP，≤5MB），同窗会覆盖旧照片。"""
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if suffix not in PHOTO_EXTS:
        raise HTTPException(status_code=400, detail="仅支持 JPG / PNG / WebP 格式")
    data = await file.read()
    if len(data) > PHOTO_MAX:
        raise HTTPException(status_code=400, detail="照片不能超过 5MB")

    ATTACH_DIR.mkdir(parents=True, exist_ok=True)
    old = _photo_path(resume_id)
    if old:
        old.unlink(missing_ok=True)
    _photo_path(resume_id, suffix).write_bytes(data)

    resume["photo"] = file.filename
    resume["updated_at"] = storage.now_str()
    _save(items)
    return {"ok": True, "photo": file.filename}


@router.get("/{resume_id}/photo")
def download_photo(resume_id: str):
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    path = _photo_path(resume_id)
    if not resume or not path:
        raise HTTPException(status_code=404, detail="证件照不存在")
    return FileResponse(path, filename=resume.get("photo") or path.name)


@router.delete("/{resume_id}/photo")
def delete_photo(resume_id: str):
    items = _load()
    resume = next((r for r in items if r.get("id") == resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    old = _photo_path(resume_id)
    if old:
        old.unlink(missing_ok=True)
    resume.pop("photo", None)
    resume["updated_at"] = storage.now_str()
    _save(items)
    return {"ok": True}

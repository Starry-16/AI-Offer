"""AI 智能助手 API：多轮对话、简历润色、模拟面试、题目解答与配置管理。"""

import json
import re
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import storage
from ..services import ai_service
from .resumes import EXPERIENCE_FIELDS, PROFILE_FIELDS, PROJECT_FIELDS

router = APIRouter(prefix="/api", tags=["ai"])


class ChatIn(BaseModel):
    messages: list = Field(min_length=1)
    model: str = ""  # 留空则用配置中的默认模型


class PolishIn(BaseModel):
    content: str
    target: str = ""


class MockInterviewIn(BaseModel):
    position: str = "后端开发工程师"
    category: str = "综合"
    count: int = Field(5, ge=1, le=15)


class EvaluateIn(BaseModel):
    question: str
    answer: str


class AnswerIn(BaseModel):
    question: str


class AIConfigIn(BaseModel):
    provider: str = ""  # 服务商 ID（预设或 custom）
    base_url: str = ""  # 仅 custom 时生效
    model: str = ""     # 仅 custom 时生效
    models: str = ""    # 仅 custom 时生效，英文逗号分隔多个模型
    api_key: str = ""  # 留空表示保留原 key


@router.post("/ai/chat")
async def ai_chat(body: ChatIn):
    try:
        reply = await ai_service.chat(body.messages, model=body.model)
    except ai_service.AIConfigError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"reply": reply}


@router.post("/ai/polish")
async def ai_polish(body: PolishIn):
    prompt = ai_service.build_prompts()["polish"].format(
        target=body.target or "未指定", content=body.content
    )
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.5)
    except ai_service.AIConfigError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"reply": reply}


@router.post("/ai/mock-interview")
async def ai_mock_interview(body: MockInterviewIn):
    prompt = ai_service.build_prompts()["mock_interview"].format(
        position=body.position, category=body.category, count=body.count
    )
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.8)
    except ai_service.AIConfigError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"reply": reply}


@router.post("/ai/evaluate")
async def ai_evaluate(body: EvaluateIn):
    prompt = ai_service.build_prompts()["evaluate_answer"].format(
        question=body.question, answer=body.answer
    )
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.5)
    except ai_service.AIConfigError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"reply": reply}


@router.post("/ai/answer")
async def ai_answer(body: AnswerIn):
    prompt = ai_service.build_prompts()["answer_question"].format(question=body.question)
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.5)
    except ai_service.AIConfigError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=str(e))
    return {"reply": reply}


# ================= 浏览器插件：官网表单自动填写 =================

class FillField(BaseModel):
    id: str
    kind: str = "text"           # text / textarea / select / radio / custom-select / date / month / number
    label: str = ""              # 字段名称（label / aria-label / 邻近文本）
    name: str = ""               # input name 属性
    placeholder: str = ""
    section: str = ""            # 所在区块标题（如 实习经历 / 教育经历）
    options: List[str] = []      # select / radio 的候选项


class FillFormIn(BaseModel):
    resume_id: str
    page_url: str = ""
    fields: List[FillField] = Field(min_length=1, max_length=120)


@router.post("/ai/fill-form")
async def ai_fill_form(body: FillFormIn):
    """根据简历内容，为网页表单字段生成 {字段id: 填写值} 映射（供浏览器插件使用）。

    字段分批调用 AI：慢模型（如 kimi-for-coding）一次性生成全量映射易超时，
    分批后单批约 1 分钟内完成；单批失败不影响其他批，全部失败才报错。
    """
    resumes = storage.read_all("resumes")
    resume = next((r for r in resumes if r.get("id") == body.resume_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    profile = resume.get("profile") or {}
    profile_text = "\n".join(
        f"{PROFILE_FIELDS.get(k, k)}：{v}" for k, v in profile.items() if v
    )
    experiences = [e for e in (resume.get("experiences") or []) if e.get("company") or e.get("position")]
    exp_lines = []
    for i, e in enumerate(experiences, 1):
        parts = [f"{EXPERIENCE_FIELDS[k]}：{e[k]}" for k in EXPERIENCE_FIELDS if e.get(k)]
        exp_lines.append(f"经历{i}：" + "；".join(parts))
    projects = [p for p in (resume.get("projects") or []) if p.get("name")]
    proj_lines = []
    for i, p in enumerate(projects, 1):
        parts = [f"{PROJECT_FIELDS[k]}：{p[k]}" for k in PROJECT_FIELDS if p.get(k)]
        proj_lines.append(f"项目{i}：" + "；".join(parts))
    prompt_head = (
        "你是招聘网站的表单填写助手。下面给出一份简历和网页表单字段列表，请为每个字段给出应填写的值。\n\n"
        "字段说明：label 是字段名称；section 是字段所在区块（如 实习经历 / 教育经历）；"
        "placeholder 和 name 是辅助线索。label 为空时，根据 section / placeholder / name 推断字段含义。\n\n"
        "要求：\n"
        "1. 只输出一个 JSON 对象：{\"字段id\": \"要填写的值\"}，不要输出任何其他文字或解释\n"
        "2. 值必须是纯文本；select / radio 字段的值必须从候选项中原样选择；"
        "custom-select 字段没有候选项，直接给出最合理的常规取值（如学历→硕士）\n"
        "3. kind=date 的字段格式为 YYYY-MM-DD，kind=month 的格式为 YYYY-MM\n"
        "4. 常见字段映射：实习单位/实习公司/工作单位/单位名称/所在公司/公司名称 → 实习或工作经历的公司名；"
        "实习岗位/职位名称/担任职务 → 对应经历的职位；所在部门/工作部门/实习部门 → 对应经历的所在部门（没有则参考【网申补充信息】工作部门）；"
        "开始时间/结束时间/起止时间 → 对应经历的时间段（在职/进行中的经历，结束时间输出「至今」）；"
        "工作性质/工作类型/用工性质 → 对应经历的工作性质（实习经历填入工作区块时填「实习」）；"
        "工作描述/实习描述/工作内容/岗位职责 → 对应经历的工作描述；"
        "项目名称 → 对应项目经历的名称；项目职责/项目角色/主要职责 → 对应项目的项目职责；"
        "项目描述/项目简介/项目内容 → 对应项目的项目描述；"
        "学校/院校/毕业院校 → 学校名称；专业、学历/学位、入学时间/毕业时间 → 教育经历对应内容；"
        "性别/出生年月/出生日期/民族/籍贯/出生地/现居住地/居住地/证件号码/身份证号/学院/院系/成绩排名/专业排名/"
        "培养方式/计算机能力/编程语言/熟练程度/自我评价/个人评价/是否有亲属在本公司工作/身高/体重/招聘信息来源/信息来源/如何得知/"
        "英语等级/四六级/CET/英语成绩 → 【网申补充信息】对应项；"
        "实验室名称/实验室级别/导师姓名/导师/微信号/微信/QQ号/QQ → 【网申补充信息】对应项；"
        "是否有实习经历/工作经验（radio）→ 有/是\n"
        "5. 同一区块出现多组同名字段（如多段实习经历）时，按【实习/工作经历】或【项目经历】中的先后顺序依次填写；"
        "不同组必须填不同的经历，禁止把同一段经历填进多个组；组的个数多于经历条数时，多余的组不要输出任何字段。"
        "页面同时有「实习经历」与「工作经历/工作经验」两个区块时，实习经历只填实习区块；"
        "即使实习区块的组数不够用，也绝不把实习填入工作区块；工作区块仅在存在全职/正式工作经历时填写，否则整组不输出。"
        "页面没有实习区块、只有「工作经历/工作经验」区块时，才把实习经历填入其中；"
        "此时每段实习各占一组（组数不够就只填前几段），开始时间/结束时间/工作性质等字段照常填写，工作性质填「实习」\n"
        "6. 简历中完全找不到依据、也无法合理推断的字段才允许不输出对应键\n"
        "7. 自我介绍 / 个人评价 / 职业规划类长文本字段，根据简历内容生成 150 字以内的精炼表述\n"
        "8. 求职意向 / 应聘岗位类字段参考简历的求职目标；工作性质/实习类型类字段，应届或实习经历填「实习」类选项\n"
        "9. 值不得与字段的 placeholder 或 label 相同（那是占位提示不是值）；"
        "label 含 时间/日期 的 custom-select 字段同样按 YYYY-MM-DD 或 YYYY-MM 输出日期\n"
        "10. 同一组经历里若只有一个描述类字段（如只有「工作描述」没有单独的「项目职责/主要工作」，或只有「项目描述」），"
        "把该经历的职责与描述合并填入这一个字段（职责在前、描述在后，用句号衔接）；职责和描述两个字段同时存在时才分别对应填写\n\n"
        f"【简历】\n求职目标：{resume.get('target') or '未填写'}\n"
        f"标签：{'、'.join(resume.get('tags') or [])}\n"
        f"内容：\n{(resume.get('content') or '')[:6000]}\n"
        f"备注：{(resume.get('note') or '')[:500]}\n\n"
    )
    if profile_text:
        prompt_head += (
            "【网申补充信息】（候选人本人确认的权威信息，相关字段以此为准，优先采用）\n"
            f"{profile_text}\n\n"
        )
    if exp_lines:
        prompt_head += (
            "【实习/工作经历】（候选人整理的结构化数据，工作/实习类区块以此为准，按顺序对应各组）\n"
            + "\n".join(exp_lines) + "\n\n"
        )
    if proj_lines:
        prompt_head += (
            "【项目经历】（候选人整理的结构化数据，项目类区块以此为准，按顺序对应各组）\n"
            + "\n".join(proj_lines) + "\n\n"
        )

    mapping = {}
    first_err = None
    for i in range(0, len(body.fields), 15):
        chunk = body.fields[i:i + 15]
        fields_desc = [
            {k: v for k, v in f.model_dump().items() if v not in ("", [])}
            for f in chunk
        ]
        try:
            reply = await ai_service.chat(
                [{"role": "user", "content": prompt_head + f"【表单字段】\n{json.dumps(fields_desc, ensure_ascii=False)}"}],
                temperature=0.3,
            )
        except ai_service.AIConfigError as e:
            first_err = first_err or e
            if "API Key" in str(e) or "接口地址" in str(e):
                break  # 配置类错误后续批次必然同样失败，直接终止
            continue  # 单批失败（如超时）：跳过该批，其余批次照常
        m = re.search(r"\{.*\}", reply, re.S)
        if not m:
            continue
        try:
            raw = json.loads(m.group(0))
        except json.JSONDecodeError:
            continue
        valid_ids = {f.id for f in chunk}
        mapping.update({k: str(v) for k, v in raw.items() if k in valid_ids and v not in (None, "")})

    if not mapping and first_err:
        raise HTTPException(status_code=400, detail=str(first_err))
    if not mapping:
        raise HTTPException(status_code=502, detail="AI 未返回有效映射，请重试")
    return {"mapping": mapping, "filled": len(mapping), "total": len(body.fields)}


class ExtractProfileIn(BaseModel):
    content: str = Field(min_length=1)


@router.post("/ai/extract-profile")
async def ai_extract_profile(body: ExtractProfileIn):
    """从简历文本中提取网申补充信息字段与实习/工作经历（供简历编辑页一键预填，需人工核对后保存）。"""
    keys_desc = "、".join(f"{k}（{v}）" for k, v in PROFILE_FIELDS.items())
    exp_keys = "、".join(f"{k}（{v}）" for k, v in EXPERIENCE_FIELDS.items())
    proj_keys = "、".join(f"{k}（{v}）" for k, v in PROJECT_FIELDS.items())
    prompt = (
        "从下面的简历文本中提取网申常见字段。只输出一个 JSON 对象，不要输出任何其他文字。\n"
        "输出格式：{\"profile\": {...}, \"experiences\": [...], \"projects\": [...]}\n"
        f"profile 可用的键：{keys_desc}\n"
        f"experiences 是实习/工作经历列表，每个元素的键：{exp_keys}；"
        "work_type 填 实习 或 全职\n"
        f"projects 是项目经历列表，每个元素的键：{proj_keys}\n"
        "所有 start/end 用 YYYY-MM 格式，在职/进行中的 end 填「至今」，均按时间倒序排列\n"
        "规则：birth 用 YYYY-MM 格式；ranking 保留原文写法（如 前10% / 5/120）；"
        "relative_in_company、id_number、height、weight 简历里一般没有，找不到就不要输出；"
        "self_eval 若简历没有自我评价，则根据简历内容生成 100 字以内的一段；"
        "其余找不到依据的键不要输出；没有实习/项目经历则对应列表输出空列表。\n\n"
        f"【简历】\n{body.content[:6000]}"
    )
    try:
        reply = await ai_service.chat([{"role": "user", "content": prompt}], temperature=0.2)
    except ai_service.AIConfigError as e:
        raise HTTPException(status_code=400, detail=str(e))
    m = re.search(r"\{.*\}", reply, re.S)
    profile, experiences, projects = {}, [], []
    if m:
        try:
            raw = json.loads(m.group(0))
            raw_profile = raw.get("profile") if isinstance(raw.get("profile"), dict) else raw
            profile = {k: str(v).strip() for k, v in raw_profile.items()
                       if k in PROFILE_FIELDS and str(v).strip()}
            for e in raw.get("experiences") or []:
                if not isinstance(e, dict):
                    continue
                exp = {k: str(e[k]).strip() for k in EXPERIENCE_FIELDS if e.get(k) and str(e[k]).strip()}
                if exp.get("company") or exp.get("position"):
                    experiences.append(exp)
            for p in raw.get("projects") or []:
                if not isinstance(p, dict):
                    continue
                proj = {k: str(p[k]).strip() for k in PROJECT_FIELDS if p.get(k) and str(p[k]).strip()}
                if proj.get("name"):
                    projects.append(proj)
        except (json.JSONDecodeError, AttributeError):
            profile, experiences, projects = {}, [], []
    if not profile and not experiences and not projects:
        raise HTTPException(status_code=502, detail="未能从简历中提取到字段，请重试")
    return {"profile": profile, "experiences": experiences, "projects": projects}


# 常用 AI 服务商预设（均为 OpenAI 兼容接口，用户只需填 API Key）
AI_PRESETS = {
    "deepseek": {
        "name": "DeepSeek 深度求索",
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "key_url": "https://platform.deepseek.com/api_keys",
        "note": "性价比高，推荐",
    },
    "moonshot": {
        "name": "Kimi 开放平台",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "kimi-k3",
        "models": ["kimi-k3", "kimi-k2.6", "kimi-k2.5"],
        "key_url": "https://platform.kimi.com/console/api-keys",
        "note": "长文本能力强",
    },
    "kimi_coding": {
        "name": "Kimi 编程版 Coding Plan",
        "base_url": "https://api.kimi.com/coding/v1",
        "model": "kimi-for-coding",
        "models": ["kimi-for-coding"],
        "key_url": "https://www.kimi.com/coding/",
        "user_agent": "KimiCLI/1.3",
        "temperature": 1,
        "note": "sk-kimi- 开头的 Key 选这个",
    },
    "zhipu": {
        "name": "智谱 GLM",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
        "models": ["glm-4-flash", "glm-4-plus"],
        "key_url": "https://open.bigmodel.cn/usercenter/apikeys",
        "note": "有免费额度",
    },
    "qwen": {
        "name": "阿里通义千问",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "models": ["qwen-plus", "qwen-turbo", "qwen-max"],
        "key_url": "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
        "note": "",
    },
    "siliconflow": {
        "name": "硅基流动 SiliconFlow",
        "base_url": "https://api.siliconflow.cn/v1",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "models": ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
        "key_url": "https://cloud.siliconflow.cn/account/ak",
        "note": "聚合平台，部分模型免费",
    },
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
        "models": ["gpt-4o-mini", "gpt-4o"],
        "key_url": "https://platform.openai.com/api-keys",
        "note": "需海外网络",
    },
    "custom": {
        "name": "自定义",
        "base_url": "",
        "model": "",
        "key_url": "",
        "note": "手动填写接口地址和模型",
    },
}


@router.get("/config")
def get_config():
    cfg = storage.read_all("config")
    ai = cfg.get("ai", {})
    key = (ai.get("api_key") or "").strip()
    provider = ai.get("provider", "custom")
    # 老数据没有 provider 字段，尝试根据 base_url 反推
    if provider == "custom":
        base = (ai.get("base_url") or "").rstrip("/")
        for pid, p in AI_PRESETS.items():
            if pid != "custom" and base and base == p["base_url"].rstrip("/"):
                provider = pid
                break
    models = ai.get("models") or ([ai["model"]] if ai.get("model") else [])
    return {
        "ai": {
            "provider": provider,
            "base_url": ai.get("base_url", ""),
            "model": ai.get("model", ""),
            "models": models,
            "api_key_set": bool(key),
            "api_key_hint": f"…{key[-4:]}" if len(key) >= 4 else "",
        },
        "presets": AI_PRESETS,
    }


@router.put("/config")
def update_config(body: AIConfigIn):
    cfg = storage.read_all("config")
    ai = cfg.setdefault("ai", {})
    provider = (body.provider or "").strip()
    if provider:
        ai.pop("temperature", None)
        if provider == "custom":
            ai["provider"] = "custom"
            ai["user_agent"] = ""
            if body.base_url:
                ai["base_url"] = body.base_url
            # 自定义支持逗号分隔的多模型列表
            if body.models:
                model_list = [m.strip() for m in body.models.split(",") if m.strip()]
                if model_list:
                    ai["models"] = model_list
                    ai["model"] = model_list[0]
            elif body.model:
                ai["model"] = body.model
                ai["models"] = [body.model]
        elif provider in AI_PRESETS:
            # 预设服务商：接口地址和模型列表自动填充，用户无需关心
            preset = AI_PRESETS[provider]
            ai["provider"] = provider
            ai["base_url"] = preset["base_url"]
            ai["model"] = preset["model"]
            ai["models"] = preset.get("models", [preset["model"]])
            ai["user_agent"] = preset.get("user_agent", "")
            if "temperature" in preset:
                ai["temperature"] = preset["temperature"]
    if body.api_key:
        ai["api_key"] = body.api_key
    storage.write_all("config", cfg)
    return {"ok": True}

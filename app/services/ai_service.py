"""调用 OpenAI 兼容接口的 AI 服务。"""

import asyncio

import httpx

from .. import storage


class AIConfigError(RuntimeError):
    """AI 未配置或调用失败。"""


def get_ai_config() -> dict:
    cfg = storage.read_all("config")
    return cfg.get("ai", {})


async def chat(messages: list[dict], temperature: float = 0.7, model: str = "") -> str:
    """发送多轮对话，返回助手回复文本。model 留空则用配置中的默认模型。"""
    cfg = get_ai_config()
    api_key = (cfg.get("api_key") or "").strip()
    if not api_key:
        raise AIConfigError("尚未配置 AI API Key，请先到「设置」页填写")
    base_url = (cfg.get("base_url") or "").strip().rstrip("/")
    if not base_url:
        raise AIConfigError("尚未配置 AI 接口地址")

    # 部分模型只允许固定 temperature（如 kimi-for-coding 只允许 1）
    temp_override = cfg.get("temperature")
    if temp_override is not None and temp_override != "":
        temperature = float(temp_override)
    payload = {
        "model": model.strip() or cfg.get("model") or "gpt-4o-mini",
        "messages": messages,
        "temperature": temperature,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    # 部分接口（如 Kimi 编程版）要求特定的 User-Agent 标识
    user_agent = (cfg.get("user_agent") or "").strip()
    if user_agent:
        headers["User-Agent"] = user_agent
    last_err = None
    for attempt in range(2):  # 网络抖动 / 超时自动重试一次
        try:
            async with httpx.AsyncClient(timeout=240) as client:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            raise AIConfigError(f"AI 接口返回错误（{e.response.status_code}）：{e.response.text[:300]}")
        except (httpx.HTTPError, KeyError, IndexError) as e:
            last_err = e
            if attempt == 0:
                await asyncio.sleep(2)
    detail = str(last_err) or type(last_err).__name__  # httpx 超时异常 str 为空，用类名兜底
    raise AIConfigError(f"AI 调用失败：{detail}（已自动重试一次）")


def build_prompts():
    """集中管理各类提示词，便于调整。"""
    return {
        "polish": (
            "你是一位资深 HR 和职业规划师。请帮我润色以下简历内容，"
            "使其表达更专业、更有冲击力，突出与目标岗位的匹配度。"
            "要求：保留事实不虚构，使用量化表达，结构清晰，直接输出润色后的简历文本，不要解释。\n"
            "目标岗位：{target}\n\n简历内容：\n{content}"
        ),
        "mock_interview": (
            "你是秋招面试官，正在面试「{position}」岗位的候选人。"
            "请出 {count} 道面试题，要求覆盖 {category} 方向，"
            "难度循序渐进，从基础到进阶，每题一行编号列出，"
            "在题目末尾用括号注明考察点。只输出题目列表，不要其他内容。"
        ),
        "evaluate_answer": (
            "你是一位面试官，请点评候选人下面这道题的回答。"
            "给出：1）回答质量评价（好/中/差）；2）遗漏或错误的关键点；3）一个更完善的参考回答要点。\n"
            "题目：{question}\n\n候选人回答：\n{answer}"
        ),
        "answer_question": (
            "你是一位秋招导师，请解答下面的面试题。"
            "要求：先给出简洁的结论，再分点展开原理，最后补充面试时的加分表达。\n"
            "题目：{question}"
        ),
    }

"""
gemini_service.py
Implementa la misma interfaz que deepseek_service.py usando la capa
gratuita de Gemini (gemini-1.5-flash o gemini-2.0-flash) como fallback
cuando DeepSeek se queda sin tokens.
"""
import os
import json
import logging
from typing import AsyncGenerator

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool as GeminiTool
from app.services.tool_executor import execute_tool, TOOLS

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
MAX_TOOL_ROUNDS = 5

# ── Configurar SDK ──────────────────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)


def _is_configured() -> bool:
    return bool(GEMINI_API_KEY)


# ── Convertir herramientas OpenAI → Gemini ──────────────────────────────
def _openai_tools_to_gemini(openai_tools: list) -> list[GeminiTool]:
    """
    Convierte el formato de tools de OpenAI (usado por DeepSeek y la app)
    al formato de FunctionDeclaration de Gemini.
    """
    declarations = []
    for tool in openai_tools:
        if tool.get("type") != "function":
            continue
        fn = tool["function"]
        params = fn.get("parameters", {})
        declarations.append(
            FunctionDeclaration(
                name=fn["name"],
                description=fn.get("description", ""),
                parameters=params,
            )
        )
    return [GeminiTool(function_declarations=declarations)] if declarations else []


# ── Convertir historial OpenAI → Gemini ────────────────────────────────
def _openai_messages_to_gemini(messages: list) -> tuple[str, list]:
    """
    Separa el system prompt del historial y convierte los mensajes al
    formato de Gemini (role: user/model, parts: [...]).
    Retorna (system_instruction, gemini_history).
    """
    system_parts = []
    history = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content") or ""

        if role == "system":
            system_parts.append(content)
            continue

        if role == "assistant":
            gemini_role = "model"
            # Si el mensaje tiene tool_calls, los convertimos a function_call parts
            tool_calls = msg.get("tool_calls", [])
            if tool_calls:
                parts = []
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    try:
                        args = json.loads(fn.get("arguments", "{}"))
                    except Exception:
                        args = {}
                    parts.append({"function_call": {"name": fn["name"], "args": args}})
                history.append({"role": gemini_role, "parts": parts})
                continue
        elif role == "tool":
            # Respuesta de herramienta → function_response
            tool_call_id = msg.get("tool_call_id", "")
            try:
                result = json.loads(content) if content else {}
            except Exception:
                result = {"result": content}
            history.append({
                "role": "user",
                "parts": [{"function_response": {"name": tool_call_id, "response": result}}]
            })
            continue
        else:
            gemini_role = "user"

        if content:
            history.append({"role": gemini_role, "parts": [{"text": content}]})

    system_instruction = "\n".join(system_parts) if system_parts else None
    return system_instruction, history


# ── chat_with_tools (equivalente al de DeepSeek) ───────────────────────
async def chat_with_tools(messages: list) -> dict:
    """
    Misma interfaz que deepseek_service.chat_with_tools.
    Usa Gemini con function calling.
    """
    if not _is_configured():
        raise RuntimeError("GEMINI_API_KEY no configurada")

    system_instruction, history = _openai_messages_to_gemini(messages)
    gemini_tools = _openai_tools_to_gemini(TOOLS)

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_instruction,
        tools=gemini_tools,
    )

    chat = model.start_chat(history=history[:-1] if history else [])
    last_user_text = ""
    if history:
        last = history[-1]
        if last.get("role") == "user":
            parts = last.get("parts", [])
            if parts and isinstance(parts[0], dict) and "text" in parts[0]:
                last_user_text = parts[0]["text"]

    rounds = 0
    current_response = await chat.send_message_async(last_user_text or " ")

    while rounds < MAX_TOOL_ROUNDS:
        rounds += 1
        # Revisar si hay function calls
        fn_calls = []
        for part in current_response.parts:
            if hasattr(part, "function_call") and part.function_call.name:
                fn_calls.append(part.function_call)

        if not fn_calls:
            # Respuesta final de texto
            text = current_response.text
            return {"response": text, "usage": None, "provider": "gemini"}

        # Ejecutar tools y devolver resultados
        tool_responses = []
        for fc in fn_calls:
            try:
                args = dict(fc.args)
            except Exception:
                args = {}
            try:
                output = await execute_tool(fc.name, args)
            except Exception as e:
                output = {"error": str(e)}

            result = output if isinstance(output, dict) else {"result": str(output)}
            tool_responses.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fc.name,
                        response={"result": json.dumps(result)},
                    )
                )
            )

        current_response = await chat.send_message_async(tool_responses)

    # Si se agotaron los rounds, pedir resumen
    current_response = await chat.send_message_async("Resume lo que encontraste.")
    return {"response": current_response.text, "usage": None, "provider": "gemini"}


# ── stream_chat_with_tools (equivalente al de DeepSeek) ────────────────
async def stream_chat_with_tools(messages: list) -> AsyncGenerator[str, None]:
    """
    Misma interfaz que deepseek_service.stream_chat_with_tools.
    Gemini streaming con function calling.
    """
    if not _is_configured():
        yield f"data: {json.dumps({'content': '⚠️ Gemini no configurado (falta GEMINI_API_KEY).'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        result = await chat_with_tools(messages)
        # Gemini streaming real es complejo con function calling, así que
        # emitimos el resultado completo en un solo chunk para simplificar
        text = result.get("response", "")
        chunk_size = 80
        for i in range(0, len(text), chunk_size):
            yield f"data: {json.dumps({'content': text[i:i+chunk_size]})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"[Gemini] stream error: {e}")
        yield f"data: {json.dumps({'content': f'❌ Error en Gemini: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"

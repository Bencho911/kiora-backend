import os
import json
import logging
from openai import AsyncOpenAI
from app.services.tool_executor import execute_tool, TOOLS

logger = logging.getLogger(__name__)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MAX_TOOL_ROUNDS = 5

# Errores de DeepSeek que indican cuota agotada o API caída → activar fallback Gemini
_QUOTA_ERRORS = ("insufficient balance", "insufficient_balance", "quota_exceeded", "rate_limit", "429", "402", "connection error")

def _is_quota_error(e: Exception) -> bool:
    """Devuelve True si el error es por créditos/cuota agotada en DeepSeek."""
    msg = str(e).lower()
    return any(k in msg for k in _QUOTA_ERRORS) or getattr(e, 'status_code', None) == 429

client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com/v1"
)

async def chat_with_tools(messages: list) -> dict:
    current_messages = list(messages)
    rounds = 0

    while rounds < MAX_TOOL_ROUNDS:
        rounds += 1
        
        try:
            response = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=current_messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=4096,
                stream=False
            )
        except Exception as e:
            if _is_quota_error(e):
                logger.warning(f"[DeepSeek] Cuota agotada, usando Gemini como fallback. Error: {e}")
                from app.services.gemini_service import chat_with_tools as gemini_chat
                return await gemini_chat(messages)
            logger.error(f"[DeepSeek] API Error: {e}")
            raise

        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            # No tools called, return final response
            usage = response.usage
            return {
                "response": msg.content or "",
                "usage": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                } if usage else None
            }

        # Add assistant message with tool calls to history
        assistant_msg = {"role": "assistant"}
        if msg.content:
            assistant_msg["content"] = msg.content
        
        # Format tool calls for history
        tool_calls_formatted = []
        for tc in msg.tool_calls:
            tool_calls_formatted.append({
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments
                }
            })
        assistant_msg["tool_calls"] = tool_calls_formatted
        current_messages.append(assistant_msg)

        # Execute tools
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except:
                args = {}
                
            try:
                output = await execute_tool(tc.function.name, args)
            except Exception as e:
                output = {"error": str(e)}
            
            content_str = output if isinstance(output, str) else json.dumps(output)
            current_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": content_str
            })

    # If it exceeds rounds, force conclusion
    current_messages.append({"role": "user", "content": "Resume lo que encontraste."})
    final_response = await client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=current_messages,
        max_tokens=4096,
        stream=False
    )
    
    choice = final_response.choices[0]
    usage = final_response.usage
    return {
        "response": choice.message.content or "",
        "usage": {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens
        } if usage else None
    }


async def stream_chat_with_tools(messages: list):
    current_messages = list(messages)
    rounds = 0

    while rounds < MAX_TOOL_ROUNDS:
        rounds += 1
        
        try:
            response_stream = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=current_messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=4096,
                stream=True
            )
        except Exception as e:
            if _is_quota_error(e):
                logger.warning(f"[DeepSeek] Cuota agotada en streaming, usando Gemini. Error: {e}")
                from app.services.gemini_service import stream_chat_with_tools as gemini_stream
                async for chunk in gemini_stream(messages):
                    yield chunk
                return
            logger.error(f"[DeepSeek] Streaming error: {e}")
            yield f"data: {json.dumps({'content': f'❌ Error de DeepSeek: {str(e)}'})}\
\n"
            yield "data: [DONE]\n\n"
            return
        
        tool_calls_accumulator = {}
        content_yielded = False
        full_content = ""
        
        async for chunk in response_stream:
            delta = chunk.choices[0].delta
            
            if delta.content:
                content_yielded = True
                full_content += delta.content
                # Emit chunk as Server-Sent Event
                yield f"data: {json.dumps({'content': delta.content})}\n\n"
                
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_accumulator:
                        tool_calls_accumulator[idx] = {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name or "", "arguments": tc.function.arguments or ""}
                        }
                    else:
                        if tc.function.name:
                            tool_calls_accumulator[idx]["function"]["name"] += tc.function.name
                        if tc.function.arguments:
                            tool_calls_accumulator[idx]["function"]["arguments"] += tc.function.arguments

        if not tool_calls_accumulator:
            break
            
        tool_calls = list(tool_calls_accumulator.values())
        assistant_msg = {"role": "assistant", "tool_calls": tool_calls}
        if content_yielded:
            assistant_msg["content"] = full_content
            
        current_messages.append(assistant_msg)
        
        for tc in tool_calls:
            try:
                args = json.loads(tc["function"]["arguments"] or "{}")
            except Exception:
                args = {}
                
            try:
                output = await execute_tool(tc["function"]["name"], args)
            except Exception as e:
                output = {"error": str(e)}
            
            content_str = output if isinstance(output, str) else json.dumps(output)
            current_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": content_str
            })

    yield "data: [DONE]\n\n"

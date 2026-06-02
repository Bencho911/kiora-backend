const DEEPSEEK_BASE = 'https://api.deepseek.com';
const MAX_TOOL_ROUNDS = 5;

/**
 * Llama a la API de DeepSeek con manejo de tool calling.
 * @param {Array<{role:string,content:string}>} messages
 * @param {Array} tools
 * @returns {Promise<{content:string,toolCalls:Array|null}>}
 */
async function callDeepSeek(messages, tools) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada');

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const body = {
    model,
    messages,
    stream: false,
    max_tokens: 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('DeepSeek: respuesta vacía');

  return {
    content: choice.message?.content || '',
    toolCalls: choice.message?.tool_calls || null,
    finishReason: choice.finish_reason,
    usage: data.usage || null,
  };
}

/**
 * Ciclo completo: envia mensajes a DeepSeek, ejecuta tools si las pide,
 * y retorna la respuesta final.
 * @param {Array<{role:string,content:string}>} messages
 * @param {Array} tools
 * @param {Function} toolExecutor - async (name, args) => resultado
 * @returns {Promise<{response:string,usage:object|null}>}
 */
async function chatWithTools(messages, tools, toolExecutor) {
  let currentMessages = [...messages];
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const result = await callDeepSeek(currentMessages, tools);

    if (!result.toolCalls) {
      return { response: result.content, usage: result.usage };
    }

    // Ejecutar cada tool call
    const toolResults = [];
    for (const tc of result.toolCalls) {
      const args = JSON.parse(tc.function.arguments || '{}');
      let output;
      try {
        output = await toolExecutor(tc.function.name, args);
      } catch (err) {
        output = { error: err.message };
      }
      toolResults.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: typeof output === 'string' ? output : JSON.stringify(output),
      });
    }

    currentMessages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    });
    currentMessages.push(...toolResults);
  }

  // Si despues de MAX_TOOL_ROUNDS no hay respuesta final, pedir conclusion
  const final = await callDeepSeek(
    [...currentMessages, { role: 'user', content: 'Resume lo que encontraste.' }],
    [] // sin tools
  );

  return { response: final.content, usage: final.usage };
}

module.exports = { callDeepSeek, chatWithTools };

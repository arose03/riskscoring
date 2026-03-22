import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

export interface LLMResponse {
  content: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<LLMResponse> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from LLM');
  }

  return {
    content: content.text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

export async function callLLMJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<T> {
  const response = await callLLM(systemPrompt, userMessage, maxTokens);

  // Extract JSON from the response - handle markdown code blocks
  let jsonText = response.content.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // Try to find JSON object in the response
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]) as T;
    }
    const arrMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      return JSON.parse(arrMatch[0]) as T;
    }
    throw new Error(`Failed to parse LLM response as JSON: ${jsonText.substring(0, 200)}`);
  }
}

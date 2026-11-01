import { AI_TIMEOUT_MS } from '@quorum/shared';

/**
 * Prompt structure for AI completion
 */
export interface AIPrompt {
  system: string;
  user: string;
}

/**
 * Options for AI completion
 */
export interface AICompletionOptions {
  timeoutMs?: number;
}

/**
 * AI Provider interface - abstraction over different AI services
 */
export interface AIProvider {
  /**
   * Complete a prompt and return the response text
   * @throws Error if request fails or times out
   */
  complete(prompt: AIPrompt, options?: AICompletionOptions): Promise<string>;
}

/**
 * Timeout error class
 */
export class AITimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AITimeoutError';
  }
}

/**
 * Generic HTTP AI provider (works with OpenAI-compatible APIs)
 * Supports: OpenAI, Anthropic (with format conversion), or any compatible endpoint
 */
export class HTTPAIProvider implements AIProvider {
  private apiKey: string;
  private endpoint: string;
  private model: string;

  constructor(apiKey: string, endpoint: string, model: string) {
    if (!apiKey) {
      throw new Error('AI_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.model = model;
  }

  async complete(prompt: AIPrompt, options?: AICompletionOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? AI_TIMEOUT_MS;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      
      // Extract content from OpenAI-format response
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      return content.trim();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AITimeoutError(`AI request timed out after ${timeoutMs}ms`);
      }

      throw error;
    }
  }
}

/**
 * Create AI provider from environment variables
 * Returns null if AI is not configured
 */
export function createAIProvider(): AIProvider | null {
  const apiKey = process.env.AI_API_KEY;
  const endpoint = process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo';

  if (!apiKey) {
    console.warn('AI_API_KEY not configured - AI features will be unavailable');
    return null;
  }

  return new HTTPAIProvider(apiKey, endpoint, model);
}

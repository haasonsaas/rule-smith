import OpenAI from 'openai';

export interface OpenAIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const openaiClient = {
  async generateCompletion(config: OpenAIConfig, messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
    const completion = await openai.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: messages
    });

    return completion.choices[0].message?.content || '';
  }
}; 
export interface OpenAIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export const openaiClient: {
  generateCompletion: (config: OpenAIConfig, messages: Array<{ role: string; content: string }>) => Promise<string>;
}; 
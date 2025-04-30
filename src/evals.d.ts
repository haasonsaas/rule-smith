import { openaiClient, OpenAIConfig } from './client';

export interface EvalResult {
  score: number;
  explanation: string;
  passed: boolean;
}

export interface EvalCriteria {
  name: string;
  description: string;
  minScore: number;
}

export interface EvalContext {
  input: string;
  output: string;
  metadata?: Record<string, string | number | boolean>;
}

export class EvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalError';
  }
}

export const evals = {
  async evaluateCursorRule(
    config: OpenAIConfig,
    context: EvalContext,
    criteria: EvalCriteria = {
      name: 'cursor-rule-quality',
      description: 'Evaluate the quality and usefulness of a Cursor rule',
      minScore: 0.7
    }
  ): Promise<EvalResult> {
    const prompt = `
You are an expert evaluator of Cursor rules. Your task is to evaluate whether the rule effectively helps developers understand and work with the codebase.

Pull Request Context:
${context.input}

Cursor Rule to evaluate:
${context.output}

Please evaluate based on the following criteria:
1. Relevance: Does the rule accurately reflect the changes and patterns from the PR?
2. Actionability: Does the rule provide clear, specific guidance that developers can follow?
3. Scope: Are the glob patterns appropriate for where this rule should apply?
4. Documentation: Does the rule explain both what to do and why it matters?
5. Technical Accuracy: Are the technical details and requirements correctly captured?

Provide a score from 0 to 1, where:
- 1.0: Exceptional rule that perfectly captures the PR's intent and provides clear guidance
- 0.8: Good rule with clear guidance and appropriate scope
- 0.6: Adequate rule that needs minor improvements
- 0.4: Rule needs significant improvements in clarity or scope
- 0.2: Rule misses key information or provides unclear guidance
- 0.0: Rule is incorrect or potentially harmful

Also provide a brief explanation of your evaluation, highlighting what works well and what could be improved.
`;

    const response = await openaiClient.generateCompletion(config, [
      { role: 'system', content: 'You are an expert evaluator of Cursor rules. You MUST respond in this exact format:\n- First line: A single number between 0 and 1 representing the score\n- Second line: Blank\n- Third line onwards: Your explanation' },
      { role: 'user', content: prompt }
    ]);

    try {
      const [scoreStr, explanation] = response.split('\n\n');
      const score = parseFloat(scoreStr);
      
      if (isNaN(score) || score < 0 || score > 1) {
        throw new EvalError('Invalid score format in evaluation response');
      }

      return {
        score,
        explanation: explanation.trim(),
        passed: score >= criteria.minScore
      };
    } catch (error) {
      throw new EvalError('Failed to parse evaluation response');
    }
  }
}; 
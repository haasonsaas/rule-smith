import { describe, expect, test } from 'bun:test';
import { evals } from './evals.d';
import { OpenAIConfig } from './client.d';

describe('Cursor Rule Evaluations', () => {
  const config: OpenAIConfig = {
    model: 'gpt-4o',
    temperature: 0,
    maxTokens: 500
  };

  test('evaluates cursor rule quality', async () => {
    const ruleInput = `
# Pull Request Context
Title: Add error handling to API endpoints
Description: This PR implements proper error handling across all API endpoints. We're adding standardized error handling patterns to ensure consistent error reporting and logging across the API layer.
Changed files: 
- src/api/users.ts
- src/api/orders.ts
- src/middleware/error-handler.ts
Commit messages: 
- feat: add error handling middleware
- feat: implement error handling in user endpoints
- feat: add error handling to order endpoints
- docs: update API error handling documentation`;

    const ruleOutput = `---
title: API Error Handling Standards
description: Implement consistent error handling patterns across API endpoints
globs:
  - src/api/**/*.ts
  - src/middleware/**/*.ts
alwaysApply: true
---

# API Error Handling Standards

When implementing API endpoints, follow these error handling practices:

## Core Requirements
- Use the centralized error handling middleware
- Implement try/catch blocks for async operations
- Categorize errors appropriately (validation, auth, business logic, etc.)

## Error Response Format
\`\`\`typescript
interface ApiError {
  code: string;        // Machine-readable error code
  message: string;     // User-friendly error message
  details?: unknown;   // Additional error context
  traceId?: string;   // For error tracking
}
\`\`\`

## Logging Guidelines
- Log errors with appropriate severity levels
- Include relevant request context
- Mask sensitive data before logging
- Use structured logging format

## Examples
\`\`\`typescript
try {
  const user = await userService.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  // ... handle success
} catch (error) {
  if (error instanceof NotFoundError) {
    logger.warn({ error, userId: id }, 'User lookup failed');
    throw error;
  }
  logger.error({ error }, 'Unexpected error in user lookup');
  throw new InternalServerError('Failed to retrieve user');
}
\`\`\``;

    const result = await evals.evaluateCursorRule(config, {
      input: ruleInput,
      output: ruleOutput
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });
}); 
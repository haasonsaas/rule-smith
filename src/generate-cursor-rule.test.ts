import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { RuleSmith } from './generate-cursor-rule';

mock.module('@octokit/rest', () => ({}));
mock.module('openai', () => ({}));

describe('RuleSmith', () => {
  let ruleSmith: RuleSmith;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.OPENAI_API_KEY = 'test-key';
    ruleSmith = new RuleSmith('owner', 'repo', 123);
  });

  test('should generate rule content from PR info', async () => {
    const mockPRInfo = {
      title: 'Add new feature',
      body: 'This PR adds a new feature to the project',
      changedFiles: ['src/feature.ts', 'test/feature.test.ts'],
      commitMessages: ['feat: add new feature', 'test: add tests for new feature'],
    };

    const mockRuleContent = {
      title: 'New Feature',
      description: 'A new feature has been added to the project',
      files: ['src/feature.ts', 'test/feature.test.ts'],
      globs: ['src/**/*.ts', 'test/**/*.ts'],
      alwaysApply: false
    };

    // Mock the OpenAI response
    const mockOpenAI = {
      chat: {
        completions: {
          create: mock(() => Promise.resolve({
            choices: [{
              message: {
                content: `description: ${mockRuleContent.description}
globs:
  - ${mockRuleContent.globs[0]}
  - ${mockRuleContent.globs[1]}
alwaysApply: false
title: ${mockRuleContent.title}
files:
  - ${mockRuleContent.files[0]}
  - ${mockRuleContent.files[1]}`,
              },
            }],
          })),
        },
      },
    };

    // @ts-ignore
    ruleSmith.openai = mockOpenAI;

    const result = await ruleSmith.generateRuleContent(mockPRInfo);
    expect(result).toEqual(mockRuleContent);
  });

  test('should create a rule file with correct content', async () => {
    const mockRuleContent = {
      title: 'New Feature',
      description: 'A new feature has been added to the project',
      files: ['src/feature.ts', 'test/feature.test.ts'],
      globs: ['src/**/*.ts', 'test/**/*.ts'],
      alwaysApply: false
    };

    const result = await ruleSmith.createRuleFile(mockRuleContent);
    expect(result).toContain('.cursor/rules/new-feature.mdc');
  });
}); 
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse, stringify } from 'yaml';

config();

interface PRInfo {
  title: string;
  body: string;
  changedFiles: string[];
  commitMessages: string[];
}

interface RuleContent {
  title: string;
  description: string;
  globs: string[];
  alwaysApply: boolean;
  files: string[];
}

class RuleSmith {
  private octokit: Octokit;
  private openai: OpenAI;
  private owner: string;
  private repo: string;
  private prNumber: number;

  constructor(owner: string, repo: string, prNumber: number) {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
  }

  async getPRInfo(): Promise<PRInfo> {
    const pr = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.prNumber,
    });

    const commits = await this.octokit.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.prNumber,
    });

    const files = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.prNumber,
    });

    return {
      title: pr.data.title,
      body: pr.data.body || '',
      changedFiles: files.data.map(file => file.filename),
      commitMessages: commits.data.map(commit => commit.commit.message),
    };
  }

  async generateRuleContent(prInfo: PRInfo): Promise<RuleContent> {
    const prompt = `# Cursor Rule Generation Task

## Pull Request Context
- Title: ${prInfo.title}
- Description: ${prInfo.body}
- Changed Files: ${prInfo.changedFiles.join(', ')}
- Commit Messages: ${prInfo.commitMessages.join(', ')}

## Your Task
Analyze the PR information above and create a Cursor rule that would help developers understand the changes.

## Output Format Requirements
Return YAML with these exact fields:
- title: A clear, concise title (3-8 words) that describes what the rule explains
- description: A single sentence (15-30 words) explaining the rule's purpose
- globs: Array of glob patterns targeting relevant files (only add if truly needed)
- alwaysApply: Boolean (set to true only if rule applies to all developers regardless of context)
- files: Array of 1-5 most important files that developers should review

## Guidelines for Creating Effective Rules
- Focus on explaining WHY changes were made, not just WHAT was changed
- Keep the title action-oriented when possible (e.g., "How to Use X" rather than "X Documentation")
- Include only the most important files, prioritizing those with core logic
- For glob patterns, be specific enough to target relevant files but not too broad
- If the PR involves a new feature, explain how to use it
- If the PR fixes a bug, explain how to avoid similar issues

## Response Format
Return only valid YAML without code blocks or extra text:

title: "Your Rule Title Here"
description: "Your rule description here."
globs:
  - "pattern/one/**/*"
  - "pattern/two/**/*.ts"
alwaysApply: false
files:
  - "path/to/important/file.ts"
  - "path/to/another/file.ts"`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('Failed to generate rule content');

    // Strip YAML code block markers if present
    const cleanContent = content.replace(/^```yaml\n|\n```$/g, '').trim();

    try {
      return parse(cleanContent) as RuleContent;
    } catch (error: unknown) {
      console.error('Failed to parse YAML content:', cleanContent);
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createRuleFile(ruleContent: RuleContent): Promise<string> {
    const ruleName = ruleContent.title.toLowerCase().replace(/\s+/g, '-');
    const rulePath = join('.cursor', 'rules', `${ruleName}.mdc`);
    
    // Create frontmatter with only the specified fields
    const frontMatter = {
      description: ruleContent.description,
      globs: ruleContent.globs,
      alwaysApply: ruleContent.alwaysApply
    };
    
    const ruleContentString = `---\n${stringify(frontMatter)}---

# ${ruleContent.title}

${ruleContent.description}

${ruleContent.files.map(f => `- [${f}](mdc:${f})`).join('\n')}
`;

    await mkdir(join('.cursor', 'rules'), { recursive: true });
    await writeFile(rulePath, ruleContentString);

    return rulePath;
  }

  async run(): Promise<string> {
    const prInfo = await this.getPRInfo();
    const ruleContent = await this.generateRuleContent(prInfo);
    return this.createRuleFile(ruleContent);
  }
}

export { RuleSmith };

// Main execution
if (import.meta.main) {
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const prNumber = parseInt(process.env.GITHUB_PR_NUMBER || '');

  if (!owner || !repo || !prNumber) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const ruleSmith = new RuleSmith(owner, repo, prNumber);
  ruleSmith.run()
    .then(rulePath => console.log(`Created rule at: ${rulePath}`))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
} 
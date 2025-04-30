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
  files: string[];
  globs: string[];
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
    const prompt = `Based on the following PR information, generate a Cursor rule:
Title: ${prInfo.title}
Description: ${prInfo.body}
Changed Files: ${prInfo.changedFiles.join(', ')}
Commit Messages: ${prInfo.commitMessages.join(', ')}

Please provide a YAML object with these fields:
title: string
description: string
files: string[]
globs: string[]

The YAML must be properly formatted with each field on a new line and arrays properly indented. Example:
title: "Example Rule"
description: "This is an example rule"
files:
  - "src/file1.ts"
  - "src/file2.ts"
globs:
  - "src/**/*.ts"
  - "test/**/*.ts"`;

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
    
    const frontMatter = {
      title: ruleContent.title,
      description: ruleContent.description,
      files: ruleContent.files.map(f => `mdc:${f}`),
      globs: ruleContent.globs
    };
    
    const ruleContentString = `---\n${stringify(frontMatter)}---

${ruleContent.description}

## Files
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
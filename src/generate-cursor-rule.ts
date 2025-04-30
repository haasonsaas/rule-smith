import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import Ajv from 'ajv';

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
  globs?: string[];
  alwaysApply: boolean;
  files: string[];
}

const ruleSchema = {
  type: 'object',
  required: ['title', 'description', 'files', 'alwaysApply'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 50 },
    description: { type: 'string', minLength: 15, maxLength: 100 },
    globs: { type: 'array', items: { type: 'string' }, nullable: true },
    alwaysApply: { type: 'boolean' },
    files: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 }
  }
} as const;

class RuleSmith {
  private octokit: Octokit;
  private openai: OpenAI;
  private owner: string;
  private repo: string;
  private prNumber: number;
  private validator: ReturnType<typeof Ajv.prototype.compile>;

  constructor(owner: string, repo: string, prNumber: number) {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
    const ajv = new Ajv();
    this.validator = ajv.compile(ruleSchema);
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

  private async generateRuleWithRetry(prInfo: PRInfo, retries = 3, delay = 1000): Promise<RuleContent> {
    const systemMsg = `You are Cursor-RuleBot, an expert technical writer.
Return **only** valid YAML that conforms to the schema below—no markdown fences, no explanations.

Schema:
title:        string  # 3-8 words
description:  string  # 15-30 words
globs:        string[]|null  # omit or empty if unnecessary
alwaysApply:  boolean # default false
files:        string[]       # 1-5 paths

If YAML is invalid or missing keys, you MUST reply with the text "INVALID".`;

    const userMsg = `### PULL REQUEST CONTEXT – do not copy
TITLE: ${prInfo.title}
BODY: ${prInfo.body}
CHANGED_FILES: ${prInfo.changedFiles.join('; ')}
COMMITS: ${prInfo.commitMessages.join('; ')}

### TASK
1. Analyse the PR context.
2. Produce a useful Cursor rule that explains *why* the change matters.
3. Follow the schema exactly.
4. Do not wrap the YAML in \`\`\` fences.

### OUTPUT EXAMPLE
title: "Update build cache"
description: "Describes caching strategy added to speed up CI builds across pull requests."
globs:
  - ".github/workflows/**/*"
alwaysApply: false
files:
  - ".github/workflows/ci.yml"`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          temperature: 0,
          messages: [
            { role: "system", content: systemMsg.trim() },
            { role: "user", content: userMsg.trim() }
          ],
        });

        const raw = completion.choices[0].message?.content?.trim() ?? "";
        if (raw === "INVALID" || !raw) {
          throw new Error("LLM returned invalid YAML");
        }

        const parsed = parse(raw) as RuleContent;
        
        if (!this.validator(parsed)) {
          console.error('Validation errors:', this.validator.errors);
          throw new Error('Generated content failed schema validation');
        }

        return parsed;
      } catch (error) {
        if (attempt === retries) throw error;
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw new Error('Failed to generate valid rule content after all retries');
  }

  async generateRuleContent(prInfo: PRInfo): Promise<RuleContent> {
    return this.generateRuleWithRetry(prInfo);
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
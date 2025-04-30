# Rule-Smith

A lightweight, repo-native agent that writes [Cursor](https://cursor.sh) rules automatically for your project. Rule-Smith analyzes merged pull requests and generates documentation rules that help developers understand your codebase's patterns and practices.

## How It Works

When a pull request is merged, Rule-Smith:
1. Analyzes the PR content, including title, description, and changed files
2. Uses AI to understand the significance of the changes
3. Generates a Cursor rule (`.mdc` file) that documents the changes
4. Creates a new PR with the generated rule

For example, if you merge a PR that adds error handling to API endpoints, Rule-Smith might generate a rule like:

```yaml
# .cursor/rules/implement-error-handling.mdc
---
description: "Ensure all API endpoints implement proper error handling and logging"
globs:
  - "src/api/**/*.ts"
alwaysApply: true
---

# Implement Error Handling

All API endpoints should:
- Use try/catch blocks for async operations
- Log errors with appropriate severity levels
- Return standardized error responses
```

## Features

- 🤖 **Automated Documentation**: Generates Cursor rules automatically when PRs are merged
- 🔍 **Smart Analysis**: Uses AI to understand PR context and generate meaningful rules
- 📁 **Well-Formatted Rules**: Creates `.mdc` files with appropriate glob patterns
- 🔄 **GitHub Integration**: Seamlessly integrates with GitHub Actions
- 🛠️ **Manual Mode**: Supports both automated and manual rule generation

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- GitHub repository with Actions enabled
- OpenAI API key

### Installation

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/yourusername/rule-smith.git
   cd rule-smith
   bun install
   ```

2. Create a `.env` file:
   ```bash
   GITHUB_TOKEN=your_github_token
   OPENAI_API_KEY=your_openai_api_key
   ```

3. Configure GitHub repository secrets:
   - `GITHUB_TOKEN` (automatically provided by GitHub Actions)
   - `OPENAI_API_KEY` (your OpenAI API key)
   - `PERSONAL_ACCESS_TOKEN` (GitHub token with repo scope, for creating PRs)

### GitHub Actions Setup

The workflow is automatically configured. When you merge a PR to main:
1. Rule-Smith analyzes the changes
2. Generates appropriate Cursor rules
3. Creates a new PR with the generated documentation

## Usage

### Automated Usage

Simply merge your PRs to main! Rule-Smith will automatically:
1. Analyze the changes
2. Generate appropriate rules
3. Create a new PR with the documentation

### Manual Usage

Generate rules for specific PRs:

```bash
GITHUB_REPOSITORY_OWNER=owner \
GITHUB_REPOSITORY=repo \
GITHUB_PR_NUMBER=123 \
bun run start
```

## Development

```bash
# Build the project
bun run build

# Run tests
bun test

# Lint code
bun run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT 

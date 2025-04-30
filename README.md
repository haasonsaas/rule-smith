# Rule-Smith

A lightweight, repo-native agent that writes Cursor rules automatically for your project. Rule-Smith generates documentation for new features by analyzing merged pull requests and creating appropriate Cursor rules.

## Features

- Automatically generates Cursor rules when PRs are merged
- Analyzes PR title, description, changed files, and commit messages
- Creates well-formatted `.mdc` files with appropriate glob patterns
- Integrates seamlessly with GitHub Actions
- Supports both manual and automated rule generation
- Testing

## Setup

1. Install Bun (if you haven't already):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file with the following variables:
   ```
   GITHUB_TOKEN=your_github_token
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Add the following secrets to your GitHub repository:
   - `GITHUB_TOKEN` (automatically provided by GitHub Actions)
   - `OPENAI_API_KEY` (your OpenAI API key)

## Usage

### Automated Usage

Rule-Smith automatically runs when a PR is merged to the main branch. It will:
1. Analyze the PR content
2. Generate a Cursor rule
3. Create a new PR with the generated rule

### Manual Usage

You can also run Rule-Smith manually:

```bash
GITHUB_REPOSITORY_OWNER=owner \
GITHUB_REPOSITORY=repo \
GITHUB_PR_NUMBER=123 \
bun run start
```

## Development

- Build the project: `bun run build`
- Run tests: `bun test`
- Lint the code: `bun run lint`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 

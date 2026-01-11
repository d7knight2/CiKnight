# Contributing to CiKnight

Thank you for your interest in contributing to CiKnight! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment (Node.js version, OS, etc.)
- Relevant logs or error messages

### Suggesting Features

For feature requests, please create an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered
- Examples of how it would be used

### Contributing Code

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/CiKnight.git
   cd CiKnight
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   npm install
   
   # Copy environment variables
   cp .env.example .env
   # Edit .env with your GitHub App credentials
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

4. **Make Your Changes**
   - Write clear, maintainable code
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation as needed

5. **Build and Test Your Changes**
   ```bash
   # Build the project (must succeed)
   npm run build
   
   # Run linter (must pass with 0 errors)
   npm run lint
   
   # Automatically fix linting issues
   npm run lint:fix
   
   # Check formatting
   npm run format:check
   
   # Format code
   npm run format
   
   # Run all tests (must pass)
   npm test
   
   # Run the development server
   npm run dev
   ```
   
   **All checks must pass before submitting a PR:**
   - Build completes without errors
   - Linter returns 0 errors (warnings should be addressed)
   - All tests pass
   - Code is properly formatted

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Follow conventional commit format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

7. **Push and Create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then create a pull request on GitHub with:
   - A clear title and description
   - Reference to any related issues
   - Screenshots (if applicable)
   - Notes about testing performed

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- **No `any` types allowed** - use proper TypeScript types
- Follow the ESLint and Prettier configurations
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Add explicit return types for all public functions
- Use proper error handling with type guards (avoid `error: any`)

### Project Structure

```
src/
├── index.ts           # Express server entry point
├── webhook.ts         # Webhook handler and event routing
├── github/            # GitHub API integrations
│   ├── client.ts      # GitHub client factory
│   ├── pull-request.ts # PR event handlers
│   └── check-run.ts   # CI check handlers
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Adding New Features

When adding a new feature:

1. **Plan the Implementation**
   - Consider how it fits with existing code
   - Think about error handling and edge cases
   - Plan for configuration if needed

2. **Update Type Definitions**
   - Add types to `src/types/index.ts` if needed
   - Ensure type safety throughout

3. **Implement Event Handlers**
   - Add new handlers in the appropriate file
   - Subscribe to events in `src/webhook.ts`
   - Handle errors gracefully

4. **Update Documentation**
   - Update README.md if needed
   - Add comments explaining complex logic
   - Update SETUP.md for configuration changes

### Handling GitHub Events

Example of adding a new event handler:

```typescript
// In src/webhook.ts
webhooks.on('issue_comment.created', async ({ payload }) => {
  console.log(`💬 Comment on issue #${payload.issue.number}`);
  await handleIssueComment(payload);
});

// In src/github/issue-comment.ts
export async function handleIssueComment(payload: any) {
  const { owner, repo, installationId } = getRepoInfo(payload);
  const octokit = createGitHubClient(installationId);
  
  // Your implementation here
}
```

### Error Handling

Always handle errors appropriately with proper type guards:

```typescript
try {
  // Your code
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('❌ Error description:', errorMessage);
  // Don't throw - log and continue
}
```

### Logging

Use consistent logging:
- `console.log('✅ Success message')`
- `console.log('🔍 Processing...')`
- `console.error('❌ Error message')`
- `console.log('💬 Comment posted')`
- `console.log('⚠️  Warning message')`

## Testing

### Manual Testing

1. **Set Up a Test Repository**
   - Create a test repository on GitHub
   - Install your GitHub App on it
   - Create test pull requests

2. **Test Webhook Events**
   - Use smee.io for local testing
   - Create PRs and check for responses
   - Verify logs show correct processing

3. **Test Edge Cases**
   - PRs with merge conflicts
   - PRs with failing checks
   - Multiple simultaneous events

### Docker Testing

Test the Docker build (required for Dockerfile changes):

```bash
# Build the image
docker build -t ciknight:test .

# Run locally (port 8080)
docker run -p 8080:8080 \
  -e GITHUB_APP_ID=your_id \
  -e GITHUB_PRIVATE_KEY="your_key" \
  -e GITHUB_WEBHOOK_SECRET=your_secret \
  ciknight:test

# Test the health endpoint
curl http://localhost:8080/health
```

## Code Review Process

All contributions go through code review:

1. Maintainers will review your code
2. Address any feedback or questions
3. Make requested changes
4. Once approved, your PR will be merged

What reviewers look for:
- Code quality and style
- Proper error handling
- Security considerations
- Documentation updates
- Test coverage (when applicable)

## Security

If you discover a security issue:
- **Do not** create a public issue
- Email the maintainers directly
- Include details about the vulnerability
- Allow time for a fix before disclosure

## Environment Setup Tips

### Using Smee.io for Local Webhook Testing

```bash
# Install globally
npm install -g smee-client

# Create a channel at https://smee.io/
# Then run:
smee --url https://smee.io/YOUR_CHANNEL --path /webhook --port 8080
```

### Debugging

Add debug logging:
```typescript
console.log('🐛 Debug:', JSON.stringify(payload, null, 2));
```

Use VS Code debugger:
1. Set breakpoints in your code
2. Press F5 to start debugging
3. Trigger webhook events

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Questions?

If you have questions:
- Check existing issues and discussions
- Create a new issue with the "question" label
- Join our community discussions

Thank you for contributing to CiKnight! 🛡️

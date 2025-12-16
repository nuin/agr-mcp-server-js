# Contributing to Enhanced AGR MCP Server

🎉 Thank you for your interest in contributing to the Enhanced AGR MCP Server (JavaScript Implementation)! 

This document provides guidelines for contributing to this project. By participating in this project, you agree to abide by our code of conduct and contribute under the MIT License.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git
- Basic understanding of:
  - JavaScript ES modules
  - Async/await patterns
  - Model Context Protocol (MCP)
  - Genomics/bioinformatics concepts (helpful but not required)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/agr-mcp-server-js.git
   cd agr-mcp-server-js
   ```

2. **Run the setup script**
   ```bash
   ./setup.sh
   ```

3. **Verify everything works**
   ```bash
   make validate
   npm run demo
   ```

4. **Start development**
   ```bash
   make dev
   ```

## 📋 How to Contribute

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug Reports** - Help us identify and fix issues
- ✨ **Feature Requests** - Suggest new functionality
- 🔧 **Code Contributions** - Implement features or fix bugs
- 📚 **Documentation** - Improve docs, add examples
- 🧪 **Testing** - Add test cases, improve coverage
- 🎨 **UI/UX** - Improve user experience
- 🔒 **Security** - Report vulnerabilities, improve security

### Contribution Process

1. **Check existing issues** - Search for existing issues or discussions
2. **Create an issue** - For bugs or feature requests
3. **Fork the repository** - Create your own copy
4. **Create a feature branch** - Use descriptive branch names
5. **Make your changes** - Follow our coding standards
6. **Test thoroughly** - Ensure all tests pass
7. **Submit a pull request** - With clear description

## 🔧 Development Guidelines

### Branch Naming

Use descriptive branch names following this pattern:
- `feature/add-new-tool` - New features
- `fix/cache-memory-leak` - Bug fixes
- `docs/update-readme` - Documentation updates
- `test/integration-tests` - Testing improvements
- `refactor/client-structure` - Code refactoring
- `perf/optimize-caching` - Performance improvements

### Coding Standards

#### JavaScript Style
- **ES Modules** - Use import/export syntax
- **Async/await** - Prefer over Promises and callbacks
- **JSDoc comments** - Document all public APIs
- **Error handling** - Comprehensive try/catch blocks
- **Logging** - Use structured logging with pino

#### Code Quality
- **ESLint** - Must pass without errors
- **Prettier** - Code must be formatted
- **Tests** - Maintain >80% coverage
- **Performance** - Consider caching and optimization

#### Example Code Structure
```javascript
/**
 * Enhanced function with proper documentation
 * @param {string} geneId - Valid gene identifier
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function searchGenes(geneId, options = {}) {
  try {
    // Validate input
    if (!this.validateGeneId(geneId)) {
      throw new Error(`Invalid gene ID: ${geneId}`);
    }
    
    // Log operation
    logger.debug({ geneId, options }, 'Searching genes');
    
    // Perform operation with caching
    const result = await this.makeRequest('/search', {
      params: { q: geneId, ...options }
    });
    
    return result;
  } catch (error) {
    logger.error({ geneId, error: error.message }, 'Gene search failed');
    throw error;
  }
}
```

### Testing Requirements

#### Test Types
- **Unit Tests** - Test individual functions
- **Integration Tests** - Test API interactions
- **Performance Tests** - Benchmark critical paths
- **Error Handling Tests** - Test edge cases

#### Test Structure
```javascript
describe('Enhanced AGR Client', () => {
  let client;
  
  beforeEach(() => {
    client = new EnhancedAGRClient();
  });

  describe('searchGenes', () => {
    it('should validate gene IDs correctly', async () => {
      await expect(client.searchGenes('INVALID')).rejects.toThrow('Invalid gene ID');
    });
    
    it('should handle successful searches', async () => {
      const result = await client.searchGenes('HGNC:1100');
      expect(result).toHaveProperty('results');
    });
  });
});
```

#### Running Tests
```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run specific test file
npm test -- searchGenes.test.js

# Run in watch mode
npm test -- --watch
```

### Performance Guidelines

#### Caching Strategy
- Cache GET requests by default
- Use appropriate TTL for different data types
- Implement cache invalidation when needed
- Monitor cache hit/miss ratios

#### Error Handling
- Use exponential backoff for retries
- Implement circuit breakers for failing services
- Provide meaningful error messages
- Log errors with context

#### Resource Management
- Monitor memory usage
- Implement proper cleanup
- Use connection pooling
- Avoid memory leaks

## 📝 Documentation Standards

### JSDoc Documentation
All public APIs must include comprehensive JSDoc comments:

```javascript
/**
 * Search for genes with enhanced filtering and validation
 * 
 * @param {string} query - Search term (gene symbol, name, or ID)
 * @param {Object} options - Search configuration
 * @param {number} [options.limit=20] - Maximum results (1-100)
 * @param {number} [options.offset=0] - Results to skip (≥0)
 * @param {string} [options.species] - Species filter
 * @returns {Promise<Object>} Search results with metadata
 * @throws {Error} When query validation fails
 * 
 * @example
 * const results = await client.searchGenes('BRCA1', { limit: 10 });
 * console.log(`Found ${results.total} genes`);
 */
```

### README Updates
When adding new features:
1. Update the main README.md
2. Add usage examples
3. Update the feature list
4. Include performance implications

### API Documentation
- Document all new tools in the MCP interface
- Provide input/output schemas
- Include practical examples
- Note any breaking changes

## 🧪 Testing Contributions

### Writing Tests

#### Test Categories
1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test interactions with external APIs
3. **Performance Tests** - Benchmark response times and throughput
4. **Error Tests** - Verify proper error handling

#### Test Naming
Use descriptive test names that explain what is being tested:
```javascript
describe('Gene ID Validation', () => {
  it('should accept valid HGNC identifiers', () => {
    expect(validateGeneId('HGNC:1100')).toBe(true);
  });
  
  it('should reject malformed identifiers', () => {
    expect(validateGeneId('invalid')).toBe(false);
  });
  
  it('should handle null and undefined inputs gracefully', () => {
    expect(validateGeneId(null)).toBe(false);
    expect(validateGeneId(undefined)).toBe(false);
  });
});
```

#### Mock Strategy
- Mock external APIs in unit tests
- Use real APIs in integration tests (with rate limiting)
- Provide mock data factories for consistent testing

### Test Coverage Requirements
- **Minimum**: 80% overall coverage
- **Functions**: 90% coverage for critical paths
- **Branches**: 75% coverage for error handling
- **Lines**: 85% coverage for new code

## 🐛 Bug Reports

### Before Reporting
1. **Search existing issues** - Check if already reported
2. **Reproduce the bug** - Ensure it's reproducible
3. **Check recent commits** - Might already be fixed
4. **Test with latest version** - Use most recent release

### Bug Report Template
```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- Node.js version: 
- npm version: 
- OS: 
- Server version: 

## Additional Context
- Error messages
- Log files
- Screenshots (if applicable)
- Related issues

## Minimal Reproduction
Provide minimal code that reproduces the issue.
```

## ✨ Feature Requests

### Feature Request Template
```markdown
## Feature Description
Clear description of the proposed feature.

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Implementation
How should this feature work?

## Alternatives Considered
What alternatives have you considered?

## Additional Context
Any other relevant information.
```

### Feature Development Process
1. **Discuss in issue** - Get community feedback
2. **Design review** - Consider architecture impact
3. **Implementation** - Follow coding standards
4. **Testing** - Comprehensive test coverage
5. **Documentation** - Update all relevant docs
6. **Performance review** - Ensure no regression

## 🔒 Security

### Reporting Security Issues
**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email security concerns to: [security@example.com]
2. Include detailed description
3. Provide steps to reproduce
4. Allow time for fix before disclosure

### Security Guidelines
- **Input validation** - Sanitize all user inputs
- **Error handling** - Don't leak sensitive information
- **Dependencies** - Keep all dependencies updated
- **Secrets** - Never commit secrets or API keys

## 📚 Documentation Contributions

### Types of Documentation
- **API Documentation** - JSDoc and README
- **User Guides** - How-to documentation
- **Examples** - Practical usage examples
- **Architecture** - System design documentation

### Documentation Standards
- **Clear language** - Write for your audience
- **Code examples** - Include working examples
- **Keep updated** - Maintain with code changes
- **Test examples** - Ensure examples work

## 🎯 Pull Request Process

### Before Submitting
1. **Rebase on main** - Ensure clean history
2. **Run all tests** - `make validate`
3. **Update documentation** - Reflect your changes
4. **Self-review** - Check your own code first

### Pull Request Template
```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that causes existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented (particularly hard-to-understand areas)
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or properly documented)

## Screenshots (if applicable)

## Additional Notes
```

### Review Process
1. **Automated checks** - CI must pass
2. **Code review** - At least one approving review
3. **Manual testing** - For significant changes
4. **Documentation review** - Ensure docs are updated

## 🏆 Recognition

### Contributors
We recognize contributors in multiple ways:
- **Contributors list** - In README.md
- **Release notes** - Credit for significant contributions
- **GitHub achievements** - Through commits and reviews

### Becoming a Maintainer
Active contributors may be invited to become maintainers:
- **Consistent contributions** - Regular, quality contributions
- **Code reviews** - Help review others' work
- **Community involvement** - Help with issues and discussions
- **Domain expertise** - Deep understanding of the codebase

## 📞 Getting Help

### Communication Channels
- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Code Reviews** - For implementation feedback

### Development Support
- **Documentation** - Check README and docs/
- **Examples** - See examples/ directory
- **Tests** - Look at test/ for usage patterns
- **Demo** - Run `npm run demo` for examples

## 📋 Code of Conduct

### Our Standards
- **Be respectful** - Treat everyone with respect
- **Be inclusive** - Welcome people of all backgrounds
- **Be constructive** - Provide helpful feedback
- **Be patient** - Remember we're all learning

### Unacceptable Behavior
- **Harassment** - Of any kind
- **Discrimination** - Based on any characteristic
- **Spam** - Irrelevant or excessive posting
- **Trolling** - Deliberately provocative behavior

### Enforcement
Project maintainers have the right to:
- Remove comments, commits, code, issues, and other contributions
- Ban temporarily or permanently any contributor
- Report behavior to appropriate authorities

## 🎉 Thank You!

Your contributions help make this project better for everyone in the genomics and bioinformatics community. Whether you're fixing a typo, adding a feature, or improving performance, every contribution matters!

Happy coding! 🚀
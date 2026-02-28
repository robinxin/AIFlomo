# Tests

This directory contains all test files for the AIFlomo application.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/api/health.test.ts
```

## Test Structure

```
tests/
├── api/           # API route handler tests
│   └── health.test.ts
└── README.md      # This file
```

## Testing Framework

- **Framework**: Vitest
- **Environment**: Node.js
- **Pattern**: `tests/**/*.test.ts`

## Writing Tests

### Test File Naming

- Use `.test.ts` suffix for test files
- Mirror the structure of the code being tested
- Example: `app/api/health/route.ts` → `tests/api/health.test.ts`

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  describe('Happy Path', () => {
    it('should handle the primary use case', () => {
      // Test implementation
    });
  });

  describe('Error Cases', () => {
    it('should handle errors gracefully', () => {
      // Test implementation
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases', () => {
      // Test implementation
    });
  });
});
```

### Coverage Requirements

- Lines: 60%
- Functions: 60%
- Branches: 40%
- Statements: 60%

## Test Categories

### 1. API Tests (`tests/api/`)

Test Next.js API route handlers directly by importing and calling them.

**Example:**
```typescript
import { GET } from '../../app/api/health/route';

it('should return 200', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
});
```

### 2. Future Test Categories

- `tests/lib/` - Service layer tests
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end tests (if added later)

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Use Descriptive Names**: Test names should clearly describe what they verify
3. **Follow AAA Pattern**: Arrange, Act, Assert
4. **Keep Tests Independent**: Each test should be able to run in isolation
5. **Cover Spec Requirements**: Ensure all requirements from specs are tested
6. **Test Edge Cases**: Don't just test the happy path

## API Testing Patterns

### Testing Route Handlers

```typescript
import { GET, POST } from '../../app/api/example/route';

// GET requests
const response = await GET();

// POST requests with body
const request = new Request('http://localhost:3000/api/example', {
  method: 'POST',
  body: JSON.stringify({ data: 'value' }),
});
const response = await POST(request);
```

### Testing Response Structure

```typescript
it('should return correct structure', async () => {
  const response = await GET();
  const data = await response.json();

  expect(data).toHaveProperty('status');
  expect(data).toHaveProperty('timestamp');
});
```

### Testing Performance

```typescript
it('should respond quickly', async () => {
  const start = performance.now();
  await GET();
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(200);
});
```

## Spec Compliance

Each test file should verify compliance with its corresponding spec in `specs/`:

- ✅ All API endpoints defined in the spec
- ✅ All response formats match the spec
- ✅ All error cases are handled
- ✅ All edge cases are covered
- ✅ Performance requirements are met

## Troubleshooting

### Tests Not Found

Make sure test files:
- Are in the `tests/` directory
- Have the `.test.ts` extension
- Match the pattern in `vitest.config.ts`

### Import Errors

If you see import errors:
1. Run `npm run db:generate` to generate Prisma client
2. Check TypeScript paths in `tsconfig.json`
3. Verify all dependencies are installed

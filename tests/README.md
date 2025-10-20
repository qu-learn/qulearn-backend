# Integration Tests for Qu-Learn Backend

This directory contains comprehensive integration tests for the Qu-Learn backend API.

## Setup

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

The following test-related dependencies will be installed:
- **jest**: Test framework
- **ts-jest**: TypeScript support for Jest
- **supertest**: HTTP assertion library for API testing
- **mongodb-memory-server**: In-memory MongoDB for isolated testing
- **@types/jest**: TypeScript types for Jest
- **@types/supertest**: TypeScript types for Supertest

### 2. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Setup Files

- **`tests/setup/globalSetup.mts`**: Starts MongoDB Memory Server before all tests
- **`tests/setup/globalTeardown.mts`**: Stops MongoDB Memory Server after all tests
- **`tests/setup/testSetup.mts`**: Clears database between each test for isolation

### Helper Files

- **`tests/helpers/authHelpers.mts`**: Authentication utilities
  - `createStudent()`: Creates a student user
  - `createEducator()`: Creates an educator user
  - `createCourseAdmin()`: Creates a course administrator
  - `createSysAdmin()`: Creates a system administrator
  - `generateToken(userId)`: Generates JWT token for a user
  - `createStudentWithToken()`: Creates student + JWT in one call
  - `createEducatorWithToken()`: Creates educator + JWT in one call

### Test Files

- **`tests/integration/coursesRouter.test.mts`**: Tests for the courses router
  - GET / - List published courses
  - GET /:courseId - Get course by ID
  - POST / - Create course (EducatorOnly)
  - PATCH /:courseId - Update course (EducatorOnly)
  - PUT /:courseId/gamification - Update gamification settings (EducatorOnly)
  - POST /:courseId/lessons/:lessonId/quiz/submit - Submit quiz (AuthenticatedOnly)

## Test Coverage

The integration tests cover:

### Happy Paths
- ✅ Successful course creation with valid educator authentication
- ✅ Course creation from Jupyter notebooks using conversion engine
- ✅ Listing published courses (sorted by title)
- ✅ Retrieving course details by ID
- ✅ Updating course information
- ✅ Updating gamification settings
- ✅ Quiz submission with correct answers
- ✅ Quiz submission with partial credit
- ✅ Automatic lesson completion on quiz pass (≥60%)

### Error Handling
- ✅ 401 Unauthorized when no authentication token provided
- ✅ 403 Forbidden when wrong role tries to access endpoint
- ✅ 404 Not Found when course/lesson doesn't exist
- ✅ 404 Not Found when educator tries to modify course they don't own
- ✅ 400 Bad Request when Jupyter notebook conversion fails

### Middleware Testing
- ✅ `EducatorOnly` middleware blocks non-educators
- ✅ `AuthenticatedOnly` middleware allows all authenticated users
- ✅ Proper JWT token validation

### External Mocks
- ✅ `runConversionEngine` is mocked to avoid external fetch calls
- ✅ Mock returns predictable module structure for testing

## Key Features

### Database Isolation
- Each test runs against a fresh, in-memory MongoDB instance
- No need for external database setup
- All collections are cleared between tests
- Tests can run in parallel without conflicts

### Real Authentication
- Uses real JWT tokens (not mocked)
- Passport middleware is not mocked
- Tests real authentication flow
- Helper functions simplify token generation

### Comprehensive Coverage
- Tests all endpoints in coursesRouter
- Validates response structure and data
- Tests authorization rules
- Validates database state after operations

## Writing New Tests

### Example: Testing an Authenticated Endpoint

```typescript
import { createEducatorWithToken } from '../helpers/authHelpers.mts';
import request from 'supertest';
import { app } from './testApp.mts'; // Your Express app

it('should do something when authenticated', async () => {
  const { educator, token } = await createEducatorWithToken();

  const response = await request(app)
    .post('/api/v1/some-endpoint')
    .set('Authorization', `Bearer ${token}`)
    .send({ data: 'test' })
    .expect(200);

  expect(response.body).toHaveProperty('success');
});
```

### Example: Testing Authorization

```typescript
it('should return 403 when student tries educator-only endpoint', async () => {
  const { student, token } = await createStudentWithToken();

  const response = await request(app)
    .post('/api/v1/educator-only-endpoint')
    .set('Authorization', `Bearer ${token}`)
    .send({ data: 'test' })
    .expect(403);

  expect(response.body.error).toBe('Forbidden');
});
```

## Troubleshooting

### Tests Hang or Timeout
- MongoDB Memory Server may need to download binaries on first run
- Increase Jest timeout in individual tests if needed:
  ```typescript
  it('slow test', async () => {
    // ...
  }, 30000); // 30 second timeout
  ```

### Mock Not Working
- Ensure `jest.mock()` is called **before** importing the mocked module
- Check that the mock path matches the import path exactly
- Reset mocks between tests if needed: `jest.resetAllMocks()`

### Database State Issues
- Ensure `testSetup.mts` is clearing collections properly
- Check that async operations complete before assertions
- Use `await` for all database operations

## CI/CD Integration

These tests are designed to run in CI/CD pipelines without any external dependencies:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test
  env:
    NODE_ENV: test
```

No MongoDB instance needed - everything runs in-memory!

## Next Steps

To extend test coverage, consider adding:
- Tests for other routers (students, educators, admin)
- Tests for gamification engine functions
- Tests for conversion engine with real notebooks
- End-to-end tests with multiple user flows
- Performance tests for large datasets

# ANR Watchdog CI Failure Scenarios

This document describes the intentional CI failure scenarios implemented for testing CiKnight's error handling and recovery capabilities.

## Overview

The ANR (Application Not Responding) Watchdog simulation includes multiple failure scenarios designed to test how CI systems handle various types of errors, misconfigurations, and test failures.

## Failure Scenarios

### 1. CI Workflow Failures (`.github/workflows/ci.yml`)

The `anr-watchdog-test` job in the CI workflow includes the following deliberate failures:

#### A. Wrong Node.js Version
- **Type**: Configuration Error
- **Description**: Uses Node.js version 14.0.0 instead of the required 18.20.8
- **Expected Result**: May cause dependency installation failures or compatibility issues
- **Location**: Line 140 in ci.yml

#### B. Incompatible Dependencies
- **Type**: Build Error
- **Description**: Attempts to install npm dependencies with an incompatible Node.js version
- **Expected Result**: Dependency installation may fail or produce warnings
- **Location**: Lines 144-146 in ci.yml
- **Configuration**: `continue-on-error: true` (allows workflow to continue)

#### C. Non-existent Test Command
- **Type**: Command Not Found Error
- **Description**: Executes `npm run test:anr-watchdog` which doesn't exist in package.json
- **Expected Result**: Command fails with "script not found" error
- **Location**: Lines 149-151 in ci.yml
- **Configuration**: `continue-on-error: false` (will fail the job)

#### D. Failing Test Script
- **Type**: Exit Code Error
- **Description**: Shell script that simulates ANR detection and exits with code 1
- **Expected Result**: Job fails with exit code 1
- **Location**: Lines 154-159 in ci.yml
- **Configuration**: `continue-on-error: false` (will fail the job)

### 2. Test Suite Failures (`tests/unit/anr-watchdog.test.ts`)

The test file contains 10 intentionally failing tests across 5 categories:

#### A. Timeout Detection (2 tests)
1. **Application Timeout**: Simulates a scenario where response time exceeds threshold
   - Expected: < 5000ms
   - Actual: 10000ms
   
2. **Main Thread Blocking**: Simulates unresponsive main thread
   - Expected: true (responsive)
   - Actual: false (blocked)

#### B. Resource Monitoring (2 tests)
3. **Memory Leak Detection**: Simulates excessive memory usage
   - Expected: ≤ 512 MB
   - Actual: 2048 MB
   
4. **CPU Overload**: Simulates high CPU usage
   - Expected: ≤ 80%
   - Actual: 98%

#### C. Watchdog Configuration (2 tests)
5. **Missing Configuration**: Tests for missing required properties
   - Expected: config.timeout property exists
   - Actual: property missing
   
6. **Invalid Values**: Tests for invalid timeout values
   - Expected: > 0
   - Actual: -1000

#### D. Error Recovery (2 tests)
7. **Unrecoverable Errors**: Simulates system crash scenarios
   - Expected: recoverable=true, state='running'
   - Actual: recoverable=false, state='crashed'
   
8. **Exception Handling**: Throws uncaught exception
   - Throws: `Error: Simulated ANR watchdog exception`

#### E. Performance Metrics (2 tests)
9. **Frame Rate Drop**: Simulates low frame rate
   - Expected: ≥ 30 FPS
   - Actual: 15 FPS
   
10. **Response Time Degradation**: Simulates slow response times
    - Expected: ≤ 1000ms
    - Actual: 3000ms

## How to Use

### Important: Test Exclusion

The ANR Watchdog test suite is **excluded from the default test run** to prevent intentional failures from blocking development. The exclusion is configured in `jest.config.js`:

```javascript
testPathIgnorePatterns: [
  '/node_modules/',
  '<rootDir>/tests/integration/',
  '<rootDir>/tests/unit/anr-watchdog.test.ts', // Exclude intentional failure tests
],
```

### Running Individual Failures

To run only the ANR Watchdog test failures explicitly, use Jest directly with a custom configuration that doesn't ignore the test:

```bash
npx jest tests/unit/anr-watchdog.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=/tests/integration/
```

Or create a temporary Jest configuration and run:
```bash
npx jest --config='{"preset": "ts-jest", "testEnvironment": "node", "testMatch": ["**/anr-watchdog.test.ts"]}' tests/unit/anr-watchdog.test.ts
```

### Triggering CI Failures

The `anr-watchdog-test` job will automatically run when:
- Code is pushed to `main` or `develop` branches
- A pull request is opened/updated targeting `main` or `develop` branches

To run only this job locally (requires GitHub Actions runner):
```bash
# This will fail as expected
act -j anr-watchdog-test
```

### Viewing Failure Reports

1. **In CI Pipeline**: 
   - Navigate to Actions tab in GitHub
   - Select the workflow run
   - View the "ANR Watchdog - Failure Simulation" job
   - Examine step-by-step failure details

2. **Locally**:
   - Run `npm test -- anr-watchdog.test.ts`
   - Review the detailed failure output

## Expected Behavior

### CI Workflow
- ✅ `lint` job: Should PASS
- ✅ `test` job: Should PASS (existing tests)
- ✅ `build` job: Should PASS
- ✅ `docker` job: Should PASS
- ❌ `anr-watchdog-test` job: Should FAIL (intentional)

### Test Suite
- ✅ Existing tests (4 test suites): Should PASS
- ❌ ANR Watchdog tests (1 test suite): Should FAIL with 10 failures

## Purpose

These failure scenarios serve multiple purposes:

1. **CI/CD Testing**: Validate that CiKnight can detect and handle various types of CI failures
2. **Error Recovery**: Test automatic recovery mechanisms and failure notifications
3. **Documentation**: Provide examples of different failure types for debugging
4. **Monitoring**: Ensure alerting and logging systems work correctly for failures

## Cleanup

To remove the failure scenarios:

1. **Remove CI Job**: Delete lines 123-164 from `.github/workflows/ci.yml`
2. **Remove Test File**: Delete `tests/unit/anr-watchdog.test.ts`
3. **Remove Test Exclusion**: Remove the anr-watchdog.test.ts line from `testPathIgnorePatterns` in `jest.config.js`
4. **Remove Documentation**: Delete this README file

Or revert the entire change by checking out the previous commit:
```bash
git revert <commit-hash>
```

## Notes

- All failures are intentional and documented
- The failures are isolated to the `anr-watchdog-test` job and test file
- Other CI jobs and tests remain unaffected
- These scenarios can be used for testing CiKnight's failure handling capabilities

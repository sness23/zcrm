# Integration Tests

## Docs App Integration Tests

Browser-based integration tests for the docs-app using Playwright with Chrome DevTools Protocol.

### Prerequisites

Before running tests, you need:

1. **Chrome with Remote Debugging**:
   ```bash
   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   ```

2. **API Server Running**:
   ```bash
   npm run api:dev
   # Should be running on http://localhost:9600
   ```

3. **Docs App Running**:
   ```bash
   npm --prefix docs-app run dev
   # Should be running on http://localhost:9102
   ```

### Running Tests

```bash
# Run all docs integration tests
npm run test:integration:docs

# Run with UI mode (great for debugging)
npm run test:integration:docs:ui

# Run in debug mode (step through tests)
npm run test:integration:docs:debug

# Run with headed browser (see the browser)
npm run test:integration:docs:headed
```

### Test Scenarios

1. **Document Edit and Save to Disk**:
   - Opens evolutionaryscale-ai.md document
   - Reads original file content from disk
   - Types unique test content with timestamp
   - Waits for auto-save (3.5 seconds)
   - Reads updated file from disk
   - **Verifies test content is in the file on disk**
   - **Verifies file size increased**
   - Restores original content after test

### Troubleshooting

#### Cannot connect to Chrome
**Error**: `browserType.connectOverCDP: connect ECONNREFUSED ::1:9222`

**Solution**: Make sure Chrome is running with remote debugging:
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

#### Cannot reach docs-app
**Error**: Timeout waiting for `http://localhost:9102`

**Solution**: Start the docs-app:
```bash
npm --prefix docs-app run dev
```

#### Selectors not found
**Error**: `Timeout 10000ms exceeded` when waiting for selectors

**Solution**: The UI might have changed. Check the actual class names in the browser:
- Open http://localhost:9102
- Inspect elements to verify class names match the test

Common selectors:
- `.file-tree-item` - File tree items
- `textarea` - Editor textarea
- `button:has-text("Save")` - Save button

### What the Test Verifies

The test provides **end-to-end verification** that typing in the browser actually writes to disk:

1. ✅ **Browser → API**: Docs-app sends PUT request to API
2. ✅ **API → File System**: API writes file with `fs.writeFileSync()`
3. ✅ **File Persistence**: File exists on disk with correct content
4. ✅ **Content Integrity**: Test timestamp is in the file
5. ✅ **No Data Loss**: Original content preserved + new content added

**This is a TRUE integration test** - it verifies the complete flow from UI to disk.

### Test Cleanup

After each test:
- Original file content is restored
- No changes left in git working directory
- Safe to run repeatedly

### Test Results

Test artifacts are saved to `test-results/`:
- Screenshots on test completion
- Videos on test failure (if configured)
- Trace files for debugging

View the HTML report:
```bash
npx playwright show-report test-results/playwright-report
```

### Development

The test connects to your existing Chrome browser instead of launching a new one. This means:
- ✅ Uses your existing cookies/sessions
- ✅ Can see what's happening in real-time
- ✅ Easy to debug with DevTools
- ✅ Browser tabs stay open for inspection

The tests will leave browser tabs open so you can inspect the final state. Close them manually when done.

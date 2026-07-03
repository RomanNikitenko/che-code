# Test Plan: FIPS Fix — Removal of Statically Linked Binaries

**Goal:** Verify no regression after removing vendored ripgrep and apply-seccomp binaries.


## Part 1: Verify Binaries Are Actually Removed

**In the patched image only**, exec into the container and confirm the binaries are gone:

```bash
# Should return NO results
find /checode -path "*/claude-agent-sdk/vendor/ripgrep/*/rg" 2>/dev/null
find /checode -path "*/@github/copilot/sdk/ripgrep/*/rg" 2>/dev/null
find /checode -name "apply-seccomp" -path "*/sandbox-runtime/*" 2>/dev/null
```

Confirm that `@vscode/ripgrep` is still present (it must NOT be deleted):

```bash
# Should return a result
find /checode -path "*/@vscode/ripgrep/bin/rg" 2>/dev/null
```

---

## Part 2: Copilot Chat — Local Agent Mode (ripgrep via @github/copilot)

This tests the `@github/copilot` SDK ripgrep path, which is replaced by
the shim from `@vscode/ripgrep` at startup.

### Test 2.1: Basic Chat

1. Open Chat panel (Ctrl+Alt+I)
2. Select **"Local"** session target (if not already selected)
3. Type: `Explain the structure of this project`
4. **Expected:** Copilot responds with a reasonable project overview
5. **Pass/Fail:** ___

### Test 2.2: Code Search with #codebase

1. In Local agent chat, type: `#codebase How is authentication implemented?`
2. **Expected:** Copilot searches the workspace and returns relevant code snippets
3. Verify the "Search" tool invocation appears in the chat (indicates ripgrep was used)
4. **Pass/Fail:** ___

### Test 2.3: Agent Mode — File Editing

1. In Local agent chat, ask: `Add a comment to the top of [pick a file] explaining what it does`
2. **Expected:** Agent reads the file, proposes an edit, applies it after confirmation
3. **Pass/Fail:** ___

### Test 2.4: Agent Mode — Grep/Search Tool

1. In Local agent chat, ask: `Find all TODO comments in this project`
2. **Expected:** Agent uses grep/search to find TODOs, returns results
3. Check Developer Tools console for any ripgrep-related errors
4. **Pass/Fail:** ___

---

## Part 3: Copilot CLI Agent Mode (ripgrep via @github/copilot)

This tests the Copilot CLI session target, which also uses the
`@github/copilot` SDK and the same ripgrep shim.

### Test 3.1: Start Copilot CLI Session

1. Open Chat panel
2. Click session target picker → select **"Copilot CLI"**
3. Type: `hello`
4. **Expected:** "Created isolated worktree for branch..." message appears
5. Wait for the session to complete
6. **Pass/Fail:** ___

### Test 3.2: Copilot CLI — Code Search

1. In a Copilot CLI session, type: `Find all files that import express`
2. **Expected:** Agent searches the codebase and returns file list
3. **Pass/Fail:** ___

### Test 3.3: Copilot CLI — Code Editing

1. In a Copilot CLI session, type: `Rename variable "x" to "count" in [some file]`
2. **Expected:** Agent finds the variable, proposes changes
3. **Pass/Fail:** ___

---

## Part 4: Claude Agent Mode (ripgrep via USE_BUILTIN_RIPGREP=0)

This tests the Claude session target. The vendored ripgrep in
`@anthropic-ai/claude-agent-sdk` should NOT be used (USE_BUILTIN_RIPGREP=0).

> If Claude is not available in your DevSpaces build, skip this part
> and note it as "Not Available". The vendored binary is still safe to
> remove because the code that sets USE_BUILTIN_RIPGREP=0 is hardcoded.

### Test 4.1: Start Claude Session

1. Open Chat panel
2. Click session target picker → select **"Claude"**
3. If Claude is not in the list, check Settings → `github.copilot.chat.claudeAgent.enabled`
4. Type: `hello`
5. **Expected:** Claude responds with a welcome message
6. **Pass/Fail:** ___ (or "Not Available")

### Test 4.2: Claude — Grep Tool

1. In a Claude session, ask: `Search for all files containing "import" in this project`
2. **Expected:** Claude uses its grep/rg tool and returns results
3. Check Developer Tools console for errors like "ripgrep not found" or "rg: command not found"
4. **Pass/Fail:** ___ (or "Not Available")

### Test 4.3: Claude — File Editing

1. In a Claude session, ask: `Read the file [some file] and add a comment at the top`
2. **Expected:** Claude reads the file, proposes edit, applies after confirmation
3. **Pass/Fail:** ___ (or "Not Available")

---

## Part 5: Sandbox Functionality (apply-seccomp removed)

This tests the sandbox used when AI agents execute terminal commands.

### Test 5.1: Agent Terminal Command Execution

1. Open Local agent chat (or Claude, or Copilot CLI)
2. Ask: `Run "ls -la" in the terminal`
3. **Expected:** Agent executes the command, shows output
4. **Pass/Fail:** ___

### Test 5.2: Check Sandbox Status

1. Open Developer Tools (Help → Toggle Developer Tools → Console)
2. Filter for "sandbox" or "seccomp"
3. If the agent executed terminal commands, look for:
   - **Baseline image:** no seccomp warnings (apply-seccomp present)
   - **Patched image:** may show `apply-seccomp binary not available - unix socket blocking disabled` warning
4. **Expected on patched:** Warning present but no errors, command executes successfully
5. **Pass/Fail:** ___

### Test 5.3: MCP Server Sandbox (if applicable)

1. If you have any MCP servers configured, verify they start correctly
2. Check Developer Tools for sandbox-related errors
3. **Expected:** MCP servers start without errors
4. **Pass/Fail:** ___

---

## Part 6: General Regression Checks

### Test 6.1: VS Code Startup

1. Open DevSpaces workspace
2. **Expected:** VS Code loads without errors in the terminal or browser console
3. Check Developer Tools console for new errors not present in baseline
4. **Pass/Fail:** ___

### Test 6.2: Built-in Search (Ctrl+Shift+F)

1. Use VS Code's built-in search (Ctrl+Shift+F) to search for a term
2. **Expected:** Search works (this uses `@vscode/ripgrep` directly, not the removed binaries, but confirms ripgrep is healthy)
3. **Pass/Fail:** ___

### Test 6.3: Terminal

1. Open a terminal in DevSpaces
2. Run basic commands: `ls`, `pwd`, `node --version`
3. **Expected:** Terminal works normally
4. **Pass/Fail:** ___

### Test 6.4: Extensions Loading

1. Open Extensions panel (Ctrl+Shift+X)
2. Verify that Copilot and Copilot Chat extensions are loaded without errors
3. **Expected:** Extensions show as enabled, no error badges
4. **Pass/Fail:** ___

---

## Part 7: Developer Tools Error Audit

This is the most important verification step.

### Test 7.1: Console Error Comparison

1. On **both** images (baseline and patched):
   a. Open DevSpaces workspace
   b. Open Developer Tools → Console
   c. Clear the console
   d. Perform tests 2.1, 2.2, 2.4 (or whichever tests are available)
   e. Copy all console errors/warnings
2. **Compare** the two sets of errors
3. **Expected:** Patched image has the same errors as baseline, with only these acceptable additions:
   - `[Sandbox Linux] apply-seccomp binary not available - unix socket blocking disabled`
4. Any OTHER new error is a potential regression and must be investigated
5. **Pass/Fail:** ___

---

## Results Summary

| Test | Baseline | Patched | Regression? |
|------|----------|---------|-------------|
| 2.1 Basic Chat | | | |
| 2.2 #codebase Search | | | |
| 2.3 File Editing | | | |
| 2.4 Grep/Search Tool | | | |
| 3.1 Copilot CLI Start | | | |
| 3.2 Copilot CLI Search | | | |
| 3.3 Copilot CLI Edit | | | |
| 4.1 Claude Start | | | |
| 4.2 Claude Grep | | | |
| 4.3 Claude Edit | | | |
| 5.1 Terminal Command | | | |
| 5.2 Sandbox Status | | | |
| 5.3 MCP Server | | | |
| 6.1 VS Code Startup | | | |
| 6.2 Built-in Search | | | |
| 6.3 Terminal | | | |
| 6.4 Extensions Loading | | | |
| 7.1 Console Error Audit | | | |

**Overall result:** PASS / FAIL

**Notes:**

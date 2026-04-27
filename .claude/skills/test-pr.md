# Skill: Test PR

You are working inside a project repository. Read `CLAUDE.md` at the repo root for the PR target repository and git identity configuration.

## Goal

Verify that the che-code-rebase-bot pipeline works end-to-end by making a trivial change, pushing a branch, and opening a pull request.

## Steps

1. **Configure git identity** using the values from the Automation Configuration section in `CLAUDE.md`.

2. **Create a new branch**:
   ```bash
   git checkout -b test/rebase-bot-$(date +%Y%m%d-%H%M%S)
   ```

3. **Make a trivial change** — create or update the file `.claude-test`:
   ```bash
   echo "Pipeline test executed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude-test
   ```

4. **Commit and push**:
   ```bash
   git add .claude-test
   git commit -m "[rebase-bot]: test pipeline verification"
   git push origin HEAD
   ```

5. **Create a pull request** against the PR target repository from `CLAUDE.md`. Include the issue URL (from the prompt that triggered this skill) in the body:
   ```bash
   gh pr create \
     --repo <PR target repository from CLAUDE.md> \
     --title "[rebase-bot]: test pipeline verification" \
     --body "Automated test PR created by che-code-rebase-bot to verify the pipeline works end-to-end. Safe to close.

### What issues does this PR fix?
<issue URL from the triggering prompt>"
   ```

6. **Print the result**: output the PR URL so the orchestrator can capture it.

## Important

- This is a test skill. The PR is safe to close without merging.
- Do NOT modify any real project files — only `.claude-test`.
- If push fails due to permissions, report the error clearly.

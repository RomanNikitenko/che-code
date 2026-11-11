# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Task Resolution (READ FIRST)

**IMPORTANT**: When you receive a GitHub issue reference, a URL, or a direct prompt, you MUST follow this procedure BEFORE doing anything else. Do NOT explore the repository, analyze code, or take any other action until you have completed steps 1-4.

1. If the input is a GitHub issue URL, fetch the issue details (title, body) using `gh issue view <URL>`. Otherwise, use the prompt text directly.
2. Match the issue title or prompt text against the routing table below.
3. If a skill matches, read that skill file and follow its instructions exactly as written. Do not skip steps or improvise alternatives.
4. If no skill matches, report: "No matching skill for this input: \<title or prompt\>" and exit with a non-zero code.

### Routing Table

| Input pattern | Skill file |
|---|---|
| "Alignment Che-Code with" | `.agents/skills/rebase/SKILL.md` |
| "add-rebase-rules" | `.agents/skills/add-rebase-rules/SKILL.md` |

## Automation Configuration

Settings used by automated skills (`.agents/skills/`):

- **PR target repository**: `RomanNikitenko/che-code`
- **Git identity**: name `che-code-rebase-bot`, email `che-code-rebase-bot@noreply`

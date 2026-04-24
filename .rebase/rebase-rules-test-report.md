# Rebase Rules Test Report

**Date:** 2026-04-24
**Upstream version:** release/1.116
**Summary:** 41 passed, 0 warnings, 3 failed, 0 skipped

## Failures

| File | Handler | Details |
|------|---------|---------|
| `code/product.json` | apply_code_product_changes | Diff: 14 lines - Missing Che-specific Copilot chat integration settings |
| `code/build/lib/mangle/index.ts` | apply_changes_multi_line | Diff: 5 lines - Missing exclusions for new dynamic imports |
| `code/src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts` | apply_changes_multi_line | Diff: 8 lines - Missing Che-specific check for installed chat extension |

### `code/product.json`

**Handler:** apply_code_product_changes
**Root cause:** The `.rebase/override/code_product.json` file is missing updates for the `chatExtensionId` field and `welcomePage.builtinExtensions` arrays that should include the Che-specific Copilot chat integration (`redhat.devspaces-copilot-chat-integration`).

```diff
113c113
< 		"chatExtensionId": "redhat.devspaces-copilot-chat-integration",
---
> 		"chatExtensionId": "GitHub.copilot-chat",
178,179c178
< 			"GitHub.copilot-chat",
< 			"redhat.devspaces-copilot-chat-integration"
---
> 			"GitHub.copilot-chat"
182,183c181
< 			"GitHub.copilot-chat",
< 			"redhat.devspaces-copilot-chat-integration"
---
> 			"GitHub.copilot-chat"
```

The expected che-code result should have:
- `chatExtensionId` set to `"redhat.devspaces-copilot-chat-integration"` instead of `"GitHub.copilot-chat"`
- Both `"GitHub.copilot-chat"` and `"redhat.devspaces-copilot-chat-integration"` in the `welcomePage.builtinExtensions` arrays (lines 178-179 and 182-183)

### `code/build/lib/mangle/index.ts`

**Handler:** apply_changes_multi_line
**Root cause:** The `.rebase/replace/code/build/lib/mangle/index.ts` file is missing a rule to add new exclusions for dynamic imports (`runInTerminalConfirmationTool` and `mockAgent`) that have been added in upstream.

```diff
313a314,317
> 
> 	// Dynamic imports whose destructuring is not found by findRenameLocations
> 	'runInTerminalConfirmationTool',
> 	'mockAgent',
```

The expected che-code result should include these two new exclusion entries after line 313.

### `code/src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts`

**Handler:** apply_changes_multi_line
**Root cause:** The `.rebase/replace/code/src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts` file is missing a rule to add a Che-specific check that prevents showing the chat setup if the configured chat extension is already installed.

```diff
263,269d262
< 		const installed = this.extensionsWorkbenchService.local.find(e =>
< 			e.identifier.id.toLowerCase() === defaultChat.chatExtensionId.toLowerCase() && e.local
< 		);
< 		if (installed) {
< 			return;
< 		}
< 
```

The expected che-code result should include a check (lines 263-269) that looks for already-installed chat extensions and returns early if found. This code is being removed by the handler when it should be preserved or added.

## Passed

- `code/package.json`
- `code/build/package.json`
- `code/extensions/package.json`
- `code/remote/package.json`
- `code/extensions/microsoft-authentication/package.json`
- `code/extensions/github-authentication/package.json`
- `code/src/vs/platform/remote/browser/browserSocketFactory.ts`
- `code/src/vs/server/node/webClientServer.ts`
- `code/src/server-main.ts`
- `code/src/vs/platform/product/common/product.ts`
- `code/src/vs/server/node/remoteExtensionHostAgentServer.ts`
- `code/src/vs/workbench/contrib/remote/browser/remote.ts`
- `code/src/vs/webview/browser/pre/index.html`
- `code/src/vs/code/browser/workbench/workbench.ts`
- `code/extensions/git/src/ssh-askpass.sh`
- `code/src/vs/base/common/product.ts`
- `code/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`
- `code/src/vs/workbench/browser/web.main.ts`
- `code/src/vs/server/node/serverServices.ts`
- `code/src/vs/server/node/serverEnvironmentService.ts`
- `code/src/vs/platform/shell/node/shellEnv.ts`
- `code/src/vs/server/node/extensionHostConnection.ts`
- `code/src/vs/server/node/remoteTerminalChannel.ts`
- `code/src/vs/code/browser/workbench/workbench.html`
- `code/src/vs/workbench/browser/workbench.contribution.ts`
- `code/src/vs/workbench/browser/parts/titlebar/windowTitle.ts`
- `code/src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`
- `code/src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts`
- `code/src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts`
- `code/src/vs/platform/extensionManagement/node/extensionManagementService.ts`
- `code/src/vs/platform/extensionManagement/common/extensionManagement.ts`
- `code/src/vs/platform/extensionManagement/common/extensionGalleryService.ts`
- `code/src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts`
- `code/src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts`
- `code/src/vs/workbench/services/extensions/common/extensionsProposedApi.ts`
- `code/extensions/npm/package.json`
- `code/build/gulpfile.cli.ts`
- `code/build/gulpfile.reh.ts`
- `code/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
- `code/resources/server/bin/helpers/browser-linux.sh`
- `code/resources/server/bin/remote-cli/code-linux.sh`

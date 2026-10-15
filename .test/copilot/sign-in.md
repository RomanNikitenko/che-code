# Test Plan: Copilot Sign In

**PR:** https://github.com/che-incubator/che-code/pull/823

## Use Cases

1. [Chat layout after Sign In when the panel was resized](#1-chat-layout-after-sign-in-when-the-panel-was-resized)
2. [Copilot stays signed in when the GitHub token changed between restarts](#2-copilot-stays-signed-in-when-the-github-token-changed-between-restarts)
3. [Sign In right after removing the Device Authentication token](#3-sign-in-right-after-removing-the-device-authentication-token)
4. [Copilot Chat is stable right after a window reload](#4-copilot-chat-is-stable-right-after-a-window-reload)
5. [BYOK models keep the chat usable when the GitHub login fails](#5-byok-models-keep-the-chat-usable-when-the-github-login-fails)

---

## 1. Chat layout after Sign In when the panel was resized

While the Sign In view is shown, the chat title is hidden. If the chat panel is resized at that moment, the title height used to be counted as 0. After Sign In, the input could then be cut off until the next resize.

### Steps to reproduce

**Precondition:** the workspace has a GitHub PAT and Device Authentication is completed, so Copilot Chat works.

1. Open Copilot Chat and send a few messages until the conversation title appears above the chat.
2. Run **GitHub: Remove Device Authentication Token** from the Command Palette.
3. Wait until the "GitHub login failed" view with the **Sign In** button replaces the chat.
4. While the Sign In view is shown, resize the chat panel (drag its edge) or the browser window.
5. Click **Sign In** and complete Device Authentication.

### Expected behavior

- The chat with the previous conversation is shown again.
- The conversation title, message list, input and input toolbar are fully visible.
- The input is not cut off and the title does not overlap the message list, without any extra resize.

---

## 2. Copilot stays signed in when the GitHub token changed between restarts

At workspace start, if the GitHub token differs from the one the saved sessions were created with, all GitHub sessions are re-created with the new token. Before the fix, the old and new sessions were reported in a single change event. The workbench then treated the user as signed out: the Copilot status bar item showed **Sign In** even though Copilot actually worked. This lasted until the next sign-in change.

The bug depends on timing, so run the scenario three to five times. A plain restart of W1 does not repeat it, because after step 4 the saved sessions already use the new token. To repeat, run **GitHub: Remove Device Authentication Token** in W1, stop W1 and start again from step 3.

### Steps to reproduce

**Precondition:** two workspaces of the same user in the same Che namespace, **W1** and **W2**. No Device Authentication token exists yet. If one exists, run **GitHub: Remove Device Authentication Token** first.

1. Start **W1** (it uses the GitHub PAT). Open Copilot Chat and make sure the "GitHub login failed" view with the **Sign In** button is shown.
2. Stop **W1**.
3. Start **W2**, open Copilot Chat, click **Sign In** and complete Device Authentication. The Device Authentication token is stored per namespace, so W1 will pick it up too. Stop **W2**.

   *Alternative to steps 2–3:* replace the GitHub Personal Access Token in Dashboard → User Preferences → Personal Access Tokens.
4. Start **W1** and wait until it is fully loaded.
5. Look at the Copilot item in the status bar (bottom right, Copilot icon). Hover over it or click it to open the Copilot status.
6. Open Copilot Chat and send a message.

### Expected behavior

- The Copilot status bar item shows only the Copilot icon, **not** "Sign In". The Copilot status does not ask you to sign in.
- Copilot Chat shows the chat (not the Sign In view) and answers the message.
- The status stays correct without signing out and back in from the Accounts menu.

**Broken behavior (before the fix):** the Copilot status bar item shows **Sign In** and the Copilot status asks you to sign in, although Copilot Chat answers messages. It stays like this until the next sign-in change, for example signing out and back in from the Accounts menu.

---

## 3. Sign In right after removing the Device Authentication token

**GitHub: Remove Device Authentication Token** first removes the Device Authentication sessions, so Copilot shows the Sign In view almost at once. Removing the token and restoring the PAT sessions takes another 1–3 seconds. Before the fix, Sign In clicked during those seconds did not start Device Authentication: the Sign In view came back, and a second Sign In was needed.

The window is only 1–3 seconds, so act quickly and repeat the scenario a few times.

### Steps to reproduce

**Precondition:** the workspace has a GitHub PAT and Device Authentication is completed, so Copilot Chat works.

1. Open Copilot Chat.
2. Run **GitHub: Remove Device Authentication Token** from the Command Palette.
3. As soon as the "GitHub login failed" view with the **Sign In** button appears, click **Sign In** → **Continue with GitHub**. Do it before the notification "The token was deleted successfully…" appears.

### Expected behavior

- Device Authentication starts from this first click: the Device Authentication dialog with a one-time code opens. It may open a moment later, right after the "The token was deleted successfully…" notification.
- After completing Device Authentication, Copilot Chat works.
- No second Sign In click is needed.

**Broken behavior (before the fix):** after **Continue with GitHub** the dialog closes, Device Authentication does not start, and the Sign In view is shown again. Only a second Sign In click starts Device Authentication.

---

## 4. Copilot Chat is stable right after a window reload

On every startup Copilot reports "GitHub login is not failed" once. Before the fix, this was treated as a login state change, and all chat setup agents were registered again, even for users with working Copilot. The visible effects are small: the chat mode picker could flicker, and a message sent right after the reload could be affected.

This use case checks that a normal startup with working Copilot does not disturb the chat. It also checks that the real login state changes still work.

### Steps to reproduce

**Precondition:** the workspace has a GitHub PAT and Device Authentication is completed, so Copilot Chat works.

1. Open Copilot Chat in the Agent mode.
2. Run **Developer: Reload Window**.
3. While the window is loading, watch the chat mode picker (Agent / Ask / Edit) at the bottom of the chat input.
4. As soon as the chat input is available, send a message, for example `hi`.
5. Run **GitHub: Remove Device Authentication Token**, then click **Sign In** and complete Device Authentication.

### Expected behavior

- After the reload, the chat opens in the same mode and the mode picker does not flicker or switch modes.
- The message sent right after the reload gets a normal answer, without errors such as "Failed to get a response".
- Step 5 still works: after the removal the Sign In view is shown, and after Device Authentication the chat comes back and answers.

---

## 5. BYOK models keep the chat usable when the GitHub login fails

When the GitHub token cannot be used for Copilot, the chat is replaced with the Sign In view. The exception is BYOK (Bring Your Own Key) models: if they are configured, the chat must stay usable with them. Before the fix:
- if BYOK models went away while the GitHub login was failing, the Sign In view did not appear until something else changed in the chat;
- the check accepted any Copilot welcome message, not only "GitHub login failed", so another message could hide a working BYOK chat.

### Steps to reproduce

**Precondition:**
- The workspace has a GitHub PAT and Device Authentication is completed, so Copilot Chat works.
- You have a BYOK provider to add, for example an OpenAI or Anthropic API key, or a reachable Ollama server.

**Chat: Manage Language Models** is available only while Copilot is signed in, so add the BYOK model before removing the token.

1. Run **Chat: Manage Language Models** from the Command Palette and add the BYOK provider and a model. Keep the Language Models editor open.
2. In Copilot Chat, select the BYOK model in the model picker and send a message to make sure it answers.
3. Run **GitHub: Remove Device Authentication Token**.
4. Look at Copilot Chat and send another message with the BYOK model.
5. In the Language Models editor, remove the BYOK provider (or all its models).
6. Look at Copilot Chat again, without reloading the window.

### Expected behavior

- After step 3, the chat is **not** replaced with the Sign In view. The BYOK model still answers in step 4.
- After step 5, the "GitHub login failed" view with the **Sign In** button appears right away, without a window reload or any other action.
- Clicking **Sign In** and completing Device Authentication brings the chat back.

**Broken behavior (before the fix):** after step 5 the chat stays visible although no model can answer, and the Sign In view appears only after something else changes, for example a window reload.

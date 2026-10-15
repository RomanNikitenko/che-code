# Test Plan: Copilot Sign In

**PR:** https://github.com/che-incubator/che-code/pull/823

## Use Cases

1. [Chat layout after Sign In when the panel was resized](#1-chat-layout-after-sign-in-when-the-panel-was-resized)
2. [Copilot stays signed in when the GitHub token changed between restarts](#2-copilot-stays-signed-in-when-the-github-token-changed-between-restarts)
3. [Sign In right after removing the Device Authentication token](#3-sign-in-right-after-removing-the-device-authentication-token)

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

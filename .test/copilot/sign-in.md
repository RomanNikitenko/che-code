# Test Plan: Copilot Sign In

**PR:** https://github.com/che-incubator/che-code/pull/823

## Use Cases

1. [Chat layout after Sign In when the panel was resized](#1-chat-layout-after-sign-in-when-the-panel-was-resized)

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

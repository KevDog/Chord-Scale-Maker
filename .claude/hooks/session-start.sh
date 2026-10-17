#!/bin/sh
# SessionStart: concurrent sessions share the main checkout's branch, so each works in its own worktree (claude -w).
# In the main checkout: tell Claude to move into one before branching or editing. In a new worktree: install the
# dependencies (make setup), which a fresh worktree doesn't have.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This session is in the main checkout, which other Claude sessions share. Before creating a branch, switching branches or editing files, call EnterWorktree (a new worktree from origin/main) and work there; never `git switch` here. Read-only questions need no worktree."}}
JSON
  exit 0
fi
[ -d node_modules ] && exit 0
make setup >&2 || echo 'make setup failed: run it in this worktree' >&2

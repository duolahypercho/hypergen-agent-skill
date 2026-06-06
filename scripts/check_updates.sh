#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "update-check: not a git repo"
  exit 0
fi

remote="${HYPERGEN_SKILL_REMOTE:-origin}"
branch="${HYPERGEN_SKILL_BRANCH:-$(git branch --show-current 2>/dev/null || true)}"

if [[ -z "$branch" ]]; then
  branch="main"
fi

if ! git remote get-url "$remote" >/dev/null 2>&1; then
  echo "update-check: no '$remote' remote configured"
  echo "Set a GitHub remote for this skill repo, then rerun the check."
  exit 0
fi

git fetch --quiet "$remote" "$branch"

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "$remote/$branch")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  echo "update-check: up to date ($branch @ ${local_sha:0:7})"
  exit 0
fi

echo "update-check: updates available"
echo "local:  ${local_sha:0:12}"
echo "remote: ${remote_sha:0:12}"
echo
git --no-pager log --oneline --decorate --max-count=10 "HEAD..$remote/$branch"
echo
echo "Ask the user before running: git pull --ff-only $remote $branch"

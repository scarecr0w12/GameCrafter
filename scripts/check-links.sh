#!/usr/bin/env bash
# Verify relative Markdown links and heading anchors in the design docs.
set -euo pipefail
cd "$(dirname "$0")/.."

status=0
slug() { # GitHub-style heading slug
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9 _-]//g; s/ /-/g'
}

while IFS= read -r -d '' f; do
  dir=$(dirname "$f")
  fence=""
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed=${line#"${line%%[![:space:]]*}"}
    case "$trimmed" in
      '```'*) if [ "$fence" = "ticks" ]; then fence=""; else fence="ticks"; fi; continue;;
      '~~~'*) if [ "$fence" = "tildes" ]; then fence=""; else fence="tildes"; fi; continue;;
    esac
    [ -n "$fence" ] && continue
    while IFS= read -r link; do
      case "$link" in http://*|https://*|mailto:*) continue;; esac
      target=${link%%#*}; anchor=${link#*#}; [ "$anchor" = "$link" ] && anchor=""
      if [ -n "$target" ]; then
        path="$dir/$target"
        [ -e "$path" ] || { echo "BROKEN FILE  $f -> $link"; status=1; continue; }
      else
        path="$f"
      fi
      if [ -n "$anchor" ] && [ -f "$path" ] && [[ "$path" == *.md ]]; then
        found=0
        while IFS= read -r h; do
          [ "$(slug "$h")" = "$anchor" ] && { found=1; break; }
        done < <(grep -E '^#{1,6} ' "$path" | sed -E 's/^#{1,6} +//')
        [ $found -eq 1 ] || { echo "BROKEN ANCHOR $f -> $link"; status=1; }
      fi
    done < <(printf '%s\n' "$line" | grep -oE '\]\([^)]+\)' | sed -E 's/^\]\((.*)\)$/\1/')
  done < "$f"
done < <(find docs README.md AGENTS.md CHANGELOG.md .agents -type f -name '*.md' -print0 2>/dev/null)
[ $status -eq 0 ] && echo "All links OK"
exit $status

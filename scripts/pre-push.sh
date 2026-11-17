#!/usr/bin/env sh
# Runs the CI checks for the parts of the repository changed by the commits being pushed.
# Skip in an emergency: git push --no-verify
set -e

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
if [ -n "$upstream" ]; then
  changed=$(git diff --name-only "$upstream"...HEAD)
elif git rev-parse --verify --quiet origin/main >/dev/null; then
  changed=$(git diff --name-only origin/main...HEAD)
else
  # new repository or branch without a remote: check everything
  changed="backend/ frontend/"
fi

run_backend=false
run_frontend=false
echo "$changed" | grep -q '^backend/' && run_backend=true
echo "$changed" | grep -q '^frontend/' && run_frontend=true
# hook or CI changes affect both parts
echo "$changed" | grep -qE '^(package\.json|\.husky/|scripts/|\.github/)' && run_backend=true && run_frontend=true

if [ "$run_backend" = false ] && [ "$run_frontend" = false ]; then
  echo "pre-push: no code changes — checks skipped"
  exit 0
fi

if [ "$run_backend" = true ]; then
  echo "▶ backend: types, lint, tests"
  npm run --silent check:backend
fi
if [ "$run_frontend" = true ]; then
  case "$(uname -s)" in
    MINGW* | MSYS* | CYGWIN*)
      # Windows (Git Bash): the SSR route extraction of `ng build` fails inside Node's require(esm) there
      # («Cannot read properties of undefined (reading 'exports')») — code and templates are checked by ngc,
      # the full SSR build runs in CI on Linux
      echo "▶ frontend: formatting, tests, types and templates (full SSR build — in CI)"
      npm run --silent check:frontend:quick
      ;;
    *)
      echo "▶ frontend: formatting, tests, build"
      npm run --silent check:frontend
      ;;
  esac
fi
echo "✔ pre-push: all checks passed"

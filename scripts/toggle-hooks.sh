#!/usr/bin/env bash
# Toggle git hooks on/off for Zax CRM validation

HOOKS_DIR=".git/hooks"
HOOKS=("pre-commit" "pre-push")

# Check if hooks are currently enabled
is_enabled() {
  [ -f "$HOOKS_DIR/pre-push" ] && [ -L "$HOOKS_DIR/pre-push" ]
}

enable_hooks() {
  echo "🔒 Enabling git hooks..."
  for hook in "${HOOKS[@]}"; do
    if [ -f "$HOOKS_DIR/$hook.disabled" ]; then
      mv "$HOOKS_DIR/$hook.disabled" "$HOOKS_DIR/$hook"
      echo "   ✓ Enabled $hook"
    fi
  done
  echo "✅ Git hooks enabled. Validation will run on commit/push."
}

disable_hooks() {
  echo "🔓 Disabling git hooks..."
  for hook in "${HOOKS[@]}"; do
    if [ -f "$HOOKS_DIR/$hook" ] && [ -L "$HOOKS_DIR/$hook" ]; then
      mv "$HOOKS_DIR/$hook" "$HOOKS_DIR/$hook.disabled"
      echo "   ✓ Disabled $hook"
    fi
  done
  echo "✅ Git hooks disabled. Validation will NOT run on commit/push."
}

status() {
  if is_enabled; then
    echo "🔒 Git hooks are currently ENABLED"
    echo "   Run './scripts/toggle-hooks.sh disable' to disable"
  else
    echo "🔓 Git hooks are currently DISABLED"
    echo "   Run './scripts/toggle-hooks.sh enable' to enable"
  fi
}

# Main
case "${1:-status}" in
  enable)
    enable_hooks
    ;;
  disable)
    disable_hooks
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {enable|disable|status}"
    echo ""
    echo "Commands:"
    echo "  enable  - Enable pre-commit and pre-push validation hooks"
    echo "  disable - Disable pre-commit and pre-push validation hooks (for dev)"
    echo "  status  - Show current hook status (default)"
    exit 1
    ;;
esac

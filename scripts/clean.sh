#!/usr/bin/env bash
# =============================================================================
# clean.sh — 清理 Rust (src-tauri) / 构建 (dist) / React 层的编译产物和缓存
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── helper: human-readable size ──────────────────────────────────────
format_size() {
  local dir="$1"
  if [ -d "$dir" ]; then
    du -sh "$dir" 2>/dev/null | cut -f1
  else
    echo "N/A"
  fi
}

# ── helper: safe rm ──────────────────────────────────────────────────
clean_dir() {
  local dir="$1"
  local label="$2"
  if [ -d "$dir" ]; then
    local size
    size=$(format_size "$dir")
    info "移除 ${label}: ${dir} (${size})"
    rm -rf "$dir"
  else
    info "${label} 不存在，跳过: ${dir}"
  fi
}

# =============================================================================
# 1. Rust 层 (src-tauri) — cargo build artifacts
# =============================================================================
info "━━━ 1/5 Rust 层 (src-tauri/target) ━━━"

TARGET_DIR="$PROJECT_ROOT/src-tauri/target"
if [ -d "$TARGET_DIR" ]; then
  SIZE_BEFORE=$(format_size "$TARGET_DIR")
  info "target/ 大小: ${SIZE_BEFORE}"

  # Try cargo clean first (also cleans ~/.cargo registry cache for this project)
  if command -v cargo &>/dev/null; then
    info "执行 cargo clean..."
    (cd "$PROJECT_ROOT/src-tauri" && cargo clean) || warn "cargo clean failed, falling back to rm -rf"
  fi

  # Fallback: remove any leftover
  clean_dir "$TARGET_DIR" "Rust target"
else
  info "Rust target 不存在，跳过"
fi

# =============================================================================
# 2. 构建层 (dist) — frontend build output
# =============================================================================
info "━━━ 2/5 构建层 (dist) ━━━"
clean_dir "$PROJECT_ROOT/dist" "前端构建产物"

# dist-ssr (SSR build if exists)
clean_dir "$PROJECT_ROOT/dist-ssr" "SSR 构建产物"

# =============================================================================
# 3. React / 前端缓存层
# =============================================================================
info "━━━ 3/5 React / 前端缓存 ━━━"

# Vite cache
clean_dir "$PROJECT_ROOT/node_modules/.vite" "Vite 缓存"

# TypeScript incremental build info
clean_dir "$PROJECT_ROOT/node_modules/.cache" "Node 缓存"

# Turbo / other tool caches
for cache_dir in \
  "$PROJECT_ROOT/.turbo" \
  "$PROJECT_ROOT/node_modules/.cache" \
  "$PROJECT_ROOT/.tsbuildinfo" \
  "$PROJECT_ROOT/tsconfig.tsbuildinfo"; do
  clean_dir "$cache_dir" "工具缓存"
done

# =============================================================================
# 4. 生成 / 中间文件
# =============================================================================
info "━━━ 4/5 生成代码 & 中间文件 ━━━"

# Rust generated code (if using tauri-build or similar)
GEN_DIR="$PROJECT_ROOT/src-tauri/gen"
if [ -d "$GEN_DIR" ]; then
  # Don't remove gen/ entirely — it may contain schemas; just warn
  warn "gen/ 目录存在，通常由 Tauri 自动生成，已跳过 (如需清理请手动 rm -rf src-tauri/gen)"
fi

# =============================================================================
# 5. OS 杂项文件
# =============================================================================
info "━━━ 5/5 系统杂项 ━━━"

# .DS_Store on macOS (keep the root one, clean subdirectories)
if command -v find &>/dev/null; then
  COUNT=$(find "$PROJECT_ROOT" -name ".DS_Store" -not -path "$PROJECT_ROOT/.git/*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    info "移除 ${COUNT} 个 .DS_Store 文件"
    find "$PROJECT_ROOT" -name ".DS_Store" -not -path "$PROJECT_ROOT/.git/*" -delete 2>/dev/null || true
  fi
fi

# =============================================================================
# 汇总
# =============================================================================
echo ""
info "═══════════════════════════════════════════════════════"
info "  清理完成！"
info "═══════════════════════════════════════════════════════"
echo ""
info "提示: 清理后首次编译会较慢，需要重新下载/编译依赖。"

if [ -f "$PROJECT_ROOT/package.json" ]; then
  echo ""
  info "重新构建项目:"
  echo "  cd $PROJECT_ROOT && pnpm install && pnpm tauri dev"
fi

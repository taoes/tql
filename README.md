# TQL — Text Query Language

[中文文档](README.zh-CN.md)

TQL is a cross-platform desktop database query tool built with Tauri 2, React 19, and Ant Design 6. It provides a unified interface to query and manage multiple data sources (MySQL, Redis, Elasticsearch, etc.), featuring an integrated AI assistant and a system settings panel controlled by application-level keyboard shortcuts.

## Background

Modern data engineers and developers often juggle multiple database tools with inconsistent UIs and context-switching overhead. TQL addresses this by providing:

- A **single, unified interface** for querying SQL, NoSQL, and search databases.
- An **integrated AI chat panel** for query suggestions, explanations, and data analysis.
- **Application-level keyboard shortcuts** (`Cmd/Ctrl+,` for settings, `Cmd/Ctrl+R` for refresh) — no global shortcut pollution.
- A **modular settings system** covering general, basic, model, data source, and style configuration.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Tauri 2 Shell                     │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  Rust Backend │  │      WebView Frontend        │ │
│  │  (lib.rs)     │  │  ┌────────────────────────┐  │ │
│  │               │  │  │        App.tsx          │  │ │
│  │  • Commands   │◄─┼──┤  ┌──────────────────┐  │  │ │
│  │  • Plugins    │  │  │  │   Sidebar (15%)   │  │  │ │
│  │  • Events     │──┼─►│  │   ├ SidebarTitle  │  │  │ │
│  └──────────────┘  │  │  │   └ SidebarBody    │  │  │ │
│                     │  │  │      ├ DataSource  │  │  │ │
│                     │  │  │      └ Tree (DB)   │  │  │ │
│                     │  │  ├──────────────────┤  │  │ │
│                     │  │  │  Content (85%)    │  │  │ │
│                     │  │  │   ├ StatusBar     │  │  │ │
│                     │  │  │   ├ AIChat        │  │  │ │
│                     │  │  │   └ SystemSettings│  │  │ │
│                     │  │  │      (Modal)       │  │  │ │
│                     │  │  └──────────────────┘  │  │ │
│                     │  └────────────────────────┘  │ │
│                     └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key architectural decisions

| Layer | Technology | Role |
|-------|-----------|------|
| Desktop Shell | Tauri 2 | Window management, native APIs, menu/shortcut handling |
| Backend | Rust | Business logic, database drivers, file I/O |
| Frontend Framework | React 19 + TypeScript | UI rendering, state management |
| UI Components | Ant Design 6 + @ant-design/x | Chat bubbles, forms, tables, trees |
| Styling | Tailwind CSS 4 + CSS Modules | Utility-first + per-component styles |
| Build | Vite 7 | Frontend dev server and bundler |

### Component organization

Every component follows the **folder pattern**: `ComponentName/index.tsx` + `ComponentName/index.css`, co-locating logic and styles.

## Features

### Database Explorer
- Multi-source support: MySQL, Redis, Elasticsearch, and extensible via configuration.
- Lazy-loading tree structure for browsing tables, views, and functions.

### AI Chat Panel
- Conversational interface powered by configurable LLM backends (OpenAI, Anthropic, local models).
- Streaming responses, context memory, and message actions (copy, delete, replay).

### System Settings (Modal)
- **General**: Auto-start, language, update preferences.
- **Basic**: Query timeout, editor config, export defaults.
- **Model**: AI provider, API key, temperature, token limits.
- **Data Source**: CRUD management for connected databases.
- **Style**: Theme (light/dark/system), font, layout density.

### Keyboard Shortcuts (application-level)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + ,` | Toggle settings modal |
| `Cmd/Ctrl + R` | Refresh data |

Shortcuts only fire when the app window is focused — no interference with other applications.

## Project Structure

```
tql/
├── src/
│   ├── App.tsx                      # Root component, layout + modal + shortcuts
│   ├── App.css                      # App-level layout styles
│   ├── main.tsx                     # Entry point
│   └── components/
│       ├── AIChat/                  # AI chat panel
│       ├── ContentBody/             # Main content area
│       ├── SidebarBody/             # Sidebar: data source + DB tree
│       ├── SidebarTitle/            # Sidebar: app title
│       ├── StatusBar/               # Top bar: refresh + settings buttons
│       └── SystemSettings/          # Settings modal
│           ├── GeneralSettings/     #   General tab
│           ├── BasicSettings/       #   Basic tab
│           ├── ModelSettings/       #   Model tab
│           ├── DataSourceSettings/  #   Data source tab
│           └── StyleSettings/       #   Style tab
├── src-tauri/
│   ├── tauri.conf.json              # Tauri window & bundle config
│   ├── Cargo.toml                   # Rust dependencies
│   └── src/
│       ├── main.rs                  # Rust entry point
│       └── lib.rs                   # Tauri commands & plugin setup
├── package.json                     # Node dependencies & scripts
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config
└── README.md                        # This file
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/) >= 1.70
- OS-specific Tauri [prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

The output binary is located at `src-tauri/target/release/`.

## Tech Stack

| Category | Choice |
|----------|--------|
| Desktop Framework | Tauri 2 |
| Frontend | React 19, TypeScript 5.8 |
| UI Library | Ant Design 6.4, @ant-design/x 2.7 |
| CSS | Tailwind CSS 4, tw-animate-css |
| Icons | @ant-design/icons 6.2 |
| Font | Geist Variable |
| Build | Vite 7, @vitejs/plugin-react 4.6 |
| Package Manager | pnpm |

## License

MIT

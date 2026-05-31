# TQL — Text Query Language

[English](README.md)

TQL 是一款基于 Tauri 2、React 19 和 Ant Design 6 构建的跨平台桌面数据库查询工具。它提供统一界面来查询和管理多种数据源（MySQL、Redis、Elasticsearch 等），集成 AI 助手和系统设置面板，并通过应用级快捷键操控。

## 项目背景

现代数据工程师和开发者经常需要在多个数据库工具之间切换，这些工具 UI 不一致且存在上下文切换成本。TQL 的解决方案：

- **统一的查询界面** — 在同一工具中查询 SQL、NoSQL 和搜索引擎数据库。
- **集成 AI 对话面板** — 提供查询建议、解释和数据分析辅助。
- **应用级快捷键** — `Cmd/Ctrl+,` 打开设置、`Cmd/Ctrl+R` 刷新，仅在窗口聚焦时生效，不污染全局快捷键。
- **模块化设置系统** — 涵盖系统设置、基础设置、模型设置、数据源和样式设置。

## 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    Tauri 2 外壳                       │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  Rust 后端    │  │       WebView 前端            │ │
│  │  (lib.rs)     │  │  ┌────────────────────────┐  │ │
│  │               │  │  │        App.tsx          │  │ │
│  │  • Commands   │◄─┼──┤  ┌──────────────────┐  │  │ │
│  │  • Plugins    │  │  │  │   侧边栏 (15%)    │  │  │ │
│  │  • Events     │──┼─►│  │   ├ SidebarTitle  │  │  │ │
│  └──────────────┘  │  │  │   └ SidebarBody    │  │  │ │
│                     │  │  │      ├ 数据源选择  │  │  │ │
│                     │  │  │      └ 数据库树    │  │  │ │
│                     │  │  ├──────────────────┤  │  │ │
│                     │  │  │  内容区 (85%)     │  │  │ │
│                     │  │  │   ├ StatusBar     │  │  │ │
│                     │  │  │   ├ AIChat        │  │  │ │
│                     │  │  │   └ SystemSettings│  │  │ │
│                     │  │  │      (Modal弹窗)   │  │  │ │
│                     │  │  └──────────────────┘  │  │ │
│                     │  └────────────────────────┘  │ │
│                     └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 关键架构决策

| 层级 | 技术 | 职责 |
|------|------|------|
| 桌面外壳 | Tauri 2 | 窗口管理、原生 API、菜单/快捷键 |
| 后端 | Rust | 业务逻辑、数据库驱动、文件 I/O |
| 前端框架 | React 19 + TypeScript | UI 渲染、状态管理 |
| UI 组件库 | Ant Design 6 + @ant-design/x | 对话气泡、表单、表格、树形控件 |
| 样式 | Tailwind CSS 4 + CSS Modules | 原子化 CSS + 组件级样式 |
| 构建 | Vite 7 | 前端开发服务器与打包 |

### 组件组织规范

所有组件遵循**文件夹模式**：`组件名/index.tsx` + `组件名/index.css`，逻辑与样式内聚。

## 功能特性

### 数据库浏览器
- 多数据源支持：MySQL、Redis、Elasticsearch，可通过配置扩展。
- 懒加载树形结构，浏览数据表、视图、函数。

### AI 对话面板
- 支持多种 LLM 后端（OpenAI、Anthropic、本地模型）的对话式界面。
- 流式输出、上下文记忆、消息操作（复制、删除、重新播放）。

### 系统设置（Modal 弹窗）
- **系统设置**：自动启动、界面语言、更新策略。
- **基础设置**：查询超时、编辑器配置、导出默认值。
- **模型设置**：AI 提供商、API Key、Temperature、Token 限制。
- **数据源**：已连接数据库的增删改查管理。
- **样式设置**：主题（浅色/深色/跟随系统）、字体、布局密度。

### 应用级快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + ,` | 切换设置面板 |
| `Cmd/Ctrl + R` | 刷新数据 |

快捷键仅在应用窗口聚焦时触发，不会干扰其他应用。

## 项目结构

```
tql/
├── src/
│   ├── App.tsx                      # 根组件：布局 + Modal + 快捷键
│   ├── App.css                      # 应用级布局样式
│   ├── main.tsx                     # 入口文件
│   └── components/
│       ├── AIChat/                  # AI 对话面板
│       ├── ContentBody/             # 主内容区域
│       ├── SidebarBody/             # 侧边栏：数据源 + 数据库树
│       ├── SidebarTitle/            # 侧边栏：应用标题
│       ├── StatusBar/               # 顶部栏：刷新 + 设置按钮
│       └── SystemSettings/          # 设置弹窗
│           ├── GeneralSettings/     #   系统设置
│           ├── BasicSettings/       #   基础设置
│           ├── ModelSettings/       #   模型设置
│           ├── DataSourceSettings/  #   数据源
│           └── StyleSettings/       #   样式设置
├── src-tauri/
│   ├── tauri.conf.json              # Tauri 窗口与打包配置
│   ├── Cargo.toml                   # Rust 依赖
│   └── src/
│       ├── main.rs                  # Rust 入口
│       └── lib.rs                   # Tauri 命令与插件注册
├── package.json                     # Node 依赖与脚本
├── tsconfig.json                    # TypeScript 配置
├── vite.config.ts                   # Vite 配置
├── README.md                        # 英文文档
└── README.zh-CN.md                  # 本文件（中文文档）
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/) >= 1.70
- 各操作系统的 Tauri [前置依赖](https://v2.tauri.app/start/prerequisites/)

### 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（热更新）
pnpm tauri dev
```

### 构建

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/`。

## 技术栈

| 类别 | 选型 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19, TypeScript 5.8 |
| UI 组件库 | Ant Design 6.4, @ant-design/x 2.7 |
| CSS | Tailwind CSS 4, tw-animate-css |
| 图标 | @ant-design/icons 6.2 |
| 字体 | Geist Variable |
| 构建工具 | Vite 7, @vitejs/plugin-react 4.6 |
| 包管理器 | pnpm |

## 许可证

MIT

const raw = {
  app: {
    title: "TextQL 0.1.0",
    subtitle: "基于 LLM 的智能 SQL 客户端",
    refreshed: "数据已刷新",
  },
  statusBar: {
    refresh: "刷新",
    docs: "文档",
    settings: "设置",
  },
  sidebar: {
    dataSource: "数据源",
    database: "数据库",
    tables: "数据表",
    views: "视图",
    functions: "函数",
    ctx: {
      refresh: "刷新",
      copyName: "复制名称",
      newQuery: "新建查询",
      viewDdl: "查看 DDL/结构",
    },
    msg: {
      refreshed: "已刷新「{name}」",
      copied: "已复制「{name}」",
      copyFailed: "复制失败",
      queryTodo: "新建「{name}」查询（待接业务）",
      ddlTodo: "查看「{name}」DDL（待接业务）",
    },
  },
  aiChat: {
    placeholder: "输入消息...",
    greeting: "你好！有什么我可以帮你的？",
    copy: "复制",
    delete: "删除",
    play: "执行 SQL",
    stop: "停止",
    systemPrompt:
      "你是 TextQL，一个智能 SQL 客户端助手。" +
      "你的职责是帮助用户处理数据库相关任务：编写 SQL 查询、解释数据库概念、优化查询、设计表结构以及排查数据库问题。" +
      "\\n\\n你必须遵守以下规则：" +
      "\\n1. 只回答与数据库、SQL、数据分析、数据工程相关的问题。" +
      "\\n2. 对于任何与数据库或 SQL 无关的问题，礼貌拒绝回答。回复：'我是 SQL 助手，只能回答数据库相关的问题。'" +
      "\\n3. 编写 SQL 时始终考虑安全性——不要在没有用户明确确认和 WHERE 条件的情况下建议 DROP、TRUNCATE 或 DELETE 操作。" +
      "\\n4. 保持简洁，尽可能提供可直接执行的 SQL 语句。" +
      "\\n5. 如果用户的问题不够明确，请主动询问其数据库结构或具体意图。",
  },
  workspace: {
    aiTab: "AI 对话",
    sqlTab: "SQL 结果 {n}",
    sqlSection: "SQL 语句",
    resultSection: "执行结果",
    rowsAffected: "返回 {n} 行",
    emptyResult: "暂无结果",
  },
  settings: {
    modalTitle: "系统设置",
    save: "保存",
    reset: "重置",
    saved: "配置已保存",
    saveFailed: "保存失败: {error}",
    loaded: "已重新加载",
    loadFailed: "加载失败: {error}",
    loadingFailed: "加载配置失败: {error}",
    tabs: {
      general: "系统设置",
      basic: "基础设置",
      model: "模型设置",
      datasource: "数据源",
      style: "样式设置",
    },
    general: {
      title: "系统设置",
      sectionGeneral: "通用",
      autoStart: "自动启动",
      bootStart: "开机自启",
      minimizeToTray: "最小化到托盘",
      sectionLanguage: "语言与地区",
      language: "界面语言",
      sectionUpdate: "更新",
      autoUpdate: "自动检查更新",
    },
    basic: {
      title: "基础设置",
      sectionQuery: "查询",
      queryTimeout: "查询超时时间 (秒)",
      maxRows: "最大返回行数",
      autoComplete: "自动补全",
      sectionEditor: "编辑器",
      fontSize: "字体大小",
      tabWidth: "Tab 宽度",
      showLineNumber: "行号显示",
      syntaxHighlight: "语法高亮",
      sectionExport: "导出",
      exportFormat: "默认导出格式",
    },
    model: {
      title: "模型设置",
      sectionConfig: "AI 模型配置",
      provider: "模型提供商",
      providerDeepseek: "DeepSeek",
      providerLocal: "本地模型",
      apiUrl: "API 地址",
      apiKey: "API Key",
      modelName: "模型名称",
      sectionParams: "模型参数",
      sectionAdvanced: "高级选项",
      stream: "流式输出",
      contextMemory: "上下文记忆",
      addCustom: "添加自定义模型",
    },
    datasource: {
      title: "数据源",
      sectionConfigured: "已配置的数据源",
      add: "添加数据源",
      sectionDefaults: "连接默认值",
      connectTimeout: "连接超时 (秒)",
      enableSsl: "启用 SSL",
      poolSize: "连接池大小",
      colName: "名称",
      colType: "类型",
      colHost: "地址",
      colStatus: "状态",
      colAction: "操作",
      statusConnected: "已连接",
      statusDisconnected: "未连接",
      statusUntested: "未测试",
      sampleMysql: "本地 MySQL",
      sampleRedis: "开发 Redis",
      sampleEs: "ES 集群",
      addTitle: "添加数据源",
      editTitle: "编辑数据源",
      deleteConfirm: "确定要删除数据源「{name}」吗？",
      formName: "名称",
      formType: "类型",
      formHost: "主机地址",
      formPort: "端口",
      formUser: "用户名",
      formPassword: "密码",
      testConnection: "测试连接",
      testSuccess: "连接成功",
      testFailed: "连接失败: {error}",
      noConnections: "暂无数据源配置",
      loadingFailed: "加载数据库列表失败",
    },
    style: {
      title: "样式设置",
      sectionTheme: "主题",
      mode: "外观模式",
      modeLight: "浅色",
      modeDark: "深色",
      modeSystem: "跟随系统",
      themeColor: "主题色",
      colorBlue: "默认蓝",
      colorGreen: "翡翠绿",
      colorPurple: "暗夜紫",
      colorOrange: "活力橙",
      sectionFont: "字体",
      uiFont: "界面字体",
      uiFontSystem: "系统默认",
      monoFont: "等宽字体",
      fontScale: "字号缩放",
      sectionLayout: "布局",
      sidebarWidth: "侧边栏宽度",
      compact: "紧凑模式",
      animation: "显示动画",
    },
  },
} as const;

type DeepStringLeaves<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends object
      ? DeepStringLeaves<T[K]>
      : T[K];
};

export type Messages = DeepStringLeaves<typeof raw>;

const messages: Messages = raw;
export default messages;

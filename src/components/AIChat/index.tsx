import { Bubble, Sender, Prompts, Actions } from "@ant-design/x";
import type { ItemType } from "@ant-design/x/es/actions/interface";
import { XMarkdown } from "@ant-design/x-markdown";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  ClearOutlined,
  WarningOutlined,
  UserOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import { createAIService } from "../../services";
import type { ChatMessage, ToolDefinition, ParsedToolCall } from "../../services";
import { useModelConfig, useSettings } from "../../settings/SettingsContext";
import { Button, Space, Alert, message, BorderBeam, Avatar } from "antd";
import { listMysqlTables, listMysqlColumns, readDocument } from "../../db-api";
import CodeBlock from "./CodeBlock";
import "./index.css";

// ============================================================
// AIChat — AI chat panel
//
// This component only depends on the abstract AIService
// interface. It has zero knowledge of which provider
// (DeepSeek / OpenAI / Anthropic / local) is being used.
// ============================================================

interface Message {
  key: string;
  role: "assistant" | "user";
  content: string;
}

/** Extract SQL statements from AI response content */
function extractSqlStatements(content: string): string[] {
  // Extract SQL from markdown code blocks (```sql or ```)
  const codeBlockRegex = /```(?:sql)?\s*\n?([\s\S]*?)```/g;
  const matches: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const sql = match[1].trim();
    if (sql) matches.push(sql);
  }

  // If no code blocks, check if the whole content looks like SQL
  if (matches.length === 0) {
    const trimmed = content.trim();
    const sqlKeywords =
      /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REPLACE|WITH|EXPLAIN|SHOW|DESCRIBE|USE|GRANT|REVOKE|SET|BEGIN|COMMIT|ROLLBACK|CALL)\b/i;
    if (sqlKeywords.test(trimmed)) {
      matches.push(trimmed);
    }
  }

  return matches;
}

export interface DbContext {
  datasourceName: string;
  databaseName: string;
  dbType: string;
}

/** Lightweight execution context passed when the user runs SQL */
export interface SqlExecutionContext {
  datasourceName: string;
  databaseName: string;
}

interface AIChatProps {
  onRunSql?: (sql: string, context: SqlExecutionContext) => void;
  /** If set, the AI is focused on a specific database */
  databaseContext?: DbContext | null;
}

const MAX_TOOL_ROUNDS = 5;

/** Build tool definitions based on the current database context */
function buildTools(
  databaseContext: DbContext | null | undefined,
): ToolDefinition[] {
  if (!databaseContext || databaseContext.dbType !== "mysql") return [];

  return [
    {
      type: "function" as const,
      function: {
        name: "list_tables",
        description: `列出当前数据库「${databaseContext.databaseName}」中的所有表。无需参数。`,
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_table_schema",
        description: `获取当前数据库「${databaseContext.databaseName}」中指定表的字段结构信息，包括字段名、类型、是否可空、键类型、默认值。`,
        parameters: {
          type: "object",
          properties: {
            tableName: { type: "string", description: "要查询的表名" },
          },
          required: ["tableName"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_table_document",
        description: `获取当前数据库「${databaseContext.databaseName}」中指定表的技术文档（Markdown 格式），包含表的用途、字段详解、索引分析、关联关系和使用注意事项。`,
        parameters: {
          type: "object",
          properties: {
            tableName: { type: "string", description: "要查询文档的表名" },
          },
          required: ["tableName"],
        },
      },
    },
  ];
}

export default function AIChat({ onRunSql, databaseContext }: AIChatProps) {
  const t = useTranslation();
  const modelConfig = useModelConfig();
  const { settings } = useSettings();
  const [messageApi, msgCtx] = message.useMessage();

  const [messages, setMessages] = useState<Message[]>(() => [
    { key: "1", role: "assistant", content: t("aiChat.greeting") },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [streamingKey, setStreamingKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Copy message content to clipboard */
  const handleCopy = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content).then(
        () => messageApi.success(t("aiChat.copySuccess")),
        () => messageApi.error(t("aiChat.copyFailed")),
      );
    },
    [messageApi, t],
  );

  // (handleExecute reserved for future use — uses onRunSql directly in action items)

  // Document content for the current database context
  const [docContent, setDocContent] = useState<string | null>(null);

  // Derive a stable context identity for reset detection
  const contextId = databaseContext
    ? `${databaseContext.datasourceName}::${databaseContext.databaseName}`
    : null;

  // Reset messages & doc when switching to a different database
  useEffect(() => {
    setMessages([
      { key: "1", role: "assistant", content: t("aiChat.greeting") },
    ]);
    setDocContent(null);
  }, [contextId]);

  /** Load documentation when database context changes.
   *  Note: docs are now table-level (~/.config/tql/{ds}/{db}/{table}.md).
   *  There is no single database-level doc, so we skip auto-loading here.
   *  Table-level docs are loaded on-demand when the AI queries a specific table. */
  useEffect(() => {
    setDocContent(null);
  }, [databaseContext?.datasourceName, databaseContext?.databaseName, databaseContext?.dbType]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * System prompt — injected into every API call but never displayed in the UI.
   * Includes database context and saved documentation when available.
   */
  const systemPrompt = useMemo(() => {
    let prompt = t("aiChat.systemPrompt");
    if (databaseContext) {
      prompt += `\n\n## 当前连接的数据库信息`;
      prompt += `\n- 数据源: ${databaseContext.datasourceName}`;
      prompt += `\n- 数据库: ${databaseContext.databaseName}`;
      prompt += `\n- 类型: ${databaseContext.dbType === "mysql" ? "MySQL" : "Redis"}`;

      if (databaseContext.dbType === "mysql") {
        prompt += `\n\n## 可用工具`;
        prompt += `\n你可以使用以下工具来查询数据库信息：`;
        prompt += `\n- \`list_tables\`: 列出当前数据库中的所有表`;
        prompt += `\n- \`get_table_schema\`: 获取指定表的字段结构（字段名、类型、键、默认值等）`;
        prompt += `\n- \`get_table_document\`: 获取指定表的技术文档（Markdown 格式，包含用途、字段详解、索引分析等）`;
        prompt += `\n\n在回答用户问题前，优先使用工具获取真实的表结构和文档信息，而不是猜测。`;
      }
    }
    return prompt;
  }, [t, databaseContext, docContent]);

  /** Resolve DataSourceConfig from settings by name */
  const resolveDataSource = useCallback(
    (datasourceName: string) =>
      settings?.datasource.connections.find((c) => c.name === datasourceName) ?? null,
    [settings],
  );

  /**
   * Execute tool calls and return result messages.
   * Each tool call produces one ChatMessage with role "tool".
   */
  const executeTools = useCallback(
    async (toolCalls: ParsedToolCall[]): Promise<ChatMessage[]> => {
      if (!databaseContext) return [];

      const results: ChatMessage[] = [];
      const ds = resolveDataSource(databaseContext.datasourceName);

      for (const tc of toolCalls) {
        let content = "";
        try {
          switch (tc.name) {
            case "list_tables": {
              if (!ds) { content = "错误：无法获取数据源配置"; break; }
              const tables = await listMysqlTables(ds, databaseContext.databaseName);
              content = tables.length > 0
                ? `数据库「${databaseContext.databaseName}」中的表：\n${tables.map((t) => `- ${t}`).join("\n")}`
                : `数据库「${databaseContext.databaseName}」中没有任何表。`;
              break;
            }
            case "get_table_schema": {
              if (!ds) { content = "错误：无法获取数据源配置"; break; }
              const tableName = tc.arguments.tableName as string;
              if (!tableName) { content = "错误：缺少 tableName 参数"; break; }
              const cols = await listMysqlColumns(ds, databaseContext.databaseName, tableName);
              if (cols.length === 0) {
                content = `表「${tableName}」不存在或没有字段。`;
              } else {
                const rows = cols.map((c) =>
                  `- ${c.name} | ${c.colType} | ${c.nullable ? "可空" : "NOT NULL"} | 键:${c.key || "-"} | 默认:${c.default ?? "-"}`,
                );
                content = `表「${tableName}」的字段结构：\n${rows.join("\n")}`;
              }
              break;
            }
            case "get_table_document": {
              const tableName = tc.arguments.tableName as string;
              if (!tableName) { content = "错误：缺少 tableName 参数"; break; }
              try {
                const doc = await readDocument(databaseContext.datasourceName, databaseContext.databaseName, tableName);
                content = `表「${tableName}」的技术文档：\n\n${doc}`;
              } catch {
                content = `表「${tableName}」的文档尚未生成。建议用户在左侧表节点上右键选择「编辑文档」来生成。`;
              }
              break;
            }
            default:
              content = `未知工具: ${tc.name}`;
          }
        } catch (e) {
          content = `工具调用失败: ${e}`;
        }
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content,
        });
      }
      return results;
    },
    [databaseContext, resolveDataSource],
  );

  /**
   * Core chat loop: sends messages to AI, handles tool calls recursively.
   * Updates the aiKey message in-place with final content.
   */
  const runChatLoop = useCallback(
    async (
      apiMessages: ChatMessage[],
      aiKey: string,
      round: number = 0,
    ): Promise<void> => {
      if (round >= MAX_TOOL_ROUNDS) {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === aiKey
              ? { ...m, content: m.content + "\n\n⚠️ 已达到最大工具调用次数限制。" }
              : m,
          ),
        );
        setStreaming(false);
        setStreamingKey(null);
        abortRef.current = null;
        return;
      }

      const ai = createAIService(modelConfig);
      const tools = buildTools(databaseContext);
      let fullContent = "";
      let toolCallsReceived: ParsedToolCall[] = [];

      return new Promise<void>((resolve) => {
        const controller = ai.streamChat(
          apiMessages,
          {
            onChunk(content) {
              fullContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === aiKey ? { ...m, content: m.content + content } : m,
                ),
              );
            },
            onToolCalls(toolCalls) {
              toolCallsReceived = toolCalls;
            },
            async onComplete(_completeContent) {
              if (toolCallsReceived.length > 0) {
                const toolCallList = toolCallsReceived
                  .map((tc) => `  🔧 \`${tc.name}(${JSON.stringify(tc.arguments)})\``)
                  .join("\n");
                setMessages((prev) =>
                  prev.map((m) =>
                    m.key === aiKey
                      ? { ...m, content: fullContent + "\n\n正在查询数据库...\n" + toolCallList }
                      : m,
                  ),
                );

                const toolResults = await executeTools(toolCallsReceived);

                const assistantToolCalls = toolCallsReceived.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                  },
                }));

                const updatedApiMessages: ChatMessage[] = [
                  ...apiMessages,
                  {
                    role: "assistant",
                    content: fullContent || "",
                    tool_calls: assistantToolCalls,
                  },
                  ...toolResults,
                ];

                await runChatLoop(updatedApiMessages, aiKey, round + 1);
                resolve();
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.key === aiKey ? { ...m, content: fullContent } : m,
                  ),
                );
                setStreaming(false);
                setStreamingKey(null);
                abortRef.current = null;
                resolve();
              }
            },
            onError(error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === aiKey
                    ? { ...m, content: fullContent ? fullContent + `\n\n❌ ${error.message}` : `❌ ${error.message}` }
                    : m,
                ),
              );
              setStreaming(false);
              setStreamingKey(null);
              abortRef.current = null;
              resolve();
            },
          },
          undefined,
          tools,
        );
        abortRef.current = controller;
      });
    },
    [modelConfig, databaseContext, executeTools],
  );

  /** Regenerate AI response for a user message */
  const handleRegenerate = useCallback(
    (userKey: string, _userContent: string) => {
      if (streaming) return;

      const aiKey = (Date.now() + 1).toString();

      // Keep messages up to and including this user message
      const idx = messages.findIndex((m) => m.key === userKey);
      if (idx === -1) return;
      const keptConversation = messages.slice(0, idx + 1);

      // Build API messages from the kept conversation
      const apiMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
      ];
      for (const msg of keptConversation.filter((m) => m.key !== "1")) {
        apiMessages.push({ role: msg.role, content: msg.content });
      }

      // Add empty AI placeholder
      setMessages([
        ...keptConversation,
        { key: aiKey, role: "assistant", content: "" },
      ]);
      setStreamingKey(aiKey);
      setStreaming(true);

      runChatLoop(apiMessages, aiKey);
    },
    [streaming, messages, systemPrompt, runChatLoop],
  );

  /** Build chat messages array for the API (system prompt + history + new message) */
  const buildApiMessages = useCallback(
    (userContent: string): ChatMessage[] => {
      // System message goes first — invisible to the UI, visible to the model
      const apiMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
      ];

      // Skip initial greeting placeholders, include real conversation
      const conversation = messages.filter(
        (m) => m.key !== "1",
      );

      for (const msg of conversation) {
        apiMessages.push({ role: msg.role, content: msg.content });
      }

      apiMessages.push({ role: "user", content: userContent });
      return apiMessages;
    },
    [messages, systemPrompt],
  );

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || streaming) return;

    if (!databaseContext) {
      messageApi.warning("请先在左侧选择一个数据源和数据库，然后右键选择新建查询");
      return;
    }

    const userKey = Date.now().toString();
    const aiKey = (Date.now() + 1).toString();

    setInputValue("");

    setMessages((prev) => [
      ...prev,
      { key: userKey, role: "user", content: text },
    ]);

    setMessages((prev) => [
      ...prev,
      { key: aiKey, role: "assistant", content: "" },
    ]);
    setStreamingKey(aiKey);
    setStreaming(true);

    const apiMessages = buildApiMessages(text);
    runChatLoop(apiMessages, aiKey);
  },
    [streaming, buildApiMessages, databaseContext, messageApi, runChatLoop],
  );

  const handleClear = useCallback(() => {
    if (streaming) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
      setStreamingKey(null);
    }
    setMessages([]);
  }, [streaming]);


  const footer = (
    <Space.Compact
      style={{
        display: "flex",
        justifyContent: "flex-start",
        width: "100%",
        gap: 10,
      }}
    >
      <Button icon={<ClearOutlined />} type="text" onClick={handleClear} />
    </Space.Compact>
  );

  return (
    <div className="ai-chat-container">
      {msgCtx}
      {!databaseContext && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message="未关联数据库"
          description="请先在左侧选择一个数据源和数据库，右键选择「新建查询」开始对话。"
          style={{ marginBottom: 8 }}
          closable
        />
      )}
      {databaseContext && (
        <Alert
          type="info"
          title={
            <span>
              当前数据库: <strong>{databaseContext.databaseName}</strong>
              <span style={{ marginLeft: 12, color: "#888" }}>
                {databaseContext.datasourceName} · {databaseContext.dbType === "mysql" ? "MySQL" : "Redis"}
              </span>
            </span>
          }
          style={{ marginBottom: 8 }}
          closable
        />
      )}
      <div className="ai-chat-messages">
        {messages.map((msg) => {
          const isAssistant = msg.role === "assistant";
          const isStreaming = isAssistant && streaming && msg.key === streamingKey;
          const isGreeting = msg.key === "1";

          // Build action items per message
          const actionItems: ItemType[] = [];

          if (isAssistant) {
            // AI messages: copy + execute (if SQL found)
            actionItems.push({
              key: "copy",
              label: t("aiChat.copy"),
              icon: <CopyOutlined />,
              onItemClick: () => handleCopy(msg.content),
            });

            const sqls = extractSqlStatements(msg.content);
            if (onRunSql && sqls.length > 0) {
              if (sqls.length === 1) {
                actionItems.push({
                  key: "execute",
                  label: t("aiChat.play"),
                  icon: <PlayCircleOutlined />,
                  onItemClick: () =>
                    onRunSql(sqls[0], {
                      datasourceName: databaseContext!.datasourceName,
                      databaseName: databaseContext!.databaseName,
                    }),
                });
              } else {
                actionItems.push({
                  key: "execute",
                  label: t("aiChat.play"),
                  icon: <PlayCircleOutlined />,
                  subItems: sqls.map((sql, i) => ({
                    key: `execute-${i}`,
                    label:
                      sql.length > 60
                        ? sql.substring(0, 60) + "..."
                        : sql,
                    onItemClick: () =>
                      onRunSql(sql, {
                        datasourceName: databaseContext!.datasourceName,
                        databaseName: databaseContext!.databaseName,
                      }),
                  })),
                });
              }
            }
          } else {
            // User messages: copy + refresh (except greeting)
            actionItems.push({
              key: "copy",
              label: t("aiChat.copy"),
              icon: <CopyOutlined />,
              onItemClick: () => handleCopy(msg.content),
            });

            if (!isGreeting) {
              actionItems.push({
                key: "refresh",
                label: t("aiChat.regenerate"),
                icon: <SyncOutlined />,
                onItemClick: () =>
                  handleRegenerate(msg.key, msg.content),
              });
            }
          }

          return (
            <Bubble
              key={msg.key}
              placement={isAssistant ? "start" : "end"}
              variant={isAssistant ? "outlined" : "filled"}
              shape="corner"
              content={msg.content}
              streaming={isStreaming}
              typing={
                isAssistant && !isStreaming && msg.content.length > 0
                  ? { effect: "fade-in", step: 6, interval: 50 }
                  : false
              }
              avatar={
                isAssistant ? (
                  <Avatar
                    src="/logo-32.png"
                    style={{ backgroundColor: "#1677ff" }}
                  />
                ) : (
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                  />
                )
              }
              contentRender={
                isAssistant
                  ? (content: string) => (
                      <XMarkdown
                        content={content}
                        components={{ code: CodeBlock }}
                        streaming={{
                          hasNextChunk: isStreaming,
                          tail: { content: "▋" },
                        }}
                        openLinksInNewTab
                      />
                    )
                  : undefined
              }
              footer={
                actionItems.length > 0 ? (
                  <Actions items={actionItems} variant="borderless" />
                ) : undefined
              }
              footerPlacement="outer-start"
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-chat-input">
        <Prompts
          title=""
          items={[]}
        />
        <BorderBeam>
          <Sender
            allowSpeech={true}
            style={{ marginTop: 10 }}
            value={inputValue}
            onChange={(v) => setInputValue(v)}
            onSubmit={handleSubmit}
            submitType="enter"
            placeholder={t("aiChat.placeholder")}
            autoSize={{ minRows: 3, maxRows: 5 }}
            footer={footer}
            disabled={streaming}
          />
        </BorderBeam>
      </div>
    </div>
  );
}

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
import { useModelConfig } from "../../settings/SettingsContext";
import type { ChatMessage, StreamCallbacks } from "../../services";
import { Button, Space, Alert, message, BorderBeam, Avatar } from "antd";
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

export default function AIChat({ onRunSql, databaseContext }: AIChatProps) {
  const t = useTranslation();
  const modelConfig = useModelConfig();
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
        if (docContent) {
          prompt += `\n\n## 数据库文档（已生成）`;
          prompt += `\n以下是该数据库的完整技术文档，请基于此文档理解表结构、字段含义和表关系，在生成 SQL 时充分利用索引和表关系进行优化。记住：当用户要求增删改查时，使用 \`\`\`sql 代码块包裹 SQL 语句进行输出，不要加任何解释：\n`;
          prompt += `\n${docContent}`;
        } else {
          prompt += `\n\n## 数据库文档`;
          prompt += `\n⚠️ 该数据库的文档信息不存在，尚未初始化。如需了解表结构、字段含义和表关系，请使用左侧数据源树的右键菜单「生成文档」功能先生成一份技术文档。`;
          prompt += `\n\n在此期间，请基于数据库名称和常见的命名规范推断表结构，回答用户的问题。如果用户询问具体表结构或字段信息，建议用户先生成文档。`;
        }
      }
    }
    return prompt;
  }, [t, databaseContext, docContent]);

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

      const ai = createAIService(modelConfig);
      const callbacks: StreamCallbacks = {
        onChunk(content) {
          setMessages((prev) =>
            prev.map((m) =>
              m.key === aiKey ? { ...m, content: m.content + content } : m,
            ),
          );
        },
        onComplete(fullContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.key === aiKey ? { ...m, content: fullContent } : m,
            ),
          );
          setStreaming(false);
          setStreamingKey(null);
          abortRef.current = null;
        },
        onError(error) {
          setMessages((prev) =>
            prev.map((m) =>
              m.key === aiKey
                ? { ...m, content: `❌ ${error.message}` }
                : m,
            ),
          );
          setStreaming(false);
          setStreamingKey(null);
          abortRef.current = null;
        },
      };

      const controller = ai.streamChat(apiMessages, callbacks);
      abortRef.current = controller;
    },
    [streaming, messages, modelConfig, systemPrompt],
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

    // Require a data source to be selected before chatting
    if (!databaseContext) {
      messageApi.warning("请先在左侧选择一个数据源和数据库，然后右键选择新建查询");
      return;
    }

    const userKey = Date.now().toString();
    const aiKey = (Date.now() + 1).toString();

    // Clear input immediately on submit
    setInputValue("");

    // Add user message
    setMessages((prev) => [
      ...prev,
      { key: userKey, role: "user", content: text },
    ]);

    // Add empty AI placeholder — fills in as chunks arrive
    setMessages((prev) => [
      ...prev,
      { key: aiKey, role: "assistant", content: "" },
    ]);
    setStreamingKey(aiKey);
    setStreaming(true);

    // Provider-agnostic: AIChat doesn't know which model this is
    const ai = createAIService(modelConfig);
    const apiMessages = buildApiMessages(text);

    const callbacks: StreamCallbacks = {
      onChunk(content) {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === aiKey ? { ...m, content: m.content + content } : m,
          ),
        );
      },
      onComplete(fullContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === aiKey ? { ...m, content: fullContent } : m,
          ),
        );
        setStreaming(false);
        setStreamingKey(null);
        abortRef.current = null;
      },
      onError(error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === aiKey
              ? { ...m, content: `❌ ${error.message}` }
              : m,
          ),
        );
        setStreaming(false);
        setStreamingKey(null);
        abortRef.current = null;
      },
    };

    const controller = ai.streamChat(apiMessages, callbacks);
    abortRef.current = controller;
  },
    [streaming, modelConfig, buildApiMessages, databaseContext, messageApi],
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

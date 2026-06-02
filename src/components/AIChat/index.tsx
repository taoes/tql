import { Bubble, Sender, PromptsProps, Prompts } from "@ant-design/x";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  ClearOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import { createAIService } from "../../services";
import { useModelConfig } from "../../settings/SettingsContext";
import type { ChatMessage, StreamCallbacks } from "../../services";
import { Button, Space, Alert, message } from "antd";
import ButtonGroup from "antd/lib/button/ButtonGroup";
import { readDocument } from "../../db-api";
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

const roleConfig = {
  assistant: { placement: "start" as const },
  user: { placement: "end" as const },
};

const prompts: PromptsProps["items"] = [
  {
    key: "1",
    icon: <BulbOutlined style={{ color: "#FFD700" }} />,
    label: "Ignite Your Creativity",
    description: "Got any sparks for a new project?",
  },
  {
    key: "2",
    icon: <InfoCircleOutlined style={{ color: "#1890FF" }} />,
    label: "Uncover Background Info",
    description: "Help me understand the background of this topic.",
  },
];

export interface DbContext {
  datasourceName: string;
  databaseName: string;
  dbType: string;
}

interface AIChatProps {
  onRunSql?: (sql: string) => void;
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
  const [, setStreamingKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Document content for the current database context
  const [docContent, setDocContent] = useState<string | null>(null);

  /** Load documentation when database context changes */
  useEffect(() => {
    if (!databaseContext || databaseContext.dbType !== "mysql") {
      setDocContent(null);
      return;
    }
    let cancelled = false;
    readDocument(databaseContext.datasourceName, databaseContext.databaseName)
      .then((content) => {
        if (!cancelled) setDocContent(content);
      })
      .catch(() => {
        // Document not found — that's OK, we'll tell the AI
        if (!cancelled) setDocContent(null);
      });
    return () => { cancelled = true; };
  }, [databaseContext?.datasourceName, databaseContext?.databaseName, databaseContext?.dbType]);

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
          prompt += `\n以下是该数据库的完整技术文档，请基于此文档理解表结构、字段含义和表关系，在生成 SQL 时充分利用索引和表关系进行优化：\n`;
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

  /** Stop the current stream */
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamingKey(null);
  }, []);

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
          message={
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
        <Bubble.List items={messages} role={roleConfig} />
      </div>
      <div className="ai-chat-input">
        <Prompts
          title=""
          items={[]}
        />
        <Sender
          allowSpeech={false}
          style={{ marginTop: 10 }}
          onSubmit={handleSubmit}
          submitType="shiftEnter"
          placeholder={t("aiChat.placeholder")}
          autoSize={{ minRows: 3, maxRows: 5 }}
          footer={footer}
          disabled={streaming}
        />
      </div>
    </div>
  );
}

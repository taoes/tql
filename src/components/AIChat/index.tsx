import { Bubble, Sender, PromptsProps, Prompts } from "@ant-design/x";
import { useState, useRef, useCallback } from "react";
import {
  ClearOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import { createAIService } from "../../services";
import { useModelConfig } from "../../settings/SettingsContext";
import type { ChatMessage, StreamCallbacks } from "../../services";
import { Button, Space } from "antd";
import ButtonGroup from "antd/lib/button/ButtonGroup";
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

export default function AIChat() {
  const t = useTranslation();
  const modelConfig = useModelConfig();

  const [messages, setMessages] = useState<Message[]>(() => [
    { key: "1", role: "assistant", content: t("aiChat.greeting") },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [, setStreamingKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * System prompt — injected into every API call but never displayed in the UI.
   * Defines the assistant's identity, scope, and safety constraints.
   */
  const systemPrompt = t("aiChat.systemPrompt");

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
    [streaming, modelConfig, buildApiMessages],
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
      <div className="ai-chat-messages">
        <Bubble.List items={messages} role={roleConfig} />
      </div>
      <div className="ai-chat-input">
        <Prompts
          title=""
          items={prompts}
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

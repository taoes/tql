import { Bubble, Sender, Actions } from "@ant-design/x";
import { useMemo, useState } from "react";
import { CopyOutlined, PlaySquareOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import "./index.css";

interface Message {
  key: string;
  role: "ai" | "user";
  content: string;
}

interface AIChatProps {
  onRunSql?: (sql: string) => void;
}

const roleConfig = {
  ai: { placement: "start" as const },
  user: { placement: "end" as const },
};

export default function AIChat({ onRunSql }: AIChatProps) {
  const t = useTranslation();
  const [messages, setMessages] = useState<Message[]>(() => [
    { key: "1", role: "ai", content: t("aiChat.greeting") },
    { key: "2", role: "user", content: t("aiChat.greeting") },
  ]);

  const actionItems = useMemo(
    () => [
      { key: "copy", label: t("aiChat.copy"), icon: <CopyOutlined /> },
      { key: "remove", label: t("aiChat.delete"), danger: true, icon: <DeleteOutlined /> },
      { key: "play", icon: <PlaySquareOutlined />, label: t("aiChat.play") },
    ],
    [t]
  );

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      { key: Date.now().toString(), role: "user", content: text },
    ]);
  };

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-messages">
        {messages.map((msg) => (
          <Bubble
            key={msg.key}
            role={msg.role}
            content={msg.content}
            header={<h5>{msg.role}</h5>}
            {...roleConfig[msg.role]}
            footerPlacement="outer-end"
            footer={(content) => (
              <Actions
                items={actionItems}
                onClick={(info) => {
                  if (info.key === "play") {
                    onRunSql?.(String(content));
                  }
                }}
              />
            )}
          />
        ))}
      </div>
      <div className="ai-chat-input">
        <Sender
          style={{ height: "150px" }}
          onSubmit={handleSubmit}
          submitType="shiftEnter"
          placeholder={t("aiChat.placeholder")}
        />
      </div>
    </div>
  );
}

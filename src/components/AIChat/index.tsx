import { Bubble, Sender, Actions } from "@ant-design/x";
import { useState } from "react";
import { CopyOutlined, PlaySquareOutlined, DeleteOutlined } from "@ant-design/icons";
import "./index.css";

interface Message {
  key: string;
  role: "ai" | "user";
  content: string;
}

const roleConfig = {
  ai: { placement: "start" as const },
  user: { placement: "end" as const },
};

const actionItems = (content: string) => [
  {
    key: "copy",
    label: "Copy",
    icon: <CopyOutlined />,
  },
  {
    key: "remove",
    label: "Delete",
    danger: true,
    icon: <DeleteOutlined />,
  },
  {
    key: "play",
    icon: <PlaySquareOutlined />,
    label: "Play",
  },
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { key: "1", role: "ai", content: "你好！有什么我可以帮你的？" },
    { key: "2", role: "user", content: "你好！有什么我可以帮你的？" },
  ]);

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
                items={actionItems(content)}
                onClick={() => console.log(content)}
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
          placeholder="输入消息..."
        />
      </div>
    </div>
  );
}

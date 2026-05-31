import { Input, Select, Slider, Switch, Typography, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import "./index.css";

function ModelSettings() {
  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        模型设置
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">AI 模型配置</div>
        <div className="settings-row">
          <span className="settings-row-label">模型提供商</span>
          <Select
            defaultValue="openai"
            style={{ width: 180 }}
            options={[
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
              { value: "local", label: "本地模型" },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">API 地址</span>
          <Input defaultValue="https://api.openai.com/v1" style={{ width: 280 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">API Key</span>
          <Input.Password defaultValue="sk-********************************" style={{ width: 280 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">模型名称</span>
          <Select
            defaultValue="gpt-4o"
            style={{ width: 180 }}
            options={[
              { value: "gpt-4o", label: "GPT-4o" },
              { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
              { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
            ]}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">模型参数</div>
        <div className="settings-row">
          <span className="settings-row-label">Temperature</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: 260 }}>
            <Slider defaultValue={0.7} min={0} max={2} step={0.1} style={{ flex: 1 }} />
            <span style={{ width: 32, textAlign: "right", fontSize: "0.85rem" }}>0.7</span>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Max Tokens</span>
          <Slider defaultValue={4096} min={256} max={32768} step={256} style={{ width: 260, marginRight: 0 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Top P</span>
          <Slider defaultValue={1} min={0} max={1} step={0.05} style={{ width: 260, marginRight: 0 }} />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">高级选项</div>
        <div className="settings-row">
          <span className="settings-row-label">流式输出</span>
          <Switch defaultChecked />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">上下文记忆</span>
          <Switch defaultChecked />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Button type="dashed" icon={<PlusOutlined />}>
          添加自定义模型
        </Button>
      </div>
    </div>
  );
}

export default ModelSettings;

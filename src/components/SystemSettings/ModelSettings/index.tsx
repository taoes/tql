import { Input, Select, Slider, Switch, Typography, Button, AutoComplete } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ModelSettings as ModelSettingsType } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: ModelSettingsType;
  onChange: (next: ModelSettingsType) => void;
}

// ============================================================
// Provider presets — default URLs & model lists
// ============================================================
interface ProviderPreset {
  defaultApiUrl: string;
  defaultModel: string;
  models: { value: string; label: string }[];
}

const PROVIDER_PRESETS: Record<ModelSettingsType["provider"], ProviderPreset> = {
  openai: {
    defaultApiUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
  anthropic: {
    defaultApiUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  deepseek: {
    defaultApiUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek-V3 (Chat)" },
      { value: "deepseek-reasoner", label: "DeepSeek-R1 (Reasoner)" },
    ],
  },
  local: {
    defaultApiUrl: "http://localhost:11434/v1",
    defaultModel: "llama3",
    models: [
      { value: "llama3", label: "Llama 3" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "codellama", label: "Code Llama" },
    ],
  },
};

function ModelSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<ModelSettingsType>) => onChange({ ...value, ...p });

  const handleProviderChange = (provider: ModelSettingsType["provider"]) => {
    const preset = PROVIDER_PRESETS[provider];
    patch({
      provider,
      apiUrl: preset.defaultApiUrl,
      modelName: preset.defaultModel,
    });
  };

  const currentModels = PROVIDER_PRESETS[value.provider]?.models ?? [];

  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.model.title")}
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.model.sectionConfig")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.provider")}</span>
          <Select
            value={value.provider}
            onChange={handleProviderChange}
            style={{ width: 180 }}
            options={[
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
              { value: "deepseek", label: t("settings.model.providerDeepseek") },
              { value: "local", label: t("settings.model.providerLocal") },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.apiUrl")}</span>
          <Input
            value={value.apiUrl}
            onChange={(e) => patch({ apiUrl: e.target.value })}
            style={{ width: 280 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.apiKey")}</span>
          <Input.Password
            value={value.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
            style={{ width: 280 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.modelName")}</span>
          <AutoComplete
            value={value.modelName}
            onChange={(v) => patch({ modelName: v })}
            style={{ width: 220 }}
            options={currentModels}
            placeholder={t("settings.model.modelName")}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.model.sectionParams")}</div>
        <div className="settings-row">
          <span className="settings-row-label">Temperature</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: 260 }}>
            <Slider
              value={value.temperature}
              onChange={(v) => patch({ temperature: v as number })}
              min={0}
              max={2}
              step={0.1}
              style={{ flex: 1 }}
            />
            <span style={{ width: 32, textAlign: "right", fontSize: "0.85rem" }}>
              {value.temperature.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Max Tokens</span>
          <Slider
            value={value.maxTokens}
            onChange={(v) => patch({ maxTokens: v as number })}
            min={256}
            max={32768}
            step={256}
            style={{ width: 260, marginRight: 0 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Top P</span>
          <Slider
            value={value.topP}
            onChange={(v) => patch({ topP: v as number })}
            min={0}
            max={1}
            step={0.05}
            style={{ width: 260, marginRight: 0 }}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.model.sectionAdvanced")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.stream")}</span>
          <Switch checked={value.stream} onChange={(v) => patch({ stream: v })} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.model.contextMemory")}</span>
          <Switch
            checked={value.contextMemory}
            onChange={(v) => patch({ contextMemory: v })}
          />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Button type="dashed" icon={<PlusOutlined />}>
          {t("settings.model.addCustom")}
        </Button>
      </div>
    </div>
  );
}

export default ModelSettings;

import { Input, Select, Slider, Switch, Typography, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ModelSettings as ModelSettingsType } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: ModelSettingsType;
  onChange: (next: ModelSettingsType) => void;
}

function ModelSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<ModelSettingsType>) => onChange({ ...value, ...p });

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
            onChange={(v) => patch({ provider: v })}
            style={{ width: 180 }}
            options={[
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
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
          <Select
            value={value.modelName}
            onChange={(v) => patch({ modelName: v })}
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

import { Switch, InputNumber, Select, Typography } from "antd";
import { BasicSettings as BasicSettingsType } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: BasicSettingsType;
  onChange: (next: BasicSettingsType) => void;
}

function BasicSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<BasicSettingsType>) => onChange({ ...value, ...p });

  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.basic.title")}
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.basic.sectionQuery")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.queryTimeout")}</span>
          <InputNumber
            value={value.queryTimeout}
            onChange={(v) => patch({ queryTimeout: Number(v ?? 0) })}
            min={5}
            max={300}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.maxRows")}</span>
          <InputNumber
            value={value.maxRows}
            onChange={(v) => patch({ maxRows: Number(v ?? 0) })}
            min={100}
            max={100000}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.autoComplete")}</span>
          <Switch
            checked={value.autoComplete}
            onChange={(v) => patch({ autoComplete: v })}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.basic.sectionEditor")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.fontSize")}</span>
          <InputNumber
            value={value.fontSize}
            onChange={(v) => patch({ fontSize: Number(v ?? 0) })}
            min={10}
            max={24}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.tabWidth")}</span>
          <InputNumber
            value={value.tabWidth}
            onChange={(v) => patch({ tabWidth: Number(v ?? 0) })}
            min={1}
            max={8}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.showLineNumber")}</span>
          <Switch
            checked={value.showLineNumber}
            onChange={(v) => patch({ showLineNumber: v })}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.syntaxHighlight")}</span>
          <Switch
            checked={value.syntaxHighlight}
            onChange={(v) => patch({ syntaxHighlight: v })}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.basic.sectionExport")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.basic.exportFormat")}</span>
          <Select
            value={value.exportFormat}
            onChange={(v) => patch({ exportFormat: v })}
            style={{ width: 140 }}
            options={[
              { value: "csv", label: "CSV" },
              { value: "json", label: "JSON" },
              { value: "excel", label: "Excel" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default BasicSettings;

import { Switch, Select, Typography } from "antd";
import { GeneralSettings as GeneralSettingsType } from "../../../settings/types";
import { LOCALES, useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: GeneralSettingsType;
  onChange: (next: GeneralSettingsType) => void;
}

function GeneralSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<GeneralSettingsType>) => onChange({ ...value, ...p });

  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.general.title")}
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.general.sectionGeneral")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.general.autoStart")}</span>
          <Switch checked={value.autoStart} onChange={(v) => patch({ autoStart: v })} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.general.bootStart")}</span>
          <Switch checked={value.bootStart} onChange={(v) => patch({ bootStart: v })} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.general.minimizeToTray")}</span>
          <Switch
            checked={value.minimizeToTray}
            onChange={(v) => patch({ minimizeToTray: v })}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.general.sectionLanguage")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.general.language")}</span>
          <Select
            value={value.language}
            onChange={(v) => patch({ language: v })}
            style={{ width: 160 }}
            options={LOCALES}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.general.sectionUpdate")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.general.autoUpdate")}</span>
          <Switch checked={value.autoUpdate} onChange={(v) => patch({ autoUpdate: v })} />
        </div>
      </div>
    </div>
  );
}

export default GeneralSettings;

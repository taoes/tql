import { Select, Switch, InputNumber, Typography, Radio } from "antd";
import { StyleSettings as StyleSettingsType } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: StyleSettingsType;
  onChange: (next: StyleSettingsType) => void;
}

function StyleSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<StyleSettingsType>) => onChange({ ...value, ...p });

  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.style.title")}
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.style.sectionTheme")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.mode")}</span>
          <Radio.Group
            value={value.themeMode}
            onChange={(e) => patch({ themeMode: e.target.value })}
            optionType="button"
          >
            <Radio.Button value="light">{t("settings.style.modeLight")}</Radio.Button>
            <Radio.Button value="dark">{t("settings.style.modeDark")}</Radio.Button>
            <Radio.Button value="system">{t("settings.style.modeSystem")}</Radio.Button>
          </Radio.Group>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.themeColor")}</span>
          <Select
            value={value.themeColor}
            onChange={(v) => patch({ themeColor: v })}
            style={{ width: 140 }}
            options={[
              { value: "blue", label: t("settings.style.colorBlue") },
              { value: "green", label: t("settings.style.colorGreen") },
              { value: "purple", label: t("settings.style.colorPurple") },
              { value: "orange", label: t("settings.style.colorOrange") },
            ]}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.style.sectionFont")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.uiFont")}</span>
          <Select
            value={value.uiFont}
            onChange={(v) => patch({ uiFont: v })}
            style={{ width: 200 }}
            options={[
              { value: "geist", label: "Geist Variable" },
              { value: "inter", label: "Inter" },
              { value: "system", label: t("settings.style.uiFontSystem") },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.monoFont")}</span>
          <Select
            value={value.monoFont}
            onChange={(v) => patch({ monoFont: v })}
            style={{ width: 200 }}
            options={[
              { value: "mono", label: "Geist Mono" },
              { value: "fira", label: "Fira Code" },
              { value: "jetbrains", label: "JetBrains Mono" },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.fontScale")}</span>
          <InputNumber
            value={value.fontScale}
            onChange={(v) => patch({ fontScale: Number(v ?? 0) })}
            min={80}
            max={150}
            step={5}
            suffix="%"
            style={{ width: 120 }}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.style.sectionLayout")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.sidebarWidth")}</span>
          <InputNumber
            value={value.sidebarWidth}
            onChange={(v) => patch({ sidebarWidth: Number(v ?? 0) })}
            min={180}
            max={400}
            suffix="px"
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.compact")}</span>
          <Switch checked={value.compact} onChange={(v) => patch({ compact: v })} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.style.animation")}</span>
          <Switch checked={value.animation} onChange={(v) => patch({ animation: v })} />
        </div>
      </div>
    </div>
  );
}

export default StyleSettings;

import { useState } from "react";
import { Tabs, Button, Space, Spin, message } from "antd";
import {
  SettingOutlined,
  AppstoreOutlined,
  RobotOutlined,
  DatabaseOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import GeneralSettings from "./GeneralSettings";
import BasicSettings from "./BasicSettings";
import ModelSettings from "./ModelSettings";
import DataSourceSettings from "./DataSourceSettings";
import StyleSettings from "./StyleSettings";
import { useSettings } from "../../settings/SettingsContext";
import { DEFAULT_SETTINGS } from "../../settings/types";
import type { AppSettings } from "../../settings/types";
import { useI18n } from "../../i18n";
import "./index.css";

function SystemSettings() {
  const { t, setLocale } = useI18n();
  const { settings, loading, save, reload } = useSettings();
  const [activeKey, setActiveKey] = useState("general");
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Merge: start with loaded settings, track local edits
  const current = localSettings ?? settings ?? DEFAULT_SETTINGS;

  const update = <K extends keyof AppSettings>(key: K, next: AppSettings[K]) => {
    setLocalSettings((prev) => ({ ...(prev ?? current), [key]: next }));
    if (key === "general") {
      setLocale(next.general.language);
    }
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await save(localSettings);
      setLocalSettings(null);
      messageApi.success(t("settings.saved"));
    } catch (err) {
      messageApi.error(t("settings.saveFailed", { error: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await reload();
    setLocalSettings(null);
    messageApi.info(t("settings.loaded"));
  };

  const tabItems = [
    {
      key: "general",
      label: t("settings.tabs.general"),
      icon: <SettingOutlined />,
      children: (
        <GeneralSettings
          value={current.general}
          onChange={(v) => update("general", v)}
        />
      ),
    },
    {
      key: "basic",
      label: t("settings.tabs.basic"),
      icon: <AppstoreOutlined />,
      children: (
        <BasicSettings value={current.basic} onChange={(v) => update("basic", v)} />
      ),
    },
    {
      key: "model",
      label: t("settings.tabs.model"),
      icon: <RobotOutlined />,
      children: (
        <ModelSettings value={current.model} onChange={(v) => update("model", v)} />
      ),
    },
    {
      key: "datasource",
      label: t("settings.tabs.datasource"),
      icon: <DatabaseOutlined />,
      children: (
        <DataSourceSettings
          value={current.datasource}
          onChange={(v) => update("datasource", v)}
        />
      ),
    },
    {
      key: "style",
      label: t("settings.tabs.style"),
      icon: <BgColorsOutlined />,
      children: (
        <StyleSettings value={current.style} onChange={(v) => update("style", v)} />
      ),
    },
  ];

  return (
    <div className="system-settings">
      {contextHolder}
      <Spin spinning={loading}>
        <Tabs
          type="card"
          animated={true}
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          className="system-settings-tabs"
        />
      </Spin>
      <div className="system-settings-footer">
        <Space>
          <Button onClick={handleReset} disabled={loading || saving} danger>
            {t("settings.reset")}
          </Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
            {t("settings.save")}
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default SystemSettings;

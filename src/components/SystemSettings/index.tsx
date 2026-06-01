import { useEffect, useState } from "react";
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
import { AppSettings, DEFAULT_SETTINGS } from "../../settings/types";
import { loadSettings, saveSettings } from "../../settings/api";
import { useI18n } from "../../i18n";
import "./index.css";

function SystemSettings() {
  const { t, setLocale } = useI18n();
  const [activeKey, setActiveKey] = useState("general");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((err) => {
        if (!cancelled) messageApi.error(t("settings.loadingFailed", { error: String(err) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [messageApi, t]);

  const update = <K extends keyof AppSettings>(key: K, next: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: next }));
    if (key === "general") {
      const general = next as AppSettings["general"];
      setLocale(general.language);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      messageApi.success(t("settings.saved"));
    } catch (err) {
      messageApi.error(t("settings.saveFailed", { error: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const s = await loadSettings();
      setSettings(s);
      setLocale(s.general.language);
      messageApi.info(t("settings.loaded"));
    } catch (err) {
      messageApi.error(t("settings.loadFailed", { error: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: "general",
      label: t("settings.tabs.general"),
      icon: <SettingOutlined />,
      children: (
        <GeneralSettings
          value={settings.general}
          onChange={(v) => update("general", v)}
        />
      ),
    },
    {
      key: "basic",
      label: t("settings.tabs.basic"),
      icon: <AppstoreOutlined />,
      children: (
        <BasicSettings value={settings.basic} onChange={(v) => update("basic", v)} />
      ),
    },
    {
      key: "model",
      label: t("settings.tabs.model"),
      icon: <RobotOutlined />,
      children: (
        <ModelSettings value={settings.model} onChange={(v) => update("model", v)} />
      ),
    },
    {
      key: "datasource",
      label: t("settings.tabs.datasource"),
      icon: <DatabaseOutlined />,
      children: (
        <DataSourceSettings
          value={settings.datasource}
          onChange={(v) => update("datasource", v)}
        />
      ),
    },
    {
      key: "style",
      label: t("settings.tabs.style"),
      icon: <BgColorsOutlined />,
      children: (
        <StyleSettings value={settings.style} onChange={(v) => update("style", v)} />
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

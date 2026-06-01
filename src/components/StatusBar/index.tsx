import { Button, Space } from "antd";
import { ReloadOutlined, SettingOutlined, FileImageOutlined } from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import "./index.css";

interface StatusBarProps {
  onSettingsClick?: () => void;
}

function StatusBar({ onSettingsClick }: StatusBarProps) {
  const t = useTranslation();
  return (
    <div className="status-bar">
      <Space>
        <Button icon={<ReloadOutlined />}>{t("statusBar.refresh")}</Button>
        <Button icon={<FileImageOutlined />} onClick={onSettingsClick}>
          {t("statusBar.docs")}
        </Button>
        <Button icon={<SettingOutlined />} onClick={onSettingsClick}>
          {t("statusBar.settings")}
        </Button>
      </Space>
    </div>
  );
}

export default StatusBar;

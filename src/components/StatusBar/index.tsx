import { Button, Space } from "antd";
import { ReloadOutlined, SettingOutlined, FileImageOutlined } from "@ant-design/icons";
import "./index.css";

interface StatusBarProps {
  onSettingsClick?: () => void;
}

function StatusBar({ onSettingsClick }: StatusBarProps) {
  return (
    <div className="status-bar">
      <Space>
        <Button icon={<ReloadOutlined />}>刷新</Button>
        <Button icon={<FileImageOutlined />} onClick={onSettingsClick}>
          文档
        </Button>
        <Button icon={<SettingOutlined />} onClick={onSettingsClick}>
          设置
        </Button>
      </Space>
    </div>
  );
}

export default StatusBar;

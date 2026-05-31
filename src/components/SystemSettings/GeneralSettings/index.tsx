import { Switch, Select, Typography } from "antd";
import "./index.css";

function GeneralSettings() {
  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        系统设置
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">通用</div>
        <div className="settings-row">
          <span className="settings-row-label">自动启动</span>
          <Switch defaultChecked />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">开机自启</span>
          <Switch />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">最小化到托盘</span>
          <Switch defaultChecked />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">语言与地区</div>
        <div className="settings-row">
          <span className="settings-row-label">界面语言</span>
          <Select
            defaultValue="zh-CN"
            style={{ width: 160 }}
            options={[
              { value: "zh-CN", label: "简体中文" },
              { value: "en-US", label: "English" },
            ]}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">更新</div>
        <div className="settings-row">
          <span className="settings-row-label">自动检查更新</span>
          <Switch defaultChecked />
        </div>
      </div>
    </div>
  );
}

export default GeneralSettings;

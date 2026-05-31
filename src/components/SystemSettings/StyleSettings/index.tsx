import { Select, Switch, InputNumber, Typography, Radio } from "antd";
import "./index.css";

function StyleSettings() {
  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        样式设置
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">主题</div>
        <div className="settings-row">
          <span className="settings-row-label">外观模式</span>
          <Radio.Group defaultValue="light" optionType="button">
            <Radio.Button value="light">浅色</Radio.Button>
            <Radio.Button value="dark">深色</Radio.Button>
            <Radio.Button value="system">跟随系统</Radio.Button>
          </Radio.Group>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">主题色</span>
          <Select
            defaultValue="blue"
            style={{ width: 140 }}
            options={[
              { value: "blue", label: "默认蓝" },
              { value: "green", label: "翡翠绿" },
              { value: "purple", label: "暗夜紫" },
              { value: "orange", label: "活力橙" },
            ]}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">字体</div>
        <div className="settings-row">
          <span className="settings-row-label">界面字体</span>
          <Select
            defaultValue="geist"
            style={{ width: 200 }}
            options={[
              { value: "geist", label: "Geist Variable" },
              { value: "inter", label: "Inter" },
              { value: "system", label: "系统默认" },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">等宽字体</span>
          <Select
            defaultValue="mono"
            style={{ width: 200 }}
            options={[
              { value: "mono", label: "Geist Mono" },
              { value: "fira", label: "Fira Code" },
              { value: "jetbrains", label: "JetBrains Mono" },
            ]}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">字号缩放</span>
          <InputNumber defaultValue={100} min={80} max={150} step={5} suffix="%" style={{ width: 120 }} />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">布局</div>
        <div className="settings-row">
          <span className="settings-row-label">侧边栏宽度</span>
          <InputNumber defaultValue={260} min={180} max={400} suffix="px" style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">紧凑模式</span>
          <Switch />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">显示动画</span>
          <Switch defaultChecked />
        </div>
      </div>
    </div>
  );
}

export default StyleSettings;

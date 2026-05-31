import { Input, Switch, InputNumber, Select, Typography } from "antd";
import "./index.css";

function BasicSettings() {
  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        基础设置
      </Typography.Title>

      <div className="settings-section">
        <div className="settings-section-title">查询</div>
        <div className="settings-row">
          <span className="settings-row-label">查询超时时间 (秒)</span>
          <InputNumber defaultValue={30} min={5} max={300} style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">最大返回行数</span>
          <InputNumber defaultValue={1000} min={100} max={100000} style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">自动补全</span>
          <Switch defaultChecked />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">编辑器</div>
        <div className="settings-row">
          <span className="settings-row-label">字体大小</span>
          <InputNumber defaultValue={14} min={10} max={24} style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Tab 宽度</span>
          <InputNumber defaultValue={2} min={1} max={8} style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">行号显示</span>
          <Switch defaultChecked />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">语法高亮</span>
          <Switch defaultChecked />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">导出</div>
        <div className="settings-row">
          <span className="settings-row-label">默认导出格式</span>
          <Select
            defaultValue="csv"
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

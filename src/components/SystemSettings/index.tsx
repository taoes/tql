import { useState } from "react";
import { Tabs } from "antd";
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
import "./index.css";

const tabItems = [
  {
    key: "general",
    label: "系统设置",
    icon: <SettingOutlined />,
    children: <GeneralSettings />,
  },
  {
    key: "basic",
    label: "基础设置",
    icon: <AppstoreOutlined />,
    children: <BasicSettings />,
  },
  {
    key: "model",
    label: "模型设置",
    icon: <RobotOutlined />,
    children: <ModelSettings />,
  },
  {
    key: "datasource",
    label: "数据源",
    icon: <DatabaseOutlined />,
    children: <DataSourceSettings />,
  },
  {
    key: "style",
    label: "样式设置",
    icon: <BgColorsOutlined />,
    children: <StyleSettings />,
  },
];

function SystemSettings() {
  const [activeKey, setActiveKey] = useState("general");

  return (
    <div className="system-settings">
      <Tabs
        tabPosition="left"
        activeKey={activeKey}
        onChange={setActiveKey}
        items={tabItems}
        className="system-settings-tabs"
      />
    </div>
  );
}

export default SystemSettings;

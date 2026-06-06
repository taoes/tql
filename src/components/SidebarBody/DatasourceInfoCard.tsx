import { useState } from "react";
import { Button, Tag, Tooltip, message } from "antd";
import {
  CheckOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { DataSourceConfig } from "../../settings/types";

interface Props {
  config: DataSourceConfig;
  onRefresh?: () => void;
}

function DatasourceInfoCard({ config, onRefresh }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      messageApi.success("已复制");
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <div className="sidebar-ds-info">
      {contextHolder}
      <div className="sidebar-ds-info-header">
        <Tag
          color={config.dbType === "mysql" ? "geekblue" : "orange"}
          style={{ margin: 0 }}
        >
          {config.dbType === "mysql" ? "MySQL" : "Redis"}
        </Tag>
        <span className="sidebar-ds-info-name">{config.name}</span>
        <span className="sidebar-ds-info-actions">
          <Tooltip title="复制连接串">
            <Button
              type="text"
              size="small"
              icon={
                copiedField === "conn" ? (
                  <CheckOutlined style={{ color: "#52c41a" }} />
                ) : (
                  <LinkOutlined style={{ fontSize: 12 }} />
                )
              }
              onClick={() =>
                copyToClipboard(`${config.host}:${config.port}`, "conn")
              }
            />
          </Tooltip>
          <Tooltip title="刷新表列表">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined style={{ fontSize: 12 }} />}
              onClick={onRefresh}
            />
          </Tooltip>
        </span>
      </div>
      <div className="sidebar-ds-info-body">
        <div className="sidebar-ds-info-row">
          <EnvironmentOutlined className="sidebar-ds-info-icon" />
          <code className="sidebar-ds-info-value">{config.host}</code>
          <span className="sidebar-ds-info-sep">:</span>
          <code className="sidebar-ds-info-value">{config.port}</code>
        </div>
        {config.user && (
          <div className="sidebar-ds-info-row">
            <UserOutlined className="sidebar-ds-info-icon" />
            <code className="sidebar-ds-info-value">{config.user}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default DatasourceInfoCard;

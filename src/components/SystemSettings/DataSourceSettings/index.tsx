import { useMemo } from "react";
import { Button, InputNumber, Switch, Table, Typography, Space, Tag } from "antd";
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { DataSourceDefaults } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: DataSourceDefaults;
  onChange: (next: DataSourceDefaults) => void;
}

function DataSourceSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const patch = (p: Partial<DataSourceDefaults>) => onChange({ ...value, ...p });

  const connectedLabel = t("settings.datasource.statusConnected");

  const columns = useMemo(
    () => [
      {
        title: t("settings.datasource.colName"),
        dataIndex: "name",
        key: "name",
      },
      {
        title: t("settings.datasource.colType"),
        dataIndex: "type",
        key: "type",
        render: (type: string) => <Tag>{type}</Tag>,
      },
      {
        title: t("settings.datasource.colHost"),
        dataIndex: "host",
        key: "host",
      },
      {
        title: t("settings.datasource.colStatus"),
        dataIndex: "status",
        key: "status",
        render: (status: string) => (
          <Tag color={status === connectedLabel ? "green" : "red"}>{status}</Tag>
        ),
      },
      {
        title: t("settings.datasource.colAction"),
        key: "action",
        render: () => (
          <Space size="small">
            <Button size="small" icon={<ReloadOutlined />} type="text" />
            <Button size="small" icon={<DeleteOutlined />} type="text" danger />
          </Space>
        ),
      },
    ],
    [t, connectedLabel]
  );

  const mockData = useMemo(
    () => [
      {
        key: "1",
        name: t("settings.datasource.sampleMysql"),
        type: "MySQL",
        host: "localhost:3306",
        status: connectedLabel,
      },
      {
        key: "2",
        name: t("settings.datasource.sampleRedis"),
        type: "Redis",
        host: "10.0.1.20:6379",
        status: connectedLabel,
      },
      {
        key: "3",
        name: t("settings.datasource.sampleEs"),
        type: "Elasticsearch",
        host: "es.example.com:9200",
        status: t("settings.datasource.statusDisconnected"),
      },
    ],
    [t, connectedLabel]
  );

  return (
    <div className="settings-panel datasource-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.datasource.title")}
      </Typography.Title>

      <div className="settings-section">
        <div className="datasource-header">
          <span className="settings-section-title datasource-header-title">
            {t("settings.datasource.sectionConfigured")}
          </span>
          <Button type="primary" icon={<PlusOutlined />} size="small">
            {t("settings.datasource.add")}
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={mockData}
          pagination={false}
          size="small"
          style={{ marginTop: 8 }}
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("settings.datasource.sectionDefaults")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.connectTimeout")}</span>
          <InputNumber
            value={value.connectTimeout}
            onChange={(v) => patch({ connectTimeout: Number(v ?? 0) })}
            min={1}
            max={600}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.enableSsl")}</span>
          <Switch checked={value.enableSsl} onChange={(v) => patch({ enableSsl: v })} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.poolSize")}</span>
          <InputNumber
            value={value.poolSize}
            onChange={(v) => patch({ poolSize: Number(v ?? 0) })}
            min={1}
            max={100}
            style={{ width: 120 }}
          />
        </div>
      </div>
    </div>
  );
}

export default DataSourceSettings;

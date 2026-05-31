import { Button, Input, Switch, Table, Typography, Space, Tag } from "antd";
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import "./index.css";

const columns = [
  {
    title: "名称",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "类型",
    dataIndex: "type",
    key: "type",
    render: (type: string) => <Tag>{type}</Tag>,
  },
  {
    title: "地址",
    dataIndex: "host",
    key: "host",
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "已连接" ? "green" : "red"}>{status}</Tag>
    ),
  },
  {
    title: "操作",
    key: "action",
    render: () => (
      <Space size="small">
        <Button size="small" icon={<ReloadOutlined />} type="text" />
        <Button size="small" icon={<DeleteOutlined />} type="text" danger />
      </Space>
    ),
  },
];

const mockData = [
  { key: "1", name: "本地 MySQL", type: "MySQL", host: "localhost:3306", status: "已连接" },
  { key: "2", name: "开发 Redis", type: "Redis", host: "10.0.1.20:6379", status: "已连接" },
  { key: "3", name: "ES 集群", type: "Elasticsearch", host: "es.example.com:9200", status: "未连接" },
];

function DataSourceSettings() {
  return (
    <div className="settings-panel datasource-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        数据源
      </Typography.Title>

      <div className="settings-section">
        <div className="datasource-header">
          <span className="settings-section-title datasource-header-title">
            已配置的数据源
          </span>
          <Button type="primary" icon={<PlusOutlined />} size="small">
            添加数据源
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
        <div className="settings-section-title">连接默认值</div>
        <div className="settings-row">
          <span className="settings-row-label">连接超时 (秒)</span>
          <Input defaultValue="10" style={{ width: 120 }} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">启用 SSL</span>
          <Switch defaultChecked />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">连接池大小</span>
          <Input defaultValue="5" style={{ width: 120 }} />
        </div>
      </div>
    </div>
  );
}

export default DataSourceSettings;

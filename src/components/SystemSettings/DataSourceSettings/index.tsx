import { useMemo, useState } from "react";
import {
  Button,
  InputNumber,
  Switch,
  Table,
  Typography,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
} from "antd";
import { PlusOutlined, DeleteOutlined, ReloadOutlined, EditOutlined } from "@ant-design/icons";
import type { DatasourceSettings, DataSourceConfig, DbType } from "../../../settings/types";
import { testConnection, renameDocumentFolder } from "../../../db-api";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: DatasourceSettings;
  onChange: (next: DatasourceSettings) => void;
}

function DataSourceSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "fail" | null>(null);
  const [form] = Form.useForm();

  const patchDefaults = (p: Partial<DatasourceSettings["defaults"]>) =>
    onChange({ ...value, defaults: { ...value.defaults, ...p } });

  // ── Table columns ─────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        title: t("settings.datasource.colName"),
        dataIndex: "name",
        key: "name",
      },
      {
        title: t("settings.datasource.colType"),
        dataIndex: "dbType",
        key: "dbType",
        render: (dbType: DbType) => (
          <Tag color={dbType === "mysql" ? "blue" : "orange"}>
            {dbType === "mysql" ? "MySQL" : "Redis"}
          </Tag>
        ),
      },
      {
        title: t("settings.datasource.colHost"),
        key: "host",
        render: (_: unknown, row: DataSourceConfig) => `${row.host}:${row.port}`,
      },
      {
        title: t("settings.datasource.colStatus"),
        key: "status",
        render: () => <Tag>{t("settings.datasource.statusUntested")}</Tag>,
      },
      {
        title: t("settings.datasource.colAction"),
        key: "action",
        render: (_: unknown, row: DataSourceConfig) => (
          <Space size="small">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              type="text"
              onClick={() => handleTest(row)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              type="text"
              onClick={() => openEdit(row)}
            />
            <Button
              size="small"
              icon={<DeleteOutlined />}
              type="text"
              danger
              onClick={() => handleDelete(row)}
            />
          </Space>
        ),
      },
    ],
    [t],
  );

  // ── CRUD handlers ─────────────────────────────────────────
  const handleAdd = () => {
    setEditingId(null);
    setTestResult(null);
    form.resetFields();
    form.setFieldsValue({
      dbType: "mysql",
      host: "localhost",
      port: 3306,
      connectTimeout: value.defaults.connectTimeout,
      enableSsl: value.defaults.enableSsl,
    });
    setModalOpen(true);
  };

  const openEdit = (row: DataSourceConfig) => {
    setEditingId(row.id);
    setTestResult(null);
    form.setFieldsValue(row);
    setModalOpen(true);
  };

  const handleDelete = (row: DataSourceConfig) => {
    Modal.confirm({
      title: t("settings.datasource.deleteConfirm", { name: row.name }),
      okText: t("settings.save"),
      cancelText: t("settings.reset"),
      okButtonProps: { danger: true },
      onOk: () => {
        onChange({
          ...value,
          connections: value.connections.filter((c) => c.id !== row.id),
        });
      },
    });
  };

  const handleSave = async () => {
    try {
      const fields = await form.validateFields();
      const config: DataSourceConfig = {
        ...fields,
        id: editingId ?? crypto.randomUUID(),
      };

      if (editingId) {
        // If name changed, rename the docs folder to keep documents in sync
        const oldConn = value.connections.find((c) => c.id === editingId);
        if (oldConn && oldConn.name !== config.name) {
          renameDocumentFolder(oldConn.name, config.name).catch(() => {
            // Non-critical — don't block save if folder rename fails
          });
        }
        onChange({
          ...value,
          connections: value.connections.map((c) => (c.id === editingId ? config : c)),
        });
      } else {
        onChange({
          ...value,
          connections: [...value.connections, config],
        });
      }
      setModalOpen(false);
    } catch {
      // validation failed — Ant Design shows inline errors
    }
  };

  const handleTest = async (row?: DataSourceConfig) => {
    // If called from modal, read the current form values
    let config: DataSourceConfig;
    if (row) {
      config = row;
    } else {
      try {
        const fields = await form.validateFields();
        config = {
          ...(fields as DataSourceConfig),
          id: editingId ?? "temp-test",
        };
      } catch {
        return;
      }
    }

    setTesting(true);
    setTestResult(null);
    try {
      await testConnection(config);
      setTestResult("success");
      message.success(t("settings.datasource.testSuccess"));
    } catch (e) {
      setTestResult("fail");
      message.error(t("settings.datasource.testFailed", { error: String(e) }));
    } finally {
      setTesting(false);
    }
  };

  // ── Modal form ────────────────────────────────────────────
  const dbTypeVal: DbType = Form.useWatch("dbType", form) ?? "mysql";

  return (
    <div className="settings-panel datasource-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.datasource.title")}
      </Typography.Title>

      {/* Connection list */}
      <div className="settings-section">
        <div className="datasource-header">
          <span className="settings-section-title datasource-header-title">
            {t("settings.datasource.sectionConfigured")}
          </span>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
            {t("settings.datasource.add")}
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={value.connections}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginTop: 8 }}
          locale={{ emptyText: t("settings.datasource.noConnections") }}
        />
      </div>

      {/* Connection defaults */}
      <div className="settings-section">
        <div className="settings-section-title">{t("settings.datasource.sectionDefaults")}</div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.connectTimeout")}</span>
          <InputNumber
            value={value.defaults.connectTimeout}
            onChange={(v) => patchDefaults({ connectTimeout: Number(v ?? 0) })}
            min={1}
            max={600}
            style={{ width: 120 }}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.enableSsl")}</span>
          <Switch
            checked={value.defaults.enableSsl}
            onChange={(v) => patchDefaults({ enableSsl: v })}
          />
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t("settings.datasource.poolSize")}</span>
          <InputNumber
            value={value.defaults.poolSize}
            onChange={(v) => patchDefaults({ poolSize: Number(v ?? 0) })}
            min={1}
            max={100}
            style={{ width: 120 }}
          />
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={editingId ? t("settings.datasource.editTitle") : t("settings.datasource.addTitle")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={t("settings.save")}
        cancelText={t("settings.reset")}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("settings.datasource.formName")}
            rules={[
              { required: true, message: t("settings.datasource.formName") },
              {
                validator: (_: unknown, nameValue: string) => {
                  if (!nameValue) return Promise.resolve();
                  const duplicate = value.connections.find(
                    (c) =>
                      c.name === nameValue && c.id !== (editingId ?? ""),
                  );
                  if (duplicate) {
                    return Promise.reject(new Error(t("settings.datasource.duplicateName")));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="dbType" label={t("settings.datasource.formType")}>
            <Select
              options={[
                { value: "mysql", label: "MySQL" },
                { value: "redis", label: "Redis" },
              ]}
            />
          </Form.Item>

          <Space style={{ width: "100%" }} size="middle">
            <Form.Item
              name="host"
              label={t("settings.datasource.formHost")}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="port"
              label={t("settings.datasource.formPort")}
              style={{ width: 120 }}
            >
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
          </Space>

          {dbTypeVal === "mysql" && (
            <Form.Item name="user" label={t("settings.datasource.formUser")}>
              <Input />
            </Form.Item>
          )}

          <Form.Item name="password" label={t("settings.datasource.formPassword")}>
            <Input.Password />
          </Form.Item>

          <Form.Item name="connectTimeout" label={t("settings.datasource.connectTimeout")}>
            <InputNumber min={1} max={600} style={{ width: 160 }} addonAfter="s" />
          </Form.Item>

          <Form.Item name="enableSsl" label={t("settings.datasource.enableSsl")} valuePropName="checked">
            <Switch />
          </Form.Item>

          {dbTypeVal === "mysql" && (
            <Form.Item name="database" label={t("settings.datasource.formDatabase")}>
              <Input placeholder="可选，默认数据库 / Schema" />
            </Form.Item>
          )}

        </Form>

        <Button
          onClick={() => handleTest()}
          loading={testing}
          style={{ marginTop: 8 }}
          type={testResult === "success" ? "primary" : testResult === "fail" ? "dashed" : "default"}
          danger={testResult === "fail"}
        >
          {t("settings.datasource.testConnection")}
        </Button>
      </Modal>
    </div>
  );
}

export default DataSourceSettings;

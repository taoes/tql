import { useState } from "react";
import {
  Button,
  Input,
  Select,
  Slider,
  Switch,
  Table,
  Tag,
  Typography,
  Modal,
  Form,
  AutoComplete,
  Space,
  message,
  Empty,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { ModelConfig, ModelSettings as ModelSettingsType } from "../../../settings/types";
import { useTranslation } from "../../../i18n";
import "./index.css";

interface Props {
  value: ModelSettingsType;
  onChange: (next: ModelSettingsType) => void;
}

// ============================================================
// Provider presets — default URLs & model lists
// ============================================================
interface ProviderPreset {
  defaultApiUrl: string;
  defaultModel: string;
  models: { value: string; label: string }[];
}

const PROVIDER_PRESETS: Record<ModelConfig["provider"], ProviderPreset> = {
  openai: {
    defaultApiUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
  anthropic: {
    defaultApiUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  deepseek: {
    defaultApiUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek-V3 (Chat)" },
      { value: "deepseek-reasoner", label: "DeepSeek-R1 (Reasoner)" },
    ],
  },
  local: {
    defaultApiUrl: "http://localhost:11434/v1",
    defaultModel: "llama3",
    models: [
      { value: "llama3", label: "Llama 3" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "codellama", label: "Code Llama" },
    ],
  },
};

const DEFAULT_MODEL_CONFIG: Omit<ModelConfig, "id"> = {
  name: "",
  provider: "deepseek",
  apiUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  modelName: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  stream: true,
  contextMemory: true,
};

function ModelSettings({ value, onChange }: Props) {
  const t = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const activeModel = value.models.find((m) => m.id === value.activeModelId);

  // ── CRUD handlers ────────────────────────────────────────
  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ ...DEFAULT_MODEL_CONFIG });
    setModalOpen(true);
  };

  const handleEdit = (model: ModelConfig) => {
    setEditingId(model.id);
    form.setFieldsValue(model);
    setModalOpen(true);
  };

  const handleDelete = (model: ModelConfig) => {
    Modal.confirm({
      title: t("settings.model.deleteModelConfirm", { name: model.name }),
      okText: t("settings.save"),
      cancelText: t("settings.reset"),
      okButtonProps: { danger: true },
      onOk: () => {
        const nextModels = value.models.filter((m) => m.id !== model.id);
        const nextActiveId =
          value.activeModelId === model.id
            ? (nextModels[0]?.id ?? "")
            : value.activeModelId;
        onChange({ activeModelId: nextActiveId, models: nextModels });
      },
    });
  };

  const handleActivate = (model: ModelConfig) => {
    onChange({ ...value, activeModelId: model.id });
    message.success(`${t("settings.model.activeTag")}: ${model.name}`);
  };

  const handleSave = async () => {
    try {
      const fields = await form.validateFields();
      const config: ModelConfig = {
        ...fields,
        id: editingId ?? crypto.randomUUID(),
      };

      if (editingId) {
        onChange({
          ...value,
          models: value.models.map((m) => (m.id === editingId ? config : m)),
        });
      } else {
        const next = {
          models: [...value.models, config],
          // Auto-activate if it's the first model
          activeModelId: value.models.length === 0 ? config.id : value.activeModelId,
        };
        onChange(next);
      }
      setModalOpen(false);
    } catch {
      // validation failed — Ant Design shows inline errors
    }
  };

  // ── Table columns ────────────────────────────────────────
  const columns = [
    {
      title: t("settings.model.formName"),
      dataIndex: "name",
      key: "name",
      render: (name: string, row: ModelConfig) =>
        row.id === value.activeModelId ? (
          <Space>
            <strong>{name}</strong>
            <Tag color="blue" style={{ fontSize: 10, lineHeight: "16px" }}>
              {t("settings.model.activeTag")}
            </Tag>
          </Space>
        ) : (
          name
        ),
    },
    {
      title: t("settings.model.provider"),
      dataIndex: "provider",
      key: "provider",
      width: 120,
      render: (provider: ModelConfig["provider"]) => {
        const labels: Record<string, string> = {
          openai: "OpenAI",
          anthropic: "Anthropic",
          deepseek: "DeepSeek",
          local: t("settings.model.providerLocal"),
        };
        const colors: Record<string, string> = {
          openai: "green",
          anthropic: "purple",
          deepseek: "blue",
          local: "default",
        };
        return <Tag color={colors[provider]}>{labels[provider]}</Tag>;
      },
    },
    {
      title: t("settings.model.modelName"),
      dataIndex: "modelName",
      key: "modelName",
      ellipsis: true,
    },
    {
      title: t("settings.datasource.colAction"),
      key: "action",
      width: 180,
      render: (_: unknown, row: ModelConfig) => (
        <Space size="small">
          {row.id !== value.activeModelId && (
            <Button
              size="small"
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleActivate(row)}
            >
              {t("settings.model.activate")}
            </Button>
          )}
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(row)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(row)}
          />
        </Space>
      ),
    },
  ];

  const providerVal: ModelConfig["provider"] =
    Form.useWatch("provider", form) ?? "deepseek";
  const currentModels = PROVIDER_PRESETS[providerVal]?.models ?? [];

  return (
    <div className="settings-panel">
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        {t("settings.model.title")}
      </Typography.Title>

      {/* Active model indicator */}
      {activeModel && (
        <div className="settings-section">
          <div className="settings-section-title">
            {t("settings.model.activeModel")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag color="blue">{activeModel.name}</Tag>
            <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
              {activeModel.provider} · {activeModel.modelName}
            </span>
          </div>
        </div>
      )}

      {/* Model list */}
      <div className="settings-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span className="settings-section-title" style={{ marginBottom: 0 }}>
            {t("settings.model.modelList")}
          </span>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
            {t("settings.model.addModel")}
          </Button>
        </div>

        {value.models.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("settings.model.noModel")}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={value.models}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={
          editingId
            ? t("settings.model.editModel")
            : t("settings.model.addModel")
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={t("settings.save")}
        cancelText={t("settings.reset")}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("settings.model.formName")}
            rules={[{ required: true, message: t("settings.model.formName") }]}
          >
            <Input placeholder="DeepSeek V3" />
          </Form.Item>

          <Form.Item name="provider" label={t("settings.model.provider")}>
            <Select
              options={[
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "deepseek", label: t("settings.model.providerDeepseek") },
                { value: "local", label: t("settings.model.providerLocal") },
              ]}
              onChange={(provider: ModelConfig["provider"]) => {
                const preset = PROVIDER_PRESETS[provider];
                form.setFieldsValue({
                  apiUrl: preset.defaultApiUrl,
                  modelName: preset.defaultModel,
                });
              }}
            />
          </Form.Item>

          <Form.Item
            name="apiUrl"
            label={t("settings.model.apiUrl")}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="apiKey" label={t("settings.model.apiKey")}>
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="modelName"
            label={t("settings.model.modelName")}
            rules={[{ required: true }]}
          >
            <AutoComplete
              options={currentModels}
              placeholder={t("settings.model.modelName")}
            />
          </Form.Item>

          <Form.Item name="temperature" label="Temperature">
            <Slider
              min={0}
              max={2}
              step={0.1}
              marks={{ 0: "0", 0.7: "0.7", 1: "1", 2: "2" }}
            />
          </Form.Item>

          <Form.Item name="maxTokens" label="Max Tokens">
            <Slider
              min={256}
              max={32768}
              step={256}
              marks={{ 256: "256", 4096: "4K", 16384: "16K", 32768: "32K" }}
            />
          </Form.Item>

          <Form.Item name="topP" label="Top P">
            <Slider min={0} max={1} step={0.05} />
          </Form.Item>

          <Space size="large">
            <Form.Item
              name="stream"
              label={t("settings.model.stream")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="contextMemory"
              label={t("settings.model.contextMemory")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default ModelSettings;

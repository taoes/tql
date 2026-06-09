import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Spin, Alert, message, Tooltip, Space, Tag } from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import { useModelConfig } from "../../settings/SettingsContext";
import { createAIService } from "../../services";
import type { ChatMessage, StreamCallbacks } from "../../services";
import type { DataSourceConfig } from "../../settings/types";
import type { ColumnInfo } from "../../db-api";
import {
  readDocument,
  saveDocument,
  listMysqlColumns,
  listPgsqlColumns,
} from "../../db-api";
import "./index.css";

// ── Types ───────────────────────────────────────────────────────

interface DocEditorTabProps {
  datasourceName: string;
  dbName: string;
  tableName: string;
  dataSourceConfig: DataSourceConfig;
}

type Phase = "loading" | "editing" | "saving" | "generating" | "error";

// ── Prompt builders ──────────────────────────────────────────────

function buildRegeneratePrompt(
  datasourceName: string,
  dbName: string,
  tableName: string,
  columns: ColumnInfo[],
  existingContent: string,
): string {
  const lines: string[] = [];

  lines.push("你是一个数据库文档专家。请为以下数据表重新生成技术文档（Markdown 格式）。");
  lines.push("");
  lines.push("## 基本信息");
  lines.push(`- 数据源: ${datasourceName}`);
  lines.push(`- 数据库: ${dbName}`);
  lines.push(`- 表名: ${tableName}`);
  lines.push("");
  lines.push("## 表结构");
  lines.push("| 字段 | 类型 | 可空 | 键 | 默认值 |");
  lines.push("|------|------|------|-----|--------|");
  for (const col of columns) {
    const nullable = col.nullable ? "YES" : "NO";
    const key = col.key || "-";
    const def = col.default ?? "-";
    lines.push(`| ${col.name} | ${col.colType} | ${nullable} | ${key} | ${def} |`);
  }
  lines.push("");

  if (existingContent.trim()) {
    lines.push("## 当前文档内容（包含用户手动修改的硬性条件）");
    lines.push("");
    lines.push(existingContent);
    lines.push("");
    lines.push("## 要求");
    lines.push("请在**严格保留**当前文档中用户手动添加的硬性条件（如业务规则、数据约束、字段特殊说明、注意事项等）的基础上，重新生成完整的 Markdown 文档。");
    lines.push("");
    lines.push("**关键约束：**");
    lines.push("1. 用户手动添加的业务规则、数据约束、校验逻辑等硬性条件**必须原样保留**，不可删除或弱化。");
    lines.push("2. 如果用户添加了额外的字段说明、示例或注意事项，请保留并整合到新文档中。");
    lines.push("3. 根据最新的表结构调整字段类型和默认值等自动信息。");
    lines.push("4. 如果表结构有新增字段，请为新字段补充详细说明。");
  } else {
    lines.push("## 要求");
    lines.push("请生成完整的 Markdown 文档，结构清晰、内容详实。");
  }

  lines.push("");
  lines.push("文档应包含以下章节：");
  lines.push("1. **表概述** — 表的用途、业务场景和核心功能");
  lines.push("2. **字段详解** — 逐一分析每个字段的业务含义、数据类型选择理由、取值范围");
  lines.push("3. **索引分析** — 分析当前主键和索引的设计意图，给出优化建议");
  lines.push("4. **关联关系** — 根据外键和字段命名推断该表与其他表的关系");
  lines.push("5. **使用注意事项** — 数据写入规范、查询优化建议、常见陷阱");
  lines.push("");
  lines.push("请用中文编写，输出完整的 Markdown。");

  return lines.join("\n");
}

// ── Component ────────────────────────────────────────────────────

function DocEditorTab({
  datasourceName,
  dbName,
  tableName,
  dataSourceConfig,
}: DocEditorTabProps) {
  const t = useTranslation();
  const modelConfig = useModelConfig();
  const [messageApi, contextHolder] = message.useMessage();

  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [streamContent, setStreamContent] = useState("");
  const [hasDoc, setHasDoc] = useState(false);

  const contentRef = useRef(content);
  contentRef.current = content;

  // ── Load document on mount ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setErrorMsg(null);

    readDocument(datasourceName, dbName, tableName)
      .then((doc) => {
        if (cancelled) return;
        setContent(doc);
        setOriginalContent(doc);
        setHasDoc(true);
        setPhase("editing");
      })
      .catch(() => {
        if (cancelled) return;
        // Doc not found — start with empty editor
        setContent("");
        setOriginalContent("");
        setHasDoc(false);
        setPhase("editing");
      });

    return () => { cancelled = true; };
  }, [datasourceName, dbName, tableName]);

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setPhase("saving");
    setErrorMsg(null);
    try {
      const path = await saveDocument(datasourceName, dbName, tableName, contentRef.current);
      setOriginalContent(contentRef.current);
      setHasDoc(true);
      setPhase("editing");
      messageApi.success(t("docEditor.saveSuccess", { path }));
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
      messageApi.error(t("docEditor.saveFailed"));
    }
  }, [datasourceName, dbName, tableName, messageApi, t]);

  // ── (Re)generate via AI ───────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    if (!modelConfig) {
      messageApi.warning("请先配置 AI 模型");
      return;
    }

    setPhase("generating");
    setErrorMsg(null);
    setStreamContent("");

    try {
      // Fetch table schema
      const columns =
        dataSourceConfig.dbType === "postgresql"
          ? await listPgsqlColumns(dataSourceConfig, dbName, tableName)
          : await listMysqlColumns(dataSourceConfig, dbName, tableName);

      // Build prompt with existing content
      const prompt = buildRegeneratePrompt(
        datasourceName,
        dbName,
        tableName,
        columns,
        contentRef.current,
      );

      const ai = createAIService(modelConfig);
      const messages: ChatMessage[] = [{ role: "user", content: prompt }];

      let fullContent = "";

      ai.streamChat(messages, {
        onChunk(chunk) {
          fullContent += chunk;
          setStreamContent(fullContent);
        },
        onComplete: async (result) => {
          const finalContent = result || fullContent;
          setContent(finalContent);
          setStreamContent("");
          setHasDoc(true);
          setPhase("editing");
          // Auto-save after generation
          try {
            await saveDocument(datasourceName, dbName, tableName, finalContent);
            setOriginalContent(finalContent);
            messageApi.success(t("docEditor.saved"));
          } catch {
            // Save failed — user can manually save
          }
        },
        onError(error) {
          setPhase("error");
          setErrorMsg(error.message);
          setStreamContent("");
        },
      } as StreamCallbacks);
    } catch (e) {
      setPhase("error");
      setErrorMsg(String(e));
      setStreamContent("");
    }
  }, [modelConfig, dataSourceConfig, dbName, tableName, datasourceName, messageApi, t]);

  // ── Discard stream & go back to editing ────────────────────────
  const handleCancelGenerate = useCallback(() => {
    setPhase("editing");
    setStreamContent("");
    setErrorMsg(null);
  }, []);

  // ── Keyboard shortcut: Cmd/Ctrl+S to save ─────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (phase === "editing") handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleSave]);

  // ── Dirty state ───────────────────────────────────────────────
  const isDirty = content !== originalContent;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="doc-editor">
      {contextHolder}

      {/* Toolbar */}
      <div className="doc-editor-toolbar">
        <Space>
          <FileTextOutlined />
          <span className="doc-editor-table-name">{tableName}</span>
          <Tag color="geekblue" style={{ margin: 0 }}>{dbName}</Tag>
          {isDirty && (
            <Tag color="orange" style={{ margin: 0 }}>●</Tag>
          )}
        </Space>

        <Space>
          {phase === "generating" ? (
            <Button
              size="small"
              onClick={handleCancelGenerate}
            >
              {t("workspace.cancel")}
            </Button>
          ) : (
            <>
              <Tooltip title="Cmd/Ctrl+S">
                <Button
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={phase === "saving"}
                  disabled={!isDirty || phase !== "editing"}
                >
                  {t("docEditor.save")}
                </Button>
              </Tooltip>
              <Tooltip title={t("docEditor.regenerateTip")}>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRegenerate}
                  disabled={phase === "saving"}
                >
                  {hasDoc ? t("docEditor.regenerate") : t("docEditor.generate")}
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      {/* Error alert */}
      {phase === "error" && errorMsg && (
        <Alert
          type="error"
          icon={<CloseCircleOutlined />}
          showIcon
          message={errorMsg}
          closable
          onClose={() => { setPhase("editing"); setErrorMsg(null); }}
          style={{ margin: "8px 12px 0" }}
        />
      )}

      {/* Loading */}
      {phase === "loading" && (
        <div className="doc-editor-loading">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <p style={{ marginTop: 12 }}>加载文档...</p>
        </div>
      )}

      {/* Generating preview */}
      {phase === "generating" && (
        <div className="doc-editor-generating">
          <div className="doc-editor-generating-header">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
            <span>{hasDoc ? t("docEditor.regenerating") : t("docEditor.generating")}</span>
          </div>
          {streamContent ? (
            <pre className="doc-editor-preview">{streamContent.slice(-3000)}</pre>
          ) : (
            <div className="doc-editor-generating-wait">
              正在连接 AI 服务...
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {(phase === "editing" || phase === "saving" || phase === "error") && (
        <div className="doc-editor-body">
          {!hasDoc && !content && phase !== "error" ? (
            <div className="doc-editor-empty">
              <FileTextOutlined style={{ fontSize: 48 }} />
              <p>{t("docEditor.noContent")}</p>
            </div>
          ) : null}
          <Input.TextArea
            className="doc-editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# 表文档"
            disabled={phase === "saving"}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoSize={false}
            style={{
              flex: 1,
              fontFamily: "var(--font-mono, 'SF Mono', Monaco, Menlo, monospace)",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "none",
              border: "none",
              borderRadius: 0,
            }}
          />
        </div>
      )}

      {/* Status bar */}
      {phase === "editing" && (
        <div className="doc-editor-statusbar">
          <span className="doc-editor-statusbar-path">
            ~/.config/tql/{datasourceName}/{dbName}/{tableName}.md
          </span>
          {isDirty && (
            <span className="doc-editor-statusbar-dirty">未保存</span>
          )}
        </div>
      )}
    </div>
  );
}

export default DocEditorTab;

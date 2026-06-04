import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button, Menu, Select, Tree, Typography, message, Spin, Modal, Alert, Tag, Tooltip } from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined,
  FieldNumberOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useTranslation } from "../../i18n";
import { useSettings, useModelConfig } from "../../settings/SettingsContext";
import {
  listMysqlDatabases,
  listMysqlTables,
  listMysqlColumns,
  listRedisDatabases,
  saveDocument,
} from "../../db-api";
import { createAIService } from "../../services";
import type { ChatMessage, StreamCallbacks } from "../../services";
import type { DataSourceConfig } from "../../settings/types";
import type { ColumnInfo } from "../../db-api";
import "./index.css";

// ── Helpers ────────────────────────────────────────────────────

function updateTreeData(list: DataNode[], key: React.Key, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children) return { ...node, children: updateTreeData(node.children, key, children) };
    return node;
  });
}

interface ContextState {
  x: number;
  y: number;
  node: DataNode;
}

type DocGenPhase = "confirm" | "fetching" | "generating" | "done" | "error";

interface DocGenState {
  phase: DocGenPhase;
  dbName: string;
  datasourceName: string;
  streamContent: string;
  resultPath?: string;
  errorMessage?: string;
}

/** True if the tree key represents a MySQL database node (2 segments) */
function isMysqlDbNode(key: string): boolean {
  return key.startsWith("mysql:") && key.split(":").length === 2;
}

// ── Schema fetching & prompt building ──────────────────────────

interface TableSchema {
  name: string;
  columns: ColumnInfo[];
}

async function fetchDatabaseSchema(
  config: DataSourceConfig,
  dbName: string,
): Promise<TableSchema[]> {
  const tableNames = await listMysqlTables(config, dbName);
  const tables: TableSchema[] = [];
  for (const t of tableNames) {
    const cols = await listMysqlColumns(config, dbName, t);
    tables.push({ name: t, columns: cols });
  }
  return tables;
}

function buildDocPrompt(
  datasourceName: string,
  dbName: string,
  tables: TableSchema[],
): string {
  const lines: string[] = [];

  lines.push("你是一个数据库文档专家。请为以下 MySQL 数据库生成详细的技术文档（Markdown 格式）。");
  lines.push("");
  lines.push("## 数据源");
  lines.push(`- 名称: ${datasourceName}`);
  lines.push(`- 数据库: ${dbName}`);
  lines.push("");

  if (tables.length === 0) {
    lines.push("## ⚠️ 该数据库没有任何数据表");
    lines.push("");
    lines.push("该数据库当前为空，不包含任何表。");
    lines.push("");
    lines.push("## 要求");
    lines.push("请生成一个简短的 Markdown 文档，说明以下内容：");
    lines.push("1. **数据库状态** — 明确说明该数据库当前没有任何数据表，是一个空数据库。");
    lines.push("2. **建议** — 提示用户可以创建表来存储数据，但**不要**自行设计或创建任何表结构。");
    lines.push("");
    lines.push("**重要：不要编造任何表结构、字段或数据。数据库是空的，就如实说明。**");
    lines.push("");
    lines.push("请用中文编写，输出完整的 Markdown。");
    return lines.join("\n");
  }

  for (const table of tables) {
    lines.push(`### 表: ${table.name}`);
    lines.push("| 字段 | 类型 | 可空 | 键 | 默认值 |");
    lines.push("|------|------|------|-----|--------|");
    for (const col of table.columns) {
      const nullable = col.nullable ? "YES" : "NO";
      const key = col.key || "-";
      const def = col.default ?? "-";
      lines.push(`| ${col.name} | ${col.col_type} | ${nullable} | ${key} | ${def} |`);
    }
    lines.push("");
  }

  lines.push("## 要求");
  lines.push("请生成完整的 Markdown 文档，包含以下章节：");
  lines.push("1. **数据库概述** — 数据库的整体用途和业务特点");
  lines.push("2. **表结构详解** — 逐一分析每个表的用途和每个字段的业务含义");
  lines.push("3. **表关系分析** — 根据字段名、主键模式、外键命名推断表与表之间的关系");
  lines.push("4. **索引与性能建议** — 基于现有主键和字段特征给出索引优化建议");
  lines.push("5. **使用注意事项** — 数据一致性、约束、最佳实践");
  lines.push("");
  lines.push("请用中文编写，输出完整的 Markdown。");

  return lines.join("\n");
}

// ── Component ──────────────────────────────────────────────────

function SidebarBody({
  onSelectDs,
  onNewQuery,
}: {
  onSelectDs?: (name: string | null) => void;
  onNewQuery?: (ctx: { datasourceName: string; databaseName: string; dbType: string }) => void;
}) {
  const t = useTranslation();
  const { settings } = useSettings();
  const modelConfig = useModelConfig();
  const connections = settings?.datasource?.connections ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [docGen, setDocGen] = useState<DocGenState | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      messageApi.success("已复制");
      setTimeout(() => setCopiedField(null), 2000);
    });
  };
  const treeWrapRef = useRef<HTMLDivElement>(null);

  const selectedConfig = useMemo(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

  // Notify parent when selection changes (for docs folder button)
  useEffect(() => {
    onSelectDs?.(selectedConfig?.name ?? null);
  }, [selectedConfig, onSelectDs]);

  // ── Load root tree nodes when data source changes ────────────
  const loadRoot = useCallback(async () => {
    if (!selectedConfig) {
      setTreeData([]);
      return;
    }
    setLoadingTree(true);
    try {
      if (selectedConfig.dbType === "mysql") {
        const dbs = await listMysqlDatabases(selectedConfig);
        setTreeData(
          dbs.map((db) => ({
            title: db,
            key: `mysql:${db}`,
            isLeaf: false,
          })),
        );
      } else {
        const dbs = await listRedisDatabases(selectedConfig);
        setTreeData(
          dbs.map((info) => ({
            title: `DB${info.index}  (${info.key_count} keys)`,
            key: `redis:${info.index}`,
            isLeaf: true,
          })),
        );
      }
    } catch (e) {
      messageApi.error(t("settings.datasource.loadingFailed"));
      setTreeData([]);
    } finally {
      setLoadingTree(false);
    }
  }, [selectedConfig, messageApi, t]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // ── Lazy-load tree children ──────────────────────────────────
  const onLoadData = useCallback(
    (node: DataNode): Promise<void> =>
      new Promise<void>((resolve) => {
        if (node.children || !selectedConfig) {
          resolve();
          return;
        }

        const key = String(node.key);

        if (selectedConfig.dbType === "mysql") {
          if (key.startsWith("mysql:") && key.split(":").length === 2) {
            const dbName = key.replace("mysql:", "");
            listMysqlTables(selectedConfig, dbName)
              .then((tables) => {
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    tables.map((t) => ({
                      title: t,
                      key: `${key}:${t}`,
                      isLeaf: false,
                    })),
                  ),
                );
                resolve();
              })
              .catch((e) => {
                messageApi.error(String(e));
                resolve();
              });
            return;
          }

          if (key.startsWith("mysql:") && key.split(":").length === 3) {
            const parts = key.split(":");
            const dbName = parts[1];
            const tableName = parts.slice(2).join(":");
            listMysqlColumns(selectedConfig, dbName, tableName)
              .then((cols) => {
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    cols.map((col) => {
                      const pk = col.key === "PRI" ? " ⚷" : "";
                      const nullable = col.nullable ? "?" : "";
                      return {
                        title: `${col.name}  ${col.col_type}${nullable}${pk}`,
                        key: `${key}:${col.name}`,
                        isLeaf: true,
                        icon: <FieldNumberOutlined />,
                      };
                    }),
                  ),
                );
                resolve();
              })
              .catch((e) => {
                messageApi.error(String(e));
                resolve();
              });
            return;
          }
        }

        resolve();
      }),
    [selectedConfig, messageApi],
  );

  // ── Select options grouped by type ────────────────────────────
  const selectOptions = useMemo(() => {
    const groups: { label: string; options: { value: string; label: string }[] }[] = [];

    const mysqlConns = connections.filter((c) => c.dbType === "mysql");
    if (mysqlConns.length > 0) {
      groups.push({
        label: "MySQL",
        options: mysqlConns.map((c) => ({
          value: c.id,
          label: c.name,
        })),
      });
    }

    const redisConns = connections.filter((c) => c.dbType === "redis");
    if (redisConns.length > 0) {
      groups.push({
        label: "Redis",
        options: redisConns.map((c) => ({
          value: c.id,
          label: c.name,
        })),
      });
    }

    return groups;
  }, [connections]);

  // ── Context menu ──────────────────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const timer = window.setTimeout(() => {
      window.addEventListener("mousedown", close);
      window.addEventListener("contextmenu", close);
      window.addEventListener("resize", close);
      window.addEventListener("blur", close);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [ctxMenu]);

  // ── Menu items ──────────────────────────────────────────────
  const menuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      { key: "refresh", icon: <ReloadOutlined />, label: t("sidebar.ctx.refresh") },
      { key: "copy", icon: <CopyOutlined />, label: t("sidebar.ctx.copyName") },
    ];

    // "新建查询" and "生成文档" only for MySQL database nodes
    if (ctxMenu && isMysqlDbNode(String(ctxMenu.node.key))) {
      items.push({
        key: "newQuery",
        icon: <CodeOutlined />,
        label: t("sidebar.ctx.newQuery"),
      });
      items.push({
        key: "generateDoc",
        icon: <FileTextOutlined />,
        label: t("aiChat.generateDoc"),
      });
    }

    return items;
  }, [t, ctxMenu]);

  // ── Generate documentation handler ────────────────────────────
  const handleGenerateDoc = useCallback(() => {
    if (!ctxMenu || !selectedConfig) return;
    const node = ctxMenu.node;
    const dbName = String(node.key).replace("mysql:", "");

    setCtxMenu(null);
    // Open confirm modal
    setDocGen({
      phase: "confirm",
      dbName,
      datasourceName: selectedConfig.name,
      streamContent: "",
    });
  }, [ctxMenu, selectedConfig]);

  /** Called when user confirms generation */
  const startDocGeneration = useCallback(async () => {
    if (!docGen || !selectedConfig || !modelConfig) return;
    const { dbName, datasourceName } = docGen;

    // Phase: fetching schema
    setDocGen((prev) => prev && { ...prev, phase: "fetching" });

    try {
      const tables = await fetchDatabaseSchema(selectedConfig, dbName);

      // Phase: generating
      setDocGen((prev) => prev && { ...prev, phase: "generating", streamContent: "" });

      const prompt = buildDocPrompt(datasourceName, dbName, tables);
      const ai = createAIService(modelConfig);
      const messages: ChatMessage[] = [{ role: "user", content: prompt }];

      ai.streamChat(messages, {
        onChunk(content) {
          setDocGen((prev) =>
            prev ? { ...prev, streamContent: prev.streamContent + content } : null,
          );
        },
        onComplete: async (result) => {
          const finalContent = result;
          try {
            const filePath = await saveDocument(datasourceName, dbName, finalContent);
            setDocGen((prev) =>
              prev ? { ...prev, phase: "done", resultPath: filePath } : null,
            );
          } catch (e) {
            setDocGen((prev) =>
              prev
                ? { ...prev, phase: "error", errorMessage: String(e) }
                : null,
            );
          }
        },
        onError(error) {
          setDocGen((prev) =>
            prev
              ? { ...prev, phase: "error", errorMessage: error.message }
              : null,
          );
        },
      } as StreamCallbacks);
    } catch (e) {
      setDocGen((prev) =>
        prev ? { ...prev, phase: "error", errorMessage: String(e) } : null,
      );
    }
  }, [docGen, selectedConfig, modelConfig]);

  const closeDocGen = useCallback(() => setDocGen(null), []);

  // ── Modal footer — varies by generation phase ────────────────
  const docGenFooter = useMemo(() => {
    if (!docGen) return null;
    switch (docGen.phase) {
      case "confirm":
        return (
          <>
            <Button onClick={closeDocGen}>{t("settings.reset")}</Button>
            <Button type="primary" onClick={startDocGeneration}>
              {t("settings.save")}
            </Button>
          </>
        );
      case "fetching":
      case "generating":
        return null;
      case "done":
        return (
          <Button type="primary" onClick={closeDocGen}>
            关闭
          </Button>
        );
      case "error":
        return (
          <>
            <Button onClick={closeDocGen}>关闭</Button>
            <Button type="primary" onClick={startDocGeneration}>
              重试
            </Button>
          </>
        );
    }
  }, [docGen, closeDocGen, startDocGeneration, t]);

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!ctxMenu) return;
    const node = ctxMenu.node;
    const title = String(node.title ?? node.key);

    switch (key) {
      case "refresh":
        setTreeData((origin) => updateTreeData(origin, node.key, []));
        messageApi.success(t("sidebar.msg.refreshed", { name: title }));
        setCtxMenu(null);
        break;
      case "copy": {
        // Extract clean name: for column nodes strip type info (e.g. "id  int?⚷" → "id")
        const copyText =
          title.includes("  ")
            ? title.split("  ")[0]
            : title;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(copyText)
            .then(() => messageApi.success(t("sidebar.msg.copied", { name: copyText })))
            .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        } else {
          // Fallback for environments without clipboard API
          try {
            const ta = document.createElement("textarea");
            ta.value = copyText;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            messageApi.success(t("sidebar.msg.copied", { name: copyText }));
          } catch {
            messageApi.error(t("sidebar.msg.copyFailed"));
          }
        }
        setCtxMenu(null);
        break;
      }
      case "newQuery": {
        if (!selectedConfig) break;
        const dbName = String(node.key).replace("mysql:", "");
        onNewQuery?.({
          datasourceName: selectedConfig.name,
          databaseName: dbName,
          dbType: selectedConfig.dbType,
        });
        setCtxMenu(null);
        break;
      }
      case "generateDoc":
        handleGenerateDoc();
        break;
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="sidebar-body">
      {contextHolder}
      <div className="sidebar-body-section">
        <Typography.Text type="secondary">{t("sidebar.dataSource")}</Typography.Text>
        <Select
          value={selectedId}
          onChange={setSelectedId}
          options={selectOptions}
          style={{ width: "100%", height: "32px" }}
          placeholder={
            connections.length > 0
              ? t("settings.datasource.selectPlaceholder")
              : t("settings.datasource.noConnections")
          }
          notFoundContent={t("settings.datasource.noConnections")}
        />
      </div>

      {/* Selected data source info card */}
      {selectedConfig && (
        <div className="sidebar-ds-info">
          <div className="sidebar-ds-info-header">
            <Tag
              color={selectedConfig.dbType === "mysql" ? "geekblue" : "orange"}
              style={{ margin: 0 }}
            >
              {selectedConfig.dbType === "mysql" ? "MySQL" : "Redis"}
            </Tag>
            <span className="sidebar-ds-info-name">{selectedConfig.name}</span>
            <Tooltip title="复制连接串">
              <Button
                className="sidebar-ds-info-copy-btn"
                type="text"
                size="small"
                icon={copiedField === "conn" ? <CheckOutlined style={{ color: "#52c41a" }} /> : <LinkOutlined style={{ fontSize: 12 }} />}
                onClick={() => copyToClipboard(`${selectedConfig.host}:${selectedConfig.port}`, "conn")}
              />
            </Tooltip>
          </div>
          <div className="sidebar-ds-info-body">
            <div className="sidebar-ds-info-row">
              <EnvironmentOutlined className="sidebar-ds-info-icon" />
              <code className="sidebar-ds-info-value">{selectedConfig.host}</code>
              <span className="sidebar-ds-info-sep">:</span>
              <code className="sidebar-ds-info-value">{selectedConfig.port}</code>
              {selectedConfig.user && (
                <div className="sidebar-ds-info-row">
                  <UserOutlined className="sidebar-ds-info-icon" />
                  <code className="sidebar-ds-info-value">{selectedConfig.user}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-body-section sidebar-tree" ref={treeWrapRef}>
        <Typography.Text type="secondary">{t("sidebar.database")}</Typography.Text>
        {loadingTree ? (
          <Spin style={{ marginTop: 12 }} />
        ) : (
          <Tree
            loadData={onLoadData}
            treeData={treeData}
            showIcon
            blockNode
            disabled={docGen !== null}
            onRightClick={({ event, node }) => {
              event.preventDefault();
              event.stopPropagation();
              setCtxMenu({ x: event.clientX, y: event.clientY, node });
            }}
          />
        )}
      </div>

      {ctxMenu &&
        createPortal(
          <div
            className="sidebar-tree-ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Menu
              items={menuItems}
              onClick={handleMenuClick}
              selectable={false}
            />
          </div>,
          document.body,
        )}

      {/* ── Document Generation Modal ─────────────────────────── */}
      <Modal
        title={t("aiChat.generateDocTitle")}
        open={docGen !== null}
        onCancel={closeDocGen}
        footer={docGenFooter}
        maskClosable={false}
        closable={docGen?.phase !== "fetching" && docGen?.phase !== "generating"}
        width={720}
      >
        {docGen?.phase === "confirm" && (
          <p>{t("aiChat.generateDocConfirm", { name: docGen.dbName })}</p>
        )}

        {(docGen?.phase === "fetching" || docGen?.phase === "generating") && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            <p style={{ marginTop: 12, color: "#888" }}>
              {docGen.phase === "fetching"
                ? "正在获取表结构..."
                : "正在生成文档..."}
            </p>
            {docGen.phase === "generating" && docGen.streamContent && (
              <div
                style={{
                  marginTop: 16,
                  maxHeight: 360,
                  overflow: "auto",
                  textAlign: "left",
                  background: "#fafafa",
                  borderRadius: 8,
                  padding: 16,
                  fontFamily: "monospace",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {docGen.streamContent.slice(-2000)}
              </div>
            )}
          </div>
        )}

        {docGen?.phase === "done" && (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message="文档生成完成"
            description={t("aiChat.generateDocSuccess", { path: docGen.resultPath ?? "" })}
          />
        )}

        {docGen?.phase === "error" && (
          <Alert
            type="error"
            icon={<CloseCircleOutlined />}
            showIcon
            message="生成失败"
            description={docGen.errorMessage}
          />
        )}
      </Modal>
    </div>
  );
}

export default SidebarBody;

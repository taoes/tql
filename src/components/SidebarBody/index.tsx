import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Menu, Select, Tree, Typography, message, Spin, Modal } from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined,
  FieldNumberOutlined,
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

function SidebarBody() {
  const t = useTranslation();
  const { settings } = useSettings();
  const modelConfig = useModelConfig();
  const connections = settings?.datasource?.connections ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const treeWrapRef = useRef<HTMLDivElement>(null);

  const selectedConfig = useMemo(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

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
          label: `${c.name} (${c.host}:${c.port})`,
        })),
      });
    }

    const redisConns = connections.filter((c) => c.dbType === "redis");
    if (redisConns.length > 0) {
      groups.push({
        label: "Redis",
        options: redisConns.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.host}:${c.port})`,
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

  // ── Menu items: "生成文档" only for MySQL database nodes ──────
  const menuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      { key: "copy", icon: <CopyOutlined />, label: t("sidebar.ctx.copyName") },
      { key: "query", icon: <CodeOutlined />, label: t("sidebar.ctx.newQuery") },
      { key: "refresh", icon: <ReloadOutlined />, label: t("sidebar.ctx.refresh") },
    ];

    // Add "生成文档" if right-clicked node is a MySQL database
    if (ctxMenu && isMysqlDbNode(String(ctxMenu.node.key))) {
      items.push({
        key: "generateDoc",
        icon: <FileTextOutlined />,
        label: t("aiChat.generateDoc"),
      });
    }

    return items;
  }, [t, ctxMenu]);

  // ── Generate documentation handler ────────────────────────────
  const handleGenerateDoc = useCallback(async () => {
    if (!ctxMenu || !selectedConfig) return;
    const node = ctxMenu.node;
    const dbName = String(node.key).replace("mysql:", "");
    const datasourceName = selectedConfig.name;

    setCtxMenu(null);

    Modal.confirm({
      title: t("aiChat.generateDocTitle"),
      content: t("aiChat.generateDocConfirm", { name: dbName }),
      okText: t("settings.save"),
      cancelText: t("settings.reset"),
      onOk: async () => {
        setGenerating(true);
        const hideLoading = messageApi.loading("正在获取表结构...", 0);

        try {
          // 1. Fetch full schema
          const tables = await fetchDatabaseSchema(selectedConfig, dbName);
          hideLoading();
          messageApi.info(`已获取 ${tables.length} 个表，正在生成文档...`, 2);

          // 2. Build prompt & call AI
          const prompt = buildDocPrompt(datasourceName, dbName, tables);
          const ai = createAIService(modelConfig);
          const messages: ChatMessage[] = [
            { role: "user", content: prompt },
          ];

          let fullContent = "";

          ai.streamChat(messages, {
            onChunk(content) {
              fullContent += content;
            },
            onComplete: async (result) => {
              try {
                const filePath = await saveDocument(
                  datasourceName,
                  dbName,
                  result || fullContent,
                );
                messageApi.success(
                  t("aiChat.generateDocSuccess", { path: filePath }),
                  5,
                );
              } catch (e) {
                messageApi.error(
                  t("aiChat.generateDocFailed", { error: String(e) }),
                );
              }
              setGenerating(false);
            },
            onError(error) {
              messageApi.error(
                t("aiChat.generateDocFailed", { error: error.message }),
              );
              setGenerating(false);
            },
          } as StreamCallbacks);
        } catch (e) {
          hideLoading();
          messageApi.error(
            t("aiChat.generateDocFailed", { error: String(e) }),
          );
          setGenerating(false);
        }
      },
    });
  }, [ctxMenu, selectedConfig, modelConfig, messageApi, t]);

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
      case "copy":
        navigator.clipboard
          ?.writeText(title)
          .then(() => messageApi.success(t("sidebar.msg.copied", { name: title })))
          .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        setCtxMenu(null);
        break;
      case "query":
        messageApi.info(t("sidebar.msg.queryTodo", { name: title }));
        setCtxMenu(null);
        break;
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
          placeholder={t("settings.datasource.noConnections")}
          notFoundContent={t("settings.datasource.noConnections")}
        />
      </div>

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
            disabled={generating}
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
    </div>
  );
}

export default SidebarBody;

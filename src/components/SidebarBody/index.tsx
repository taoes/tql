import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Select, Tree, Typography, message } from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useTranslation } from "../../i18n";
import "./index.css";

const dataSources = [
  {
    group: "MySQL",
    items: [
      { value: "mysql-local", label: "localhost:3306" },
      { value: "mysql-dev", label: "10.0.1.12:3306" },
      { value: "mysql-prod", label: "prod-mysql.example.com:3306" },
    ],
  },
  {
    group: "Redis",
    items: [
      { value: "redis-local", label: "localhost:6379" },
      { value: "redis-dev", label: "10.0.1.20:6379" },
      { value: "redis-prod", label: "prod-redis.example.com:6379" },
    ],
  },
  {
    group: "Elasticsearch",
    items: [
      { value: "es-local", label: "http://localhost:9200" },
      { value: "es-dev", label: "http://10.0.1.35:9200" },
      { value: "es-prod", label: "https://es.example.com:9200" },
    ],
  },
];

const updateTreeData = (
  list: DataNode[],
  key: React.Key,
  children: DataNode[]
): DataNode[] =>
  list.map((node) => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateTreeData(node.children, key, children) };
    }
    return node;
  });

interface ContextState {
  x: number;
  y: number;
  node: DataNode;
}

function SidebarBody() {
  const t = useTranslation();
  const [dataSource, setDataSource] = useState("mysql-local");
  const [treeData, setTreeData] = useState<DataNode[]>(() => [
    { title: t("sidebar.tables"), key: "tables", selectable: false },
    { title: t("sidebar.views"), key: "views", selectable: false },
    { title: t("sidebar.functions"), key: "functions", isLeaf: true },
  ]);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const treeWrapRef = useRef<HTMLDivElement>(null);

  const selectOptions = dataSources.map((group) => ({
    label: group.group,
    options: group.items,
  }));

  const onLoadData = ({ key, children }: DataNode) =>
    new Promise<void>((resolve) => {
      if (children) {
        resolve();
        return;
      }
      setTimeout(() => {
        setTreeData((origin) =>
          updateTreeData(origin, key, [
            { title: `${key}-child-1`, key: `${key}-0` },
            { title: `${key}-child-2`, key: `${key}-1` },
          ])
        );
        resolve();
      }, 800);
    });

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    // wait for the current contextmenu bubble to finish so the menu isn't closed by its own open event
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

  const menuItems = useMemo<MenuProps["items"]>(
    () => [
      { key: "refresh", icon: <ReloadOutlined />, label: t("sidebar.ctx.refresh") },
      { key: "copy", icon: <CopyOutlined />, label: t("sidebar.ctx.copyName") },
      { key: "query", icon: <CodeOutlined />, label: t("sidebar.ctx.newQuery") },
      { key: "ddl", icon: <FileTextOutlined />, label: t("sidebar.ctx.viewDdl") },
    ],
    [t]
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!ctxMenu) return;
    const node = ctxMenu.node;
    const title = String(node.title ?? node.key);

    switch (key) {
      case "refresh":
        setTreeData((origin) => updateTreeData(origin, node.key, []));
        messageApi.success(t("sidebar.msg.refreshed", { name: title }));
        break;
      case "copy":
        navigator.clipboard
          ?.writeText(title)
          .then(() => messageApi.success(t("sidebar.msg.copied", { name: title })))
          .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        break;
      case "query":
        messageApi.info(t("sidebar.msg.queryTodo", { name: title }));
        break;
      case "ddl":
        messageApi.info(t("sidebar.msg.ddlTodo", { name: title }));
        break;
    }
    setCtxMenu(null);
  };

  return (
    <div className="sidebar-body">
      {contextHolder}
      <div className="sidebar-body-section">
        <Typography.Text type="secondary">{t("sidebar.dataSource")}</Typography.Text>
        <Select
          value={dataSource}
          onChange={setDataSource}
          options={selectOptions}
          style={{ width: "100%", height: "32px" }}
        />
      </div>

      <div className="sidebar-body-section sidebar-tree" ref={treeWrapRef}>
        <Typography.Text type="secondary">{t("sidebar.database")}</Typography.Text>
        <Tree
          loadData={onLoadData}
          treeData={treeData}
          showIcon
          blockNode
          onRightClick={({ event, node }) => {
            event.preventDefault();
            event.stopPropagation();
            setCtxMenu({ x: event.clientX, y: event.clientY, node });
          }}
        />
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
          document.body
        )}
    </div>
  );
}

export default SidebarBody;

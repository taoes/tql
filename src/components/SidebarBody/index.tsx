import { useState } from "react";
import { Select, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";
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

const initTreeData: DataNode[] = [
  { title: "数据表", key: "tables", selectable: false },
  { title: "视图", key: "views", selectable: false },
  { title: "函数", key: "functions", isLeaf: true },
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

function SidebarBody() {
  const [dataSource, setDataSource] = useState("mysql-local");
  const [treeData, setTreeData] = useState(initTreeData);

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

  return (
    <div className="sidebar-body">
      <div className="sidebar-body-section">
        <Typography.Text type="secondary">数据源</Typography.Text>
        <Select
          value={dataSource}
          onChange={setDataSource}
          options={selectOptions}
          style={{ width: "100%", height: "32px" }}
        />
      </div>

      <div className="sidebar-body-section sidebar-tree">
        <Typography.Text type="secondary">数据库</Typography.Text>
        <Tree
          loadData={onLoadData}
          treeData={treeData}
          showIcon
          blockNode
        />
      </div>
    </div>
  );
}

export default SidebarBody;

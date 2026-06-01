import { Table, Tag } from "antd";
import { useMemo } from "react";
import { useTranslation } from "../../i18n";
import "./index.css";

interface SqlResultTabProps {
  sql: string;
}

interface MockRow {
  key: number;
  id: number;
  name: string;
  status: string;
}

const MOCK_ROWS: MockRow[] = [
  { key: 1, id: 1001, name: "alice", status: "active" },
  { key: 2, id: 1002, name: "bob", status: "inactive" },
  { key: 3, id: 1003, name: "carol", status: "active" },
];

export default function SqlResultTab({ sql }: SqlResultTabProps) {
  const t = useTranslation();

  const columns = useMemo(
    () => [
      { title: "id", dataIndex: "id", key: "id", width: 100 },
      { title: "name", dataIndex: "name", key: "name" },
      {
        title: "status",
        dataIndex: "status",
        key: "status",
        render: (v: string) => (
          <Tag color={v === "active" ? "green" : "default"}>{v}</Tag>
        ),
      },
    ],
    []
  );

  return (
    <div className="sql-result-tab">
      <section className="sql-result-sql">
        <div className="sql-result-label">{t("workspace.sqlSection")}</div>
        <pre className="sql-result-code">{sql}</pre>
      </section>

      <section className="sql-result-data">
        <div className="sql-result-label">
          {t("workspace.resultSection")}
          <span className="sql-result-rows">
            {t("workspace.rowsAffected", { n: MOCK_ROWS.length })}
          </span>
        </div>
        <Table
          size="small"
          columns={columns}
          dataSource={MOCK_ROWS}
          pagination={false}
          locale={{ emptyText: t("workspace.emptyResult") }}
        />
      </section>
    </div>
  );
}

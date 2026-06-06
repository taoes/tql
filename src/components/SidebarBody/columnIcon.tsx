import {
  LockOutlined,
  KeyOutlined,
  LinkOutlined,
  NumberOutlined,
  FontSizeOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  CheckSquareOutlined,
  FileOutlined,
  UnorderedListOutlined,
  FieldNumberOutlined,
} from "@ant-design/icons";
import type { ColumnInfo } from "../../db-api";

/** Pick an appropriate icon for a database column based on its key and type. */
export function getColumnIcon(col: ColumnInfo): React.ReactNode {
  // Primary key → lock icon
  if (col.key === "PRI") {
    return <LockOutlined style={{ color: "#faad14" }} />;
  }
  // Unique key → key icon
  if (col.key === "UNI") {
    return <KeyOutlined style={{ color: "#1677ff" }} />;
  }
  // Foreign key / index → link icon
  if (col.key === "MUL") {
    return <LinkOutlined style={{ color: "#722ed1" }} />;
  }

  // Type-based icons (guard against undefined colType)
  const t = (col.colType ?? "").toLowerCase();

  // Integer types
  if (/\b(int|bigint|smallint|tinyint|mediumint|serial)\b/.test(t)) {
    return <NumberOutlined style={{ color: "#52c41a" }} />;
  }
  // Decimal / float
  if (/\b(decimal|numeric|float|double|real)\b/.test(t)) {
    return <NumberOutlined style={{ color: "#13c2c2" }} />;
  }
  // String types
  if (/\b(varchar|char|text|longtext|mediumtext|tinytext)\b/.test(t)) {
    return <FontSizeOutlined style={{ color: "#1677ff" }} />;
  }
  // Date / time types
  if (/\b(date|datetime|timestamp|time|year)\b/.test(t)) {
    return <ClockCircleOutlined style={{ color: "#eb2f96" }} />;
  }
  // JSON
  if (/\b(json)\b/.test(t)) {
    return <CodeOutlined style={{ color: "#fa8c16" }} />;
  }
  // Boolean
  if (/\b(bool|boolean|bit)\b/.test(t)) {
    return <CheckSquareOutlined style={{ color: "#722ed1" }} />;
  }
  // Blob / binary
  if (/\b(blob|binary|varbinary|longblob|mediumblob|tinyblob)\b/.test(t)) {
    return <FileOutlined style={{ color: "#8c8c8c" }} />;
  }
  // Enum / set
  if (/\b(enum|set)\b/.test(t)) {
    return <UnorderedListOutlined style={{ color: "#2f54eb" }} />;
  }

  // Default
  return <FieldNumberOutlined style={{ color: "#8c8c8c" }} />;
}

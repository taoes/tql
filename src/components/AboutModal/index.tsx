import { useEffect, useState } from "react";
import { Modal, Typography, Space, Tag } from "antd";
import { GithubOutlined, InfoCircleOutlined, MailOutlined } from "@ant-design/icons";
import { getAppInfo, type AppInfo } from "../../db-api";
import "./index.css";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (open) {
      getAppInfo().then(setInfo).catch(() => setInfo(null));
    }
  }, [open]);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
      centered
      className="about-modal"
    >
      <div className="about-content">
        <div className="about-icon">
          <InfoCircleOutlined />
        </div>

        <Typography.Title level={3} className="about-app-name">
          {info?.name ?? "TextQL"}
        </Typography.Title>

        {info && (
          <Tag color="blue" className="about-version">
            v{info.version}
          </Tag>
        )}

        <Typography.Paragraph
          type="secondary"
          className="about-description"
        >
          {info?.description ?? ""}
        </Typography.Paragraph>

        {info?.githubUrl && (
          <a
            href={info.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="about-github-link"
          >
            <Space>
              <GithubOutlined />
              {info.githubUrl}
            </Space>
          </a>
        )}

        {info?.authorEmail && (
          <a
            href={`mailto:${info.authorEmail}`}
            className="about-email-link"
          >
            <Space>
              <MailOutlined />
              {info.authorEmail}
            </Space>
          </a>
        )}

        <Typography.Paragraph
          type="secondary"
          className="about-license"
        >
          Open source under the Apache 2.0 License.
        </Typography.Paragraph>

        <Typography.Paragraph
          type="secondary"
          className="about-copyright"
        >
          &copy; {new Date().getFullYear()} TextQL. All rights reserved.
        </Typography.Paragraph>
      </div>
    </Modal>
  );
}

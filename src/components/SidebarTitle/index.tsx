import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { getAppInfo } from "../../db-api";
import "./index.css";

function SidebarTitle() {
  const t = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getAppInfo().then((info) => setVersion(info.version)).catch(() => setVersion(""));
  }, []);

  return (
    <div>
      <div className="sidebar-title">
        {t("app.title")}
        {version && <span className="sidebar-version">v{version}</span>}
      </div>
        {/* <div className="sidebar-subtitle">{t("app.subtitle")}</div> */}
    </div>
  );
}

export default SidebarTitle;

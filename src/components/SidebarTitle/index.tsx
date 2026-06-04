import { useTranslation } from "../../i18n";
import "./index.css";

function SidebarTitle() {
  const t = useTranslation();
  return (
    <div>
      <div className="sidebar-title">
        {t("app.title")}
        {/* <div className="sidebar-subtitle">{t("app.subtitle")}</div> */}
      </div>
    </div>
  );
}

export default SidebarTitle;

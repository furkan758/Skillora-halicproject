import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { getActiveForm, closeActiveForm } from "./otherComponents/draftStorage";
import AppFooter from "./otherComponents/AppFooter";
import HelpDialog from "./otherComponents/HelpDialog";
import Sidebar from "./otherComponents/Sidebar";
import Toast from "./otherComponents/Toast";
import Topbar from "./otherComponents/Topbar";
import { useAppDispatch, useAppSelector } from "./reduxToolKit/hooks";
import { fetchWorkspace } from "./reduxToolKit/store";
import ScenarioPage from "./Scenario/ScenarioPage";
import SkillsPage from "./skills/SkillsPage";
import EmployeeEditor from "./skillsToEmp/EmployeeEditor";
import type { Employee, Page, ToastHandler } from "./types";

export default function App() {
  const dispatch = useAppDispatch();
  const teamCount = useAppSelector((s) => s.catalog.overview.employeeCount);
  const [page, setPage] = useState<Page>(
    location.hash === "#scenarios" ? "scenarios" : "skills",
  );
  const [editor, setEditor] = useState<Employee | "new" | null>(null);
  const [help, setHelp] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    dispatch(fetchWorkspace());
    const resume = getActiveForm("employee");
    const controller = new AbortController();
    if (resume?.kind === "employee") {
      if (resume.id === null) setEditor("new");
      else
        api
          .get<Employee>(`/employees/${resume.id}`, {
            signal: controller.signal,
          })
          .then(({ data }) => setEditor(data))
          .catch(() => {
            if (!controller.signal.aborted) closeActiveForm("employee");
          });
    }
    const onHash = () =>
      setPage(location.hash === "#scenarios" ? "scenarios" : "skills");
    window.addEventListener("hashchange", onHash);
    return () => {
      controller.abort();
      window.removeEventListener("hashchange", onHash);
      clearTimeout(timer.current);
    };
  }, [dispatch]);
  const navigate = (p: Page) => {
    setPage(p);
    location.hash = p;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toast: ToastHandler = (message) => {
    setToastMessage(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMessage(""), 4500);
  };
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        mobileOpen={mobileOpen}
        teamCount={teamCount}
        onNavigate={navigate}
        onClose={() => setMobileOpen(false)}
        onHelp={() => setHelp(true)}
      />
      <div className="main-shell">
        <Topbar page={page} onMenu={() => setMobileOpen(true)} />
        <main>
          <div className="content">
            {page === "skills" ? (
              <SkillsPage
                onEdit={setEditor}
                onScenario={() => navigate("scenarios")}
                toast={toast}
              />
            ) : (
              <ScenarioPage toast={toast} />
            )}
            <AppFooter />
          </div>
        </main>
      </div>
      {editor !== null && (
        <EmployeeEditor
          employee={editor === "new" ? null : editor}
          onClose={() => {
            closeActiveForm("employee");
            setEditor(null);
          }}
          onSaved={toast}
        />
      )}{" "}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage("")} />
      )}
    </div>
  );
}

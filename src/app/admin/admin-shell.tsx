"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/api-error";
import { adminDelete, adminGet, adminPost, adminPublicPost, adminPut } from "@/lib/api/admin-client";
import { DraftPreview, SnapshotEditor } from "./admin-editor";
import {
  emptySnapshot,
  formatTime,
  MODULES,
  type AdminDetail,
  type AdminSection,
  type AdminUser,
  type AuditPage,
  type ContentPage,
  type ContentSummary,
  type ContentType,
  type Dashboard,
  type ContentRelease,
  type Revision,
  type Snapshot,
} from "./admin-model";
import styles from "./admin.module.css";

type Notice = { kind: "success" | "error" | "info"; message: string };
type ListState = "loading" | "ready" | "error";

const contentSections = new Set<AdminSection>([
  "profile", "skills", "project", "blogPost", "achievement", "certificate", "contactLink", "siteSettings",
]);
const singletonSections = new Set<AdminSection>(["profile", "siteSettings"]);

function initialRoute() {
  if (typeof window === "undefined") return { section: "dashboard" as AdminSection, id: null as string | null };
  const query = new URLSearchParams(window.location.search);
  const candidate = query.get("section") as AdminSection | null;
  const section = MODULES.some((item) => item.id === candidate) ? candidate! : "dashboard";
  const id = query.get("id") ?? (singletonSections.has(section) ? "primary" : null);
  return { section, id };
}

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    const issues = error.details?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      const lines = issues.slice(0, 5).map((issue) => {
        if (typeof issue !== "object" || issue === null) return "Check the highlighted content.";
        const item = issue as Record<string, unknown>;
        return `${String(item.path || "Field")}: ${String(item.message || "Invalid value")}`;
      });
      return `${error.message} ${lines.join(" · ")}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function titleForSection(section: AdminSection) {
  return MODULES.find((item) => item.id === section)?.label ?? "Overview";
}

function slugForDraft(type: ContentType, snapshot: Snapshot) {
  if (type !== "project" && type !== "blogPost") return snapshot;
  const currentSlug = typeof snapshot.slug === "string" ? snapshot.slug : "new-content";
  const suffix = globalThis.crypto.randomUUID().slice(0, 6);
  return { ...snapshot, slug: `${currentSlug.replace(/-copy(?:-[a-z0-9]+)?$/, "")}-copy-${suffix}` };
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <div className={styles.brandMark} aria-hidden="true">P<span>.</span></div>
        <p className={styles.eyebrow}>Private workspace</p>
        <h1>Portfolio Studio</h1>
        <p className={styles.loginDescription}>Sign in to manage drafts and review your portfolio content.</p>
        <form onSubmit={submit} className={styles.loginForm}>
          <label className={styles.field}>
            <span>Email address</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p role="alert" className={styles.formError}>{error}</p> : null}
          <button className={styles.primaryButton} type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className={styles.loginFootnote}><span className="material-symbols-outlined" aria-hidden="true">lock</span> Protected with a private session</p>
      </section>
    </main>
  );
}

function DashboardView({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: (section: AdminSection) => void }) {
  const totalPublished = Object.values(dashboard.published).reduce((total, count) => total + count, 0);
  const cards: Array<{ key: ContentType; label: string; icon: string }> = [
    { key: "profile", label: "Profile", icon: "person" },
    { key: "skills", label: "Skill groups", icon: "hub" },
    { key: "project", label: "Projects", icon: "work" },
    { key: "blogPost", label: "Blog posts", icon: "article" },
    { key: "achievement", label: "Achievements", icon: "workspace_premium" },
    { key: "certificate", label: "Certificates", icon: "verified" },
    { key: "contactLink", label: "Contact links", icon: "link" },
    { key: "siteSettings", label: "Site settings", icon: "tune" },
  ];
  return (
    <div className={styles.dashboardView}>
      <section className={styles.welcomePanel}>
        <div>
          <span className={styles.eyebrow}>Content workspace</span>
          <h2>Keep your portfolio current.</h2>
          <p>Drafts stay private until an Owner publishes a verified release to the staging Preview.</p>
        </div>
        <div className={styles.welcomeStamp} aria-hidden="true">
          <span>Published</span><span className={styles.stampLine} /><strong>{totalPublished}</strong><span>items live</span>
        </div>
      </section>

      <section className={styles.dashboardCards} aria-label="Published content counts">
        <button className={styles.draftCountCard} onClick={() => onOpen("project")}>
          <span className={styles.countIcon}><span className="material-symbols-outlined" aria-hidden="true">edit_note</span></span>
          <span><strong>{dashboard.activeDrafts}</strong><small>Active drafts</small></span>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
        </button>
        {cards.map((card) => (
          <button className={styles.countCard} key={card.key} onClick={() => onOpen(card.key)}>
            <span className={styles.countIcon}><span className="material-symbols-outlined" aria-hidden="true">{card.icon}</span></span>
            <span><strong>{dashboard.published[card.key] ?? 0}</strong><small>{card.label}</small></span>
          </button>
        ))}
      </section>

      <section className={styles.activityPanel}>
        <div className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>Recent changes</span><h3>Activity</h3></div>
          <button className={styles.textButton} onClick={() => onOpen("auditLogs")}>View audit log <span aria-hidden="true">→</span></button>
        </div>
        {dashboard.recentActivity.length === 0 ? (
          <p className={styles.inlineEmpty}>No admin activity has been recorded yet.</p>
        ) : (
          <div className={styles.activityList}>
            {dashboard.recentActivity.map((item) => (
              <div className={styles.activityRow} key={item.id}>
                <span className={styles.activityDot} aria-hidden="true" />
                <div><strong>{item.action.replaceAll("_", " ").toLowerCase()}</strong><small>{item.entityType} · {item.actorEmail || "System"}</small></div>
                <time>{formatTime(item.createdAt)}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContentListView({
  section,
  state,
  content,
  search,
  page,
  onSearch,
  onPage,
  onOpen,
  onCreate,
  onDuplicate,
}: {
  section: ContentType;
  state: ListState;
  content: ContentPage | null;
  search: string;
  page: number;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  onOpen: (item: ContentSummary) => void;
  onCreate: () => void;
  onDuplicate: (item: ContentSummary) => void;
}) {
  const activeModule = MODULES.find((item) => item.id === section);
  return (
    <section className={styles.listView}>
      <div className={styles.listToolbar}>
        <label className={styles.searchBox}>
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="sr-only">Search {activeModule?.label}</span>
          <input placeholder={`Search ${activeModule?.label.toLowerCase()}…`} value={search} onChange={(event) => onSearch(event.target.value)} />
        </label>
        <button className={styles.primaryButton} onClick={onCreate}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          Create draft
        </button>
      </div>
      <div className={styles.tableFrame}>
        {state === "loading" ? (
          <div className={styles.loadingState} role="status"><span className={styles.spinner} />Loading {activeModule?.label.toLowerCase()}…</div>
        ) : state === "error" ? (
          <div className={styles.emptyState}><span className="material-symbols-outlined" aria-hidden="true">cloud_off</span><h3>Could not load content</h3><p>Check the connection and retry.</p></div>
        ) : content?.items.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.contentTable}>
              <thead><tr><th>Content</th><th>Status</th><th>Revisions</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {content.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button className={styles.contentName} onClick={() => onOpen(item)}>
                        <strong>{item.title || "Untitled draft"}</strong>
                        <small>{item.slug || item.subtitle || item.id}</small>
                      </button>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${item.status === "DRAFT" ? styles.draftBadge : styles.publishedBadge}`}>
                        <span />{item.status === "DRAFT" ? (item.hasPublished ? "Draft · live version kept" : "Draft") : "Published"}
                      </span>
                    </td>
                    <td>{item.revisionCount || "—"}</td>
                    <td>{formatTime(item.updatedAt)}</td>
                    <td className={styles.tableActions}>
                      <button type="button" title="Open draft" onClick={() => onOpen(item)} aria-label={`Open ${item.title}`}>Open</button>
                      <button type="button" title="Duplicate to draft" onClick={() => onDuplicate(item)} aria-label={`Duplicate ${item.title}`}>Duplicate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" aria-hidden="true">inbox</span>
            <h3>{search ? "No matching content" : "No content yet"}</h3>
            <p>{search ? "Try a different search term." : "Create a draft to start building this section."}</p>
            {!search ? <button className={styles.quietButton} onClick={onCreate}>Create first draft <span aria-hidden="true">→</span></button> : null}
          </div>
        )}
      </div>
      {content && content.totalPages > 1 ? (
        <div className={styles.pagination}>
          <span>Page {page} of {content.totalPages} · {content.total} items</span>
          <div>
            <button className={styles.quietButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
            <button className={styles.quietButton} disabled={page >= content.totalPages} onClick={() => onPage(page + 1)}>Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AuditView({ audit, state, onPage, page }: { audit: AuditPage | null; state: ListState; onPage: (page: number) => void; page: number }) {
  return (
    <section className={styles.auditView}>
      <div className={styles.auditNote}><span className="material-symbols-outlined" aria-hidden="true">verified_user</span><span>Audit events are append-only from this workspace. Credentials, tokens and content bodies are never stored in event metadata.</span></div>
      <div className={styles.tableFrame}>
        {state === "loading" ? <div className={styles.loadingState} role="status"><span className={styles.spinner} />Loading audit events…</div> : null}
        {state === "error" ? <div className={styles.emptyState}><h3>Could not load the audit log</h3><p>Check your account role and retry.</p></div> : null}
        {state === "ready" && !audit?.items.length ? <div className={styles.emptyState}><h3>No audit events yet</h3><p>Important admin actions will appear here.</p></div> : null}
        {state === "ready" && audit?.items.length ? (
          <div className={styles.auditRows}>
            {audit.items.map((item) => (
              <article className={styles.auditRow} key={item.id}>
                <span className={styles.auditMark} aria-hidden="true"><span className="material-symbols-outlined">history</span></span>
                <div className={styles.auditDetails}>
                  <strong>{item.action.replaceAll("_", " ").toLowerCase()}</strong>
                  <span>{item.actorEmail || "Unverified request"}{item.entityType ? ` · ${item.entityType}` : ""}{item.entityId ? ` · ${item.entityId}` : ""}</span>
                </div>
                <time>{formatTime(item.createdAt)}</time>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      {audit && audit.total > audit.pageSize ? (
        <div className={styles.pagination}><span>{audit.total} events</span><div><button className={styles.quietButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button className={styles.quietButton} disabled={page * audit.pageSize >= audit.total} onClick={() => onPage(page + 1)}>Next</button></div></div>
      ) : null}
    </section>
  );
}

function ReleaseCenterView({
  releases,
  state,
  onRetry,
  onRollback,
}: {
  releases: ContentRelease[] | null;
  state: ListState;
  onRetry: (release: ContentRelease) => void;
  onRollback: (release: ContentRelease) => void;
}) {
  return (
    <section className={styles.releaseCenter}>
      <div className={styles.releaseIntro}>
        <div><span className={styles.eyebrow}>Staging only</span><h2>Deployment history</h2>
          <p>Content releases build isolated Cloudflare Pages Preview URLs. A release becomes live here only after verification.</p></div>
        <span className={styles.stagingPill}><span />Preview environment</span>
      </div>
      {state === "loading" ? <div className={styles.loadingState} role="status"><span className={styles.spinner} />Loading releases…</div> : null}
      {state === "error" ? <div className={styles.emptyState}><h3>Release history is unavailable</h3><p>Check your Owner permission and staging API connection.</p></div> : null}
      {state === "ready" && !releases?.length ? <div className={styles.emptyState}><h3>No releases yet</h3><p>Publish a saved draft to create the first staging release.</p></div> : null}
      {releases?.length ? <div className={styles.releaseList}>
        {releases.map((release) => {
          const stateLabel = release.status.replaceAll("_", " ").toLowerCase();
          const canRetry = release.status === "FAILED" || release.status === "VERIFICATION_FAILED";
          const canRollback = ["LIVE", "SUPERSEDED", "ROLLED_BACK"].includes(release.status);
          return <article className={styles.releaseCard} key={release.id}>
            <div className={styles.releaseCardTop}>
              <div><span className={styles.releaseNumber}>Release #{release.number}</span><h3>{release.entityType} · {release.operation.toLowerCase()}</h3><small>{release.entityId} · Draft revision {release.draftVersion ?? "—"}</small></div>
              <span className={`${styles.releaseState} ${release.status === "LIVE" ? styles.releaseStateLive : release.status.includes("FAILED") ? styles.releaseStateFailed : ""}`} aria-live="polite">{stateLabel}</span>
            </div>
            <ol className={styles.releaseProgress} aria-label={`Release progress: ${stateLabel}`}>
              {["Prepared", "Building", "Verifying", "Live"].map((step) => {
                  const current = ["LIVE", "SUPERSEDED", "ROLLED_BACK"].includes(release.status) ? 3
                    : release.status === "VERIFYING" ? 2
                      : ["BUILDING", "DEPLOYING", "CLONING", "INITIALIZING", "TRIGGERING", "UNKNOWN", "RECONCILIATION_REQUIRED"].includes(release.status) ? 1
                        : ["FAILED", "CANCELED", "VERIFICATION_FAILED"].includes(release.status) ? -1 : 0;
                  const index = ["Prepared", "Building", "Verifying", "Live"].indexOf(step);
                  return <li className={index <= current ? styles.releaseStepDone : ""} aria-current={index === current ? "step" : undefined} key={step}>{step}</li>;
              })}
            </ol>
            <dl className={styles.releaseFacts}>
              <div><dt>Created</dt><dd>{formatTime(release.createdAt)}</dd></div>
              <div><dt>Deployment</dt><dd>{release.deployment?.id ?? "Waiting for provider"}</dd></div>
              <div><dt>Build state</dt><dd>{release.deployment?.status?.toLowerCase().replaceAll("_", " ") ?? "Queued"}</dd></div>
            </dl>
            <code className={styles.releaseChecksum}>SHA-256 {release.checksum}</code>
            {release.deployment?.url ? <a className={styles.previewLink} href={release.deployment.url} target="_blank" rel="noreferrer">Open verified Preview <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : null}
            {release.error ? <p className={styles.releaseError} role="alert">{release.error.code}: {release.error.message}</p> : null}
            <div className={styles.releaseActions}>
              {canRetry ? <button className={styles.quietButton} onClick={() => onRetry(release)}>Retry deployment</button> : null}
              {canRollback ? <button className={styles.quietButton} onClick={() => onRollback(release)}>Restore this content version</button> : null}
            </div>
          </article>;
        })}
      </div> : null}
    </section>
  );
}

export function AdminShell() {
  const [authState, setAuthState] = useState<"checking" | "signedOut" | "signedIn">("checking");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [content, setContent] = useState<ContentPage | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot | null>(null);
  const [listState, setListState] = useState<ListState>("loading");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [audit, setAudit] = useState<AuditPage | null>(null);
  const [releases, setReleases] = useState<ContentRelease[] | null>(null);
  const [releaseRefresh, setReleaseRefresh] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const hasUnsavedChanges = Boolean(snapshot && initialSnapshot && JSON.stringify(snapshot) !== JSON.stringify(initialSnapshot));
  const unsavedRef = useRef(false);
  const activeModule = MODULES.find((item) => item.id === section);
  const isEditor = Boolean(detail && selectedId && contentSections.has(section));

  useEffect(() => {
    unsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const navigate = useCallback((nextSection: AdminSection, id: string | null = null) => {
    if (unsavedRef.current && !window.confirm("Discard your unsaved changes and leave this editor?")) return;
    setListState("loading");
    setSection(nextSection);
    setSelectedId(id);
    setDetail(null);
    setSnapshot(null);
    setInitialSnapshot(null);
    setContent(null);
    setSearch("");
    setPage(1);
    setMobileNavOpen(false);
    const params = new URLSearchParams();
    params.set("section", nextSection);
    if (id) params.set("id", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  const showNotice = useCallback((kind: Notice["kind"], message: string) => {
    setNotice({ kind, message });
    window.setTimeout(() => setNotice(null), 4_500);
  }, []);

  const onLogin = async (email: string, password: string) => {
    await adminPublicPost<AdminUser, { email: string; password: string }>("/auth/login", { email, password });
    const current = await adminGet<AdminUser>("/me");
    setUser(current);
    setAuthState("signedIn");
    showNotice("success", "You are signed in.");
  };

  const onLogout = async () => {
    try {
      await adminPost<{ loggedOut: boolean }>("/auth/logout");
    } catch {
      // Local UI still clears if the session has already expired or the network is unavailable.
    } finally {
      setUser(null);
      setAuthState("signedOut");
      setDetail(null);
      setSnapshot(null);
      setInitialSnapshot(null);
      showNotice("info", "You have been signed out.");
    }
  };

  useEffect(() => {
    let active = true;
    adminGet<AdminUser>("/me").then((current) => {
      if (!active) return;
      const next = initialRoute();
      setSection(next.section);
      setSelectedId(next.id);
      setUser(current);
      setAuthState("signedIn");
    }).catch(() => {
      if (active) {
        const next = initialRoute();
        setSection(next.section);
        setSelectedId(next.id);
        setAuthState("signedOut");
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (unsavedRef.current && !window.confirm("Discard your unsaved changes and leave this editor?")) return;
      const next = initialRoute();
      setSection(next.section);
      setSelectedId(next.id);
      setListState("loading");
      setDetail(null);
      setSnapshot(null);
      setInitialSnapshot(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (authState !== "signedIn") return;
    if (section === "dashboard") {
      adminGet<Dashboard>("/dashboard").then((result) => {
        setDashboard(result);
        setListState("ready");
      }).catch((error: unknown) => {
        setListState("error");
        showNotice("error", errorText(error));
      });
      return;
    }
    if (section === "auditLogs") {
      adminGet<AuditPage>("/audit-logs", { page, pageSize: 25 }).then((result) => {
        setAudit(result);
        setListState("ready");
      }).catch((error: unknown) => {
        setListState("error");
        showNotice("error", errorText(error));
      });
      return;
    }
    if (section === "releases") {
      adminGet<ContentRelease[]>("/releases", { limit: 50 }).then((result) => {
        setReleases(result);
        setListState("ready");
        if (result.some((item) => ["PENDING_DEPLOYMENT", "BUILDING", "VERIFYING", "RECONCILIATION_REQUIRED"].includes(item.status))) {
          window.setTimeout(() => setReleaseRefresh((value) => value + 1), 5_000);
        }
      }).catch((error: unknown) => {
        setListState("error");
        showNotice("error", errorText(error));
      });
      return;
    }
    if (!contentSections.has(section)) return;
    const type = section as ContentType;
    if (singletonSections.has(section)) {
      if (selectedId !== "primary") return;
      adminGet<AdminDetail>(`/content/${type}/primary`).then((result) => {
        setDetail(result);
        setSnapshot(result.snapshot);
        setInitialSnapshot(structuredClone(result.snapshot));
        setListState("ready");
      }).catch((error: unknown) => {
        setListState("error");
        showNotice("error", errorText(error));
      });
      return;
    }
    if (selectedId) {
      adminGet<AdminDetail>(`/content/${type}/${encodeURIComponent(selectedId)}`).then((result) => {
        setDetail(result);
        setSnapshot(result.snapshot);
        setInitialSnapshot(structuredClone(result.snapshot));
        setListState("ready");
      }).catch((error: unknown) => {
        setListState("error");
        showNotice("error", errorText(error));
      });
      return;
    }
    adminGet<ContentPage>(`/content/${type}`, { search, page, pageSize: 20 }).then((result) => {
      setContent(result);
      setListState("ready");
    }).catch((error: unknown) => {
      setListState("error");
      showNotice("error", errorText(error));
    });
  }, [authState, section, selectedId, search, page, releaseRefresh, navigate, showNotice]);

  const selectSection = (next: AdminSection) => {
    if (singletonSections.has(next)) navigate(next, "primary");
    else navigate(next);
  };

  const openItem = (item: ContentSummary) => navigate(item.type, item.id);

  const createNew = async () => {
    const type = section as ContentType;
    setListState("loading");
    try {
      const created = await adminPost<AdminDetail, Snapshot>(`/content/${type}/drafts`, emptySnapshot(type));
      setDetail(created);
      setSnapshot(created.snapshot);
      setInitialSnapshot(structuredClone(created.snapshot));
      setSelectedId(created.id);
      setContent(null);
      window.history.pushState({}, "", `${window.location.pathname}?section=${type}&id=${encodeURIComponent(created.id)}`);
      showNotice("success", "Draft created.");
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const duplicateItem = async (item: ContentSummary) => {
    try {
      const detail = await adminGet<AdminDetail>(`/content/${item.type}/${encodeURIComponent(item.id)}`);
      const duplicate = slugForDraft(item.type, structuredClone(detail.snapshot));
      const created = await adminPost<AdminDetail, Snapshot>(`/content/${item.type}/drafts`, duplicate);
      navigate(item.type, created.id);
      showNotice("success", "A separate draft copy is ready.");
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const save = async () => {
    if (!detail || !snapshot) return null;
    try {
      const updated = await adminPut<AdminDetail, { expectedVersion: number; snapshot: Snapshot }>(
        `/content/${detail.type}/${encodeURIComponent(detail.id)}/draft`,
        { expectedVersion: detail.version, snapshot }
      );
      setDetail(updated);
      setSnapshot(updated.snapshot);
      setInitialSnapshot(structuredClone(updated.snapshot));
      showNotice("success", "Draft saved. Published content is unchanged.");
      return updated;
    } catch (error) {
      showNotice("error", errorText(error));
      return null;
    }
  };

  const publish = async () => {
    if (!detail || !snapshot || user?.role !== "OWNER") return;
    if (!window.confirm(`Publish ${detail.type} revision ${detail.version + (hasUnsavedChanges ? 1 : 0)} to the staging Preview?`)) return;
    let candidate = detail;
    if (hasUnsavedChanges) {
      const saved = await save();
      if (!saved) return;
      candidate = saved;
    }
    try {
      const release = await adminPost<ContentRelease, { expectedVersion: number; idempotencyKey: string }>(
        `/content/${candidate.type}/${encodeURIComponent(candidate.id)}/publish`,
        { expectedVersion: candidate.version, idempotencyKey: globalThis.crypto.randomUUID() }
      );
      showNotice("info", `Release #${release.number} is ${release.status.toLowerCase().replaceAll("_", " ")}.`);
      unsavedRef.current = false;
      setReleaseRefresh((value) => value + 1);
      navigate("releases");
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const unpublish = async () => {
    if (!detail || !detail.hasPublished || user?.role !== "OWNER") return;
    if (!window.confirm("Remove this content from the next staging Preview build? Its historical release snapshots remain available.")) return;
    try {
      const release = await adminPost<ContentRelease, { idempotencyKey: string }>(
        `/content/${detail.type}/${encodeURIComponent(detail.id)}/unpublish`,
        { idempotencyKey: globalThis.crypto.randomUUID() }
      );
      showNotice("info", `Unpublish release #${release.number} is queued for verification.`);
      navigate("releases");
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const retryRelease = async (release: ContentRelease) => {
    try {
      await adminPost(`/releases/${encodeURIComponent(release.id)}/retry`, {});
      showNotice("info", `Retry queued for release #${release.number}.`);
      setReleaseRefresh((value) => value + 1);
    } catch (error) { showNotice("error", errorText(error)); }
  };

  const rollbackRelease = async (release: ContentRelease) => {
    if (!window.confirm(`Create a new staging release restoring ${release.entityType} from release #${release.number}?`)) return;
    try {
      const result = await adminPost<ContentRelease, { releaseId: string; idempotencyKey: string }>(
        `/content/${release.entityType}/${encodeURIComponent(release.entityId)}/rollback`,
        { releaseId: release.id, idempotencyKey: globalThis.crypto.randomUUID() }
      );
      showNotice("info", `Content rollback release #${result.number} is queued.`);
      setReleaseRefresh((value) => value + 1);
    } catch (error) { showNotice("error", errorText(error)); }
  };

  const cancelChanges = () => {
    if (!initialSnapshot || !hasUnsavedChanges) return;
    if (!window.confirm("Discard unsaved edits and restore the last saved version?")) return;
    setSnapshot(structuredClone(initialSnapshot));
  };

  const discard = async () => {
    if (!detail?.hasDraft) return;
    if (!window.confirm("Discard this draft? The published version will remain unchanged.")) return;
    try {
      await adminDelete(`/content/${detail.type}/${encodeURIComponent(detail.id)}/draft`, { expectedVersion: detail.version });
      showNotice("success", "Draft discarded. Published content is unchanged.");
      navigate(detail.type);
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const openHistory = async () => {
    if (!detail) return;
    try {
      const result = await adminGet<Revision[]>(`/content/${detail.type}/${encodeURIComponent(detail.id)}/revisions`);
      setRevisions(result);
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const restore = async (revision: Revision) => {
    if (!detail) return;
    if (!window.confirm(`Restore revision ${revision.revisionNumber} as the current Draft?`)) return;
    try {
      const restored = await adminPost<AdminDetail, { expectedVersion: number }>(
        `/content/${detail.type}/${encodeURIComponent(detail.id)}/revisions/${encodeURIComponent(revision.id)}/restore`,
        { expectedVersion: detail.version }
      );
      setDetail(restored);
      setSnapshot(restored.snapshot);
      setInitialSnapshot(structuredClone(restored.snapshot));
      setRevisions(null);
      showNotice("success", `Revision ${revision.revisionNumber} restored as a new Draft revision.`);
    } catch (error) {
      showNotice("error", errorText(error));
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    setPasswordBusy(true);
    try {
      await adminPost("/auth/password", { currentPassword, newPassword });
      setAccountOpen(false);
      setUser(null);
      setAuthState("signedOut");
      setDetail(null);
      setSnapshot(null);
      setInitialSnapshot(null);
      showNotice("success", "Password changed. Sign in with the new password.");
    } catch (error) {
      showNotice("error", errorText(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  if (authState === "checking") {
    return <main className={styles.loadingPage}><span className={styles.spinner} />Checking admin session…</main>;
  }
  if (authState === "signedOut") return <LoginScreen onLogin={onLogin} />;

  return (
    <div className={styles.adminShell}>
      <aside className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <div className={styles.brandMark} aria-hidden="true">P<span>.</span></div>
          <div><strong>Portfolio</strong><small>Studio</small></div>
          <button className={styles.mobileClose} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button>
        </div>
        <div className={styles.navCaption}>Workspace</div>
        <nav className={styles.mainNav} aria-label="Admin modules">
          {MODULES.filter((item) => item.id !== "releases" || user?.role === "OWNER").map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ""}`}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => selectSection(item.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "project" && dashboard?.activeDrafts ? <small>{dashboard.activeDrafts}</small> : null}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <span className={styles.environmentDot} /> Staging workspace
          <small>Publish actions create verified Pages Preview releases.</small>
        </div>
      </aside>

      {mobileNavOpen ? <button className={styles.mobileScrim} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}

      <div className={styles.mainColumn}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button className={styles.mobileMenu} aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><span className="material-symbols-outlined" aria-hidden="true">menu</span></button>
            <div className={styles.breadcrumb}><span>Portfolio</span><span aria-hidden="true">/</span><strong>{isEditor ? "Editor" : activeModule?.label ?? "Overview"}</strong></div>
          </div>
          <div className={styles.accountControls}>
            <span className={styles.currentUser}><span className={styles.userAvatar}>{user?.email.slice(0, 1).toUpperCase()}</span><span>{user?.email}</span><small>{user?.role}</small></span>
            <button className={styles.accountButton} onClick={() => setAccountOpen((current) => !current)} aria-expanded={accountOpen}>Account</button>
            <button className={styles.logoutButton} onClick={() => void onLogout()}><span className="material-symbols-outlined" aria-hidden="true">logout</span><span>Sign out</span></button>
          </div>
          {accountOpen ? (
            <form className={styles.accountPanel} onSubmit={changePassword}>
              <div><strong>Change password</strong><button type="button" aria-label="Close password settings" onClick={() => setAccountOpen(false)}>×</button></div>
              <label className={styles.field}><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <label className={styles.field}><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /><small>Use at least 12 characters.</small></label>
              <button className={styles.primaryButton} disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Change password"}</button>
            </form>
          ) : null}
        </header>

        <main className={styles.workspace}>
          {notice ? <div className={`${styles.notice} ${styles[`notice_${notice.kind}`]}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button></div> : null}
          <div className={styles.pageHeading}>
            <div>
              {isEditor ? <button className={styles.backButton} onClick={() => navigate(section)}><span aria-hidden="true">←</span> Back to {titleForSection(section).toLowerCase()}</button> : null}
              <span className={styles.eyebrow}>{isEditor ? "Draft editor" : "Portfolio CMS"}</span>
              <h1>{isEditor ? (detail?.snapshot.slug as string || titleForSection(section)) : titleForSection(section)}</h1>
              <p>{isEditor ? "Edit the working copy. Published content remains as it is." : section === "dashboard" ? "Manage the content that makes up your portfolio." : `Manage ${titleForSection(section).toLowerCase()} and their language versions.`}</p>
            </div>
            {isEditor && detail ? (
              <div className={styles.headingStatus}>
                <span className={`${styles.statusBadge} ${detail.hasDraft ? styles.draftBadge : styles.publishedBadge}`}><span />{detail.hasDraft ? "Draft" : "Published copy"}</span>
                {detail.hasPublished ? <span className={styles.liveNote}><span className={styles.liveDot} /> Live version unchanged</span> : null}
              </div>
            ) : null}
          </div>

          {section === "dashboard" ? (
            listState === "loading" ? <div className={styles.loadingState} role="status"><span className={styles.spinner} />Loading workspace…</div> :
              listState === "error" ? <div className={styles.emptyState}><h2>Dashboard is unavailable</h2><p>Try reloading the page.</p></div> :
                dashboard ? <DashboardView dashboard={dashboard} onOpen={selectSection} /> : null
          ) : null}

          {section === "auditLogs" ? (
            <AuditView audit={audit} state={listState} page={page} onPage={(next) => { setListState("loading"); setPage(next); }} />
          ) : null}

          {section === "releases" ? (
            <ReleaseCenterView releases={releases} state={listState} onRetry={(release) => void retryRelease(release)} onRollback={(release) => void rollbackRelease(release)} />
          ) : null}

          {contentSections.has(section) && !isEditor && !singletonSections.has(section) ? (
            <ContentListView
              section={section as ContentType}
              state={listState}
              content={content}
              search={search}
              page={page}
              onSearch={(value) => { setListState("loading"); setPage(1); setSearch(value); }}
              onPage={(next) => { setListState("loading"); setPage(next); }}
              onOpen={openItem}
              onCreate={() => void createNew()}
              onDuplicate={(item) => void duplicateItem(item)}
            />
          ) : null}

          {contentSections.has(section) && selectedId && !detail && listState === "loading" ? (
            <div className={styles.loadingState} role="status"><span className={styles.spinner} />Loading editor…</div>
          ) : null}
          {contentSections.has(section) && selectedId && listState === "error" ? (
            <div className={styles.emptyState}><h2>Content could not be opened</h2><p>It may have been removed. Return to the list and try again.</p><button className={styles.quietButton} onClick={() => navigate(section)}>Back</button></div>
          ) : null}
          {isEditor && detail && snapshot ? (
            <section className={styles.editorWorkspace}>
              <div className={styles.editorActions}>
                <div className={styles.editorMeta}>
                  <span>Revision {detail.version || "Published baseline"}</span>
                  <span>Updated {formatTime(detail.updatedAt)}</span>
                </div>
                <div className={styles.editorButtons}>
                  <button className={styles.quietButton} onClick={() => setPreviewOpen(true)}><span className="material-symbols-outlined" aria-hidden="true">visibility</span>Preview draft</button>
                  <button className={styles.quietButton} onClick={() => void openHistory()}><span className="material-symbols-outlined" aria-hidden="true">history</span>History</button>
                  {!singletonSections.has(section) ? <button className={styles.quietButton} disabled={hasUnsavedChanges} title={hasUnsavedChanges ? "Save or cancel edits before duplicating." : undefined} onClick={() => void duplicateItem({ id: detail.id, type: detail.type, title: String(detail.snapshot.title ?? "Copy"), slug: String(detail.snapshot.slug ?? ""), subtitle: "", status: detail.hasDraft ? "DRAFT" : "PUBLISHED", hasPublished: detail.hasPublished, version: detail.version, updatedAt: detail.updatedAt, revisionCount: revisions?.length ?? 0 })}><span className="material-symbols-outlined" aria-hidden="true">content_copy</span>Duplicate</button> : null}
                  {detail.hasDraft ? <button className={styles.dangerButton} onClick={() => void discard()}><span className="material-symbols-outlined" aria-hidden="true">delete</span>Discard draft</button> : null}
                  {detail.hasPublished && user?.role === "OWNER" && !singletonSections.has(section) ? <button className={styles.dangerButton} onClick={() => void unpublish()} disabled={hasUnsavedChanges}><span className="material-symbols-outlined" aria-hidden="true">visibility_off</span>Unpublish from staging</button> : null}
                  {hasUnsavedChanges ? <button className={styles.quietButton} onClick={cancelChanges}>Cancel edits</button> : null}
                  <button className={styles.primaryButton} onClick={() => void save()} disabled={!hasUnsavedChanges}><span className="material-symbols-outlined" aria-hidden="true">save</span>Save draft</button>
                  {detail.hasDraft && user?.role === "OWNER" ? <button className={styles.publishButton} onClick={() => void publish()} disabled={hasUnsavedChanges && listState === "loading"}><span className="material-symbols-outlined" aria-hidden="true">rocket_launch</span>Publish to staging</button> : null}
                </div>
              </div>
              <aside className={styles.stateRail}>
                <div><span className={styles.stateRailMark}>P</span><span><strong>Published</strong><small>{detail.hasPublished ? "Current live version is protected" : "No public version yet"}</small></span></div>
                <span className={styles.railConnector} aria-hidden="true" />
                <div><span className={`${styles.stateRailMark} ${styles.draftRailMark}`}>D</span><span><strong>Draft {detail.hasDraft ? `v${detail.version}` : "not saved"}</strong><small>Only visible in this private studio</small></span></div>
                <span className={styles.noPublishNote}>Draft changes stay private until the staging Preview passes verification.</span>
              </aside>
              <SnapshotEditor snapshot={snapshot} onChange={setSnapshot} />
            </section>
          ) : null}
        </main>
      </div>

      {previewOpen && snapshot && contentSections.has(section) ? <DraftPreview snapshot={snapshot} type={section as ContentType} onClose={() => setPreviewOpen(false)} /> : null}
      {revisions ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRevisions(null); }}>
          <section className={styles.historyDialog} role="dialog" aria-modal="true" aria-labelledby="history-heading">
            <header className={styles.dialogHeader}><div><span className={styles.eyebrow}>Draft history</span><h2 id="history-heading">Revision history</h2></div><button className={styles.iconButton} onClick={() => setRevisions(null)} aria-label="Close revision history">×</button></header>
            {revisions.length ? <div className={styles.revisionList}>{revisions.map((revision) => <article key={revision.id} className={styles.revisionRow}>
              <span className={styles.revisionNumber}>{String(revision.revisionNumber).padStart(2, "0")}</span>
              <div><strong>{revision.title || "Untitled revision"}</strong><small>Revision {revision.revisionNumber} · {revision.authorEmail}</small><time>{formatTime(revision.createdAt)}</time></div>
              <button className={styles.quietButton} onClick={() => void restore(revision)} disabled={!detail || revision.version === detail.version}>Restore</button>
            </article>)}</div> : <div className={styles.emptyState}><h3>No saved revisions</h3><p>Save a draft to start a revision history.</p></div>}
            <p className={styles.dialogFootnote}>Restore creates a new revision from the selected snapshot. Existing history stays available.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

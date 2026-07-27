"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/logout-button";
import { RequestStatusChart } from "@/components/request-status-chart";
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";
import { localizeCategory, localizePriority } from "@/lib/localization";
import { appConfig } from "@/lib/app-config";

type Status =
  | "Submitted"
  | "Under Review"
  | "Rejected"
  | "Approved"
  | "Assigned"
  | "In Progress"
  | "Completed by Staff"
  | "Needs Revision"
  | "Closed";

type Report = {
  id: string;
  dbId?: string;
  title: string;
  category: string;
  location: string;
  priority: "High" | "Medium" | "Low";
  status: Status;
  updated: string;
  description: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type StatusCounts = Partial<Record<Status, number>>;
const databaseStatus: Record<Status, string> = {
  Submitted: "SUBMITTED",
  "Under Review": "UNDER_REVIEW",
  Rejected: "REJECTED",
  Approved: "APPROVED",
  Assigned: "ASSIGNED",
  "In Progress": "IN_PROGRESS",
  "Completed by Staff": "COMPLETED_BY_STAFF",
  "Needs Revision": "NEEDS_REVISION",
  Closed: "CLOSED",
};
type ApiBody = {
  data?: unknown;
  error?: string;
  pagination?: Pagination;
  statusCounts?: Record<string, number>;
};

async function readApiBody(response: Response): Promise<ApiBody | null> {
  try {
    return (await response.json()) as ApiBody;
  } catch {
    return null;
  }
}

const statusStyle: Record<Status, string> = {
  Submitted: "bg-sky-50 text-sky-700 ring-sky-100",
  "Under Review": "bg-amber-50 text-amber-700 ring-amber-100",
  Rejected: "bg-red-50 text-red-700 ring-red-100",
  Approved: "bg-teal-50 text-teal-700 ring-teal-100",
  Assigned: "bg-orange-50 text-orange-700 ring-orange-100",
  "In Progress": "bg-violet-50 text-violet-700 ring-violet-100",
  "Completed by Staff": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Needs Revision": "bg-yellow-50 text-yellow-700 ring-yellow-100",
  Closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

function toReport(raw: {
  id: string;
  referenceNo: string;
  title: string;
  category: string;
  location: string;
  priority: string;
  status: string;
  updatedAt: string;
  description: string;
}): Report {
  const statuses: Record<string, Status> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    COMPLETED_BY_STAFF: "Completed by Staff",
    NEEDS_REVISION: "Needs Revision",
    CLOSED: "Closed",
  };
  return {
    id: raw.referenceNo || raw.id,
    dbId: raw.id,
    title: raw.title,
    category: raw.category,
    location: raw.location,
    priority:
      `${raw.priority[0]}${raw.priority.slice(1).toLowerCase()}` as Report["priority"],
    status: statuses[raw.status] ?? "Submitted",
    updated: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(new Date(raw.updatedAt)),
    description: raw.description,
  };
}

function toStatusCounts(
  raw: Record<string, number> | undefined,
): StatusCounts | undefined {
  if (!raw) return undefined;
  const statuses: Record<string, Status> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    COMPLETED_BY_STAFF: "Completed by Staff",
    NEEDS_REVISION: "Needs Revision",
    CLOSED: "Closed",
  };
  return Object.fromEntries(
    Object.entries(raw).flatMap(([status, count]) =>
      statuses[status] ? [[statuses[status], count]] : [],
    ),
  );
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    file: (
      <>
        <path d="M6 2.75h8l4 4V21.25H6z" />
        <path d="M14 2.75v4h4" />
        <path d="M9 12h6M9 16h6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    users: (
      <>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7" r="3.25" />
        <path d="M17 11a3 3 0 0 0 0-6M21 20v-1.5a4 4 0 0 0-2.5-3.7" />
      </>
    ),
    setting: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.13 2.13-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.09h-3v-.09A1.7 1.7 0 0 0 10.67 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.97l.06-.06A1.7 1.7 0 0 0 7 15.03a1.7 1.7 0 0 0-1.56-1.03h-.09v-3h.09A1.7 1.7 0 0 0 7 9.97a1.7 1.7 0 0 0-.34-1.88L6.6 8.03 8.73 5.9l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.09h3v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.13 2.13-.06.06A1.7 1.7 0 0 0 19.4 10c.16.63.72 1.02 1.37 1.02h.09v3h-.09c-.65 0-1.21.39-1.37.98Z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.2 4.2" />
      </>
    ),
    map: (
      <>
        <path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    upload: (
      <>
        <path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" />
        <path d="M4 14.5v5.25h16V14.5" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const thaiStatus: Record<Status, string> = {
  Submitted: "ส่งคำขอแล้ว",
  "Under Review": "กำลังตรวจสอบ",
  Rejected: "ไม่อนุมัติ",
  Approved: "อนุมัติแล้ว",
  Assigned: "มอบหมายแล้ว",
  "In Progress": "กำลังดำเนินการ",
  "Completed by Staff": "เจ้าหน้าที่ดำเนินการเสร็จ",
  "Needs Revision": "ต้องแก้ไข",
  Closed: "ปิดงานแล้ว",
};

function StatusBadge({ status }: { status: Status }) {
  const { language } = useLanguage();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[status]}`}
    >
      {language === "th" ? thaiStatus[status] : status}
    </span>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const { language } = useLanguage();
  const [view, setView] = useState<"dashboard" | "how" | "new" | "reports">(
    "dashboard",
  );
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [myReportsPagination, setMyReportsPagination] = useState<Pagination>();
  const [myReportsPage, setMyReportsPage] = useState(1);
  const [myReportsStatus, setMyReportsStatus] = useState<"ALL" | Status>("ALL");
  const [publicQueue, setPublicQueue] = useState<Report[]>([]);
  const [publicPagination, setPublicPagination] = useState<Pagination>();
  const [publicStatusCounts, setPublicStatusCounts] = useState<StatusCounts>();
  const [publicPage, setPublicPage] = useState(1);
  const [publicQueueState, setPublicQueueState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [reportState, setReportState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const metrics = useMemo(() => {
    if (publicStatusCounts && !session) {
      return {
        open: Object.entries(publicStatusCounts)
          .filter(([status]) => status !== "Closed" && status !== "Rejected")
          .reduce((total, [, count]) => total + (count ?? 0), 0),
        review:
          (publicStatusCounts.Submitted ?? 0) +
          (publicStatusCounts["Under Review"] ?? 0),
        progress: publicStatusCounts["In Progress"] ?? 0,
        closed: publicStatusCounts.Closed ?? 0,
      };
    }
    return {
      open: reports.filter(
        (r) => r.status !== "Closed" && r.status !== "Rejected",
      ).length,
      review: reports.filter(
        (r) => r.status === "Under Review" || r.status === "Submitted",
      ).length,
      progress: reports.filter((r) => r.status === "In Progress").length,
      closed: reports.filter((r) => r.status === "Closed").length,
    };
  }, [publicStatusCounts, reports, session]);

  useEffect(() => {
    async function loadReports() {
      setReportState("loading");
      try {
        const myReportsQuery = new URLSearchParams({
          page: String(myReportsPage),
          pageSize: "10",
        });
        if (myReportsStatus !== "ALL") {
          myReportsQuery.set("status", databaseStatus[myReportsStatus]);
        }
        const response = await fetch(
          session
            ? `/api/reports?${myReportsQuery}`
            : "/api/public/reports?page=1&pageSize=10",
        );
        const body = await readApiBody(response);
        if (!response.ok || !Array.isArray(body?.data)) throw new Error();
        setReports(body.data.map(toReport));
        if (session) {
          setMyReportsPagination(body.pagination);
        } else {
          setPublicStatusCounts(toStatusCounts(body.statusCounts));
          setPublicPagination(body.pagination);
        }
        setReportState("ready");
      } catch {
        setReportState("error");
      }
    }
    void loadReports();
  }, [session, reloadKey, myReportsPage, myReportsStatus]);

  useEffect(() => {
    if (!showAllRequests) return;
    async function loadPublicQueue() {
      setPublicQueueState("loading");
      try {
        const response = await fetch(
          `/api/public/reports?page=${publicPage}&pageSize=10`,
        );
        const body = await readApiBody(response);
        if (!response.ok || !Array.isArray(body?.data) || !body.pagination) {
          throw new Error();
        }
        setPublicQueue(body.data.map(toReport));
        setPublicPagination(body.pagination);
        setPublicStatusCounts(toStatusCounts(body.statusCounts));
        setPublicQueueState("ready");
      } catch {
        setPublicQueueState("error");
      }
    }
    void loadPublicQueue();
  }, [showAllRequests, publicPage, reloadKey]);

  function requireLogin() {
    window.location.assign("/login?callbackUrl=/");
  }

  function selectView(nextView: "dashboard" | "how" | "new" | "reports") {
    if ((nextView === "new" || nextView === "reports") && !session) {
      requireLogin();
      return;
    }
    setShowAllRequests(false);
    setView(nextView);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      requireLogin();
      return;
    }
    if (isSubmitting) return;
    const data = new FormData(event.currentTarget);
    setIsSubmitting(true);
    let response: Response;
    let body: ApiBody | null;
    try {
      response = await fetch("/api/reports", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          title: data.get("title"),
          category: data.get("category"),
          location: data.get("location"),
          description: data.get("description"),
          latitude: data.get("latitude") || undefined,
          longitude: data.get("longitude") || undefined,
          priority: String(data.get("priority")).toUpperCase(),
        }),
      });
      body = await readApiBody(response);
    } catch {
      setNotice({
        tone: "error",
        message:
          language === "th"
            ? "ไม่สามารถส่งคำขอได้ โปรดลองอีกครั้ง"
            : "Unable to submit your request. Please try again.",
      });
      setIsSubmitting(false);
      return;
    }
    if (!response.ok || !body?.data) {
      setNotice({
        tone: "error",
        message:
          body?.error ??
          (language === "th"
            ? "ไม่สามารถส่งคำขอได้ โปรดลองอีกครั้ง"
            : "Unable to submit your request. Please try again."),
      });
      setIsSubmitting(false);
      return;
    }
    const files = Array.from(data.getAll("attachments")).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    const createdReport = body.data as { id: string; referenceNo: string };
    let attachmentUploadFailed = false;
    if (files.length) {
      const uploadData = new FormData();
      files.forEach((file) => uploadData.append("files", file));
      try {
        const uploadResponse = await fetch(
          `/api/reports/${createdReport.id}/attachments`,
          { method: "POST", body: uploadData },
        );
        attachmentUploadFailed = !uploadResponse.ok;
      } catch {
        attachmentUploadFailed = true;
      }
    }
    const report = toReport(body.data as Parameters<typeof toReport>[0]);
    setMyReportsPage(1);
    setReloadKey((current) => current + 1);
    setNotice({
      message: attachmentUploadFailed
        ? language === "th"
          ? `ส่ง ${createdReport.referenceNo} แล้ว แต่ไม่สามารถอัปโหลดไฟล์แนบบางรายการได้`
          : `${createdReport.referenceNo} was submitted, but one or more attachments could not be uploaded.`
        : language === "th"
          ? `ส่ง ${report.id} เพื่อรอตรวจสอบแล้ว`
          : `${report.id} has been submitted for review.`,
      tone: attachmentUploadFailed ? "error" : "success",
    });
    setIsSubmitting(false);
    setView("reports");
  }

  const nav: {
    id: "dashboard" | "how" | "new" | "reports";
    label: string;
    icon: string;
  }[] = [
    {
      id: "dashboard",
      label: language === "th" ? "หน้าหลัก" : "Dashboard",
      icon: "grid",
    },
    {
      id: "how",
      label: language === "th" ? "วิธีใช้งาน" : "How it works",
      icon: "clock",
    },
    ...(session
      ? [
          {
            id: "reports" as const,
            label: language === "th" ? "รายการแจ้งซ่อม" : "My reports",
            icon: "file",
          },
        ]
      : []),
    {
      id: "new",
      label: language === "th" ? "แจ้งซ่อมใหม่" : "New request",
      icon: "plus",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7f8] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-[88px] items-center gap-3 border-b border-slate-100 px-7">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f36c21] text-lg font-black text-white">
            {appConfig.shortName}
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-slate-900">
              {language === "th" ? appConfig.nameTh : appConfig.name}
            </p>
            <p className="text-xs text-slate-500">
              {language === "th" ? "บริการแจ้งซ่อม" : "Maintenance service"}
            </p>
          </div>
        </div>
        <nav className="space-y-1 px-4 py-6">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => selectView(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${view === item.id ? "bg-[#fff2eb] text-[#d94e0b]" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
        {(session?.user.role === "ADMIN" || session?.user.role === "STAFF") && (
          <div className="mx-4 border-t border-slate-100 pt-4">
            <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              My workspace
            </p>
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Icon name="users" className="h-5 w-5" />
                Admin workspace
              </Link>
            )}
            {session.user.role === "STAFF" && (
              <Link
                href="/staff"
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Icon name="setting" className="h-5 w-5" />
                Staff workspace
              </Link>
            )}
          </div>
        )}
        <div className="mt-auto border-t border-slate-100 p-4">
          {session ? (
            <LogoutButton className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" />
          ) : (
            <Link
              href="/login?callbackUrl=/"
              className="flex w-full items-center gap-3 rounded-lg bg-[#ee641b] px-4 py-3 text-sm font-semibold text-white"
            >
              {language === "th" ? "เข้าสู่ระบบ" : "Sign in"}
            </Link>
          )}
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">
              VP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {session?.user.name ??
                  (language === "th" ? "ผู้เยี่ยมชม" : "Guest")}
              </p>
              <p className="text-xs text-slate-500">
                {session
                  ? language === "th"
                    ? "บริการแจ้งซ่อม"
                    : "Maintenance service"
                  : language === "th"
                    ? "หน้าหลักสาธารณะ"
                    : "Public dashboard"}
              </p>
            </div>
          </div>
        </div>
      </aside>
      <main className="pb-24 lg:pb-0 lg:pl-64">
        <header className="flex h-[88px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f36c21] font-black text-white">
              {appConfig.shortName}
            </div>
            <span className="font-bold">
              {language === "th" ? appConfig.nameTh : appConfig.name}
            </span>
          </div>
          <div className="hidden max-w-sm flex-1 lg:block">
            <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder={
                  language === "th"
                    ? "ค้นหารายการแจ้งซ่อม…"
                    : "Search reports..."
                }
              />
            </label>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="inline-flex" />
            <button
              aria-label={language === "th" ? "การแจ้งเตือน" : "Notifications"}
              className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <Icon name="bell" className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#f36c21]" />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">
                {session?.user.name ??
                  (language === "th" ? "ผู้เยี่ยมชม" : "Guest visitor")}
              </p>
              <p className="text-xs text-slate-500">
                {session
                  ? language === "th"
                    ? "บริการแจ้งซ่อม"
                    : "Maintenance service"
                  : language === "th"
                    ? "เข้าสู่ระบบเพื่อจัดการรายการ"
                    : "Sign in to manage requests"}
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white sm:hidden">
              VP
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          {notice && (
            <div
              role="status"
              className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-red-100 bg-red-50 text-red-800"}`}
            >
              <span>{notice.message}</span>
              <button
                onClick={() => setNotice(null)}
                className={
                  notice.tone === "success"
                    ? "text-emerald-700"
                    : "text-red-700"
                }
              >
                {language === "th" ? "ปิด" : "Dismiss"}
              </button>
            </div>
          )}
          {view !== "how" && reportState === "loading" && (
            <div
              aria-busy="true"
              className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-500"
            >
              {language === "th"
                ? "กำลังโหลดรายการแจ้งซ่อม…"
                : "Loading maintenance requests…"}
            </div>
          )}
          {view !== "how" && reportState === "error" && (
            <div
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-800"
            >
              <p className="font-bold">
                {language === "th"
                  ? "ไม่สามารถโหลดรายการแจ้งซ่อมได้"
                  : "Unable to load maintenance requests."}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-bold text-red-800"
              >
                {language === "th" ? "ลองอีกครั้ง" : "Retry"}
              </button>
            </div>
          )}
          {reportState === "ready" &&
            view === "dashboard" &&
            (showAllRequests ? (
              <PublicRequestQueue
                reports={publicQueue}
                pagination={publicPagination}
                state={publicQueueState}
                onClose={() => setShowAllRequests(false)}
                onPageChange={setPublicPage}
              />
            ) : (
              <>
                <Dashboard
                  reports={reports}
                  metrics={metrics}
                  onNew={() => selectView("new")}
                  onViewAll={() => setShowAllRequests(true)}
                />
                <RequestStatusChart
                  reports={reports}
                  statusCounts={!session ? publicStatusCounts : undefined}
                  total={!session ? publicPagination?.total : undefined}
                />
              </>
            ))}
          {reportState === "ready" && view === "new" && (
            <NewRequest
              onSubmit={submitReport}
              onCancel={() => setView("dashboard")}
              isSubmitting={isSubmitting}
            />
          )}
          {reportState === "ready" && view === "reports" && (
            <Reports
              reports={reports}
              pagination={myReportsPagination}
              selectedStatus={myReportsStatus}
              onStatusChange={(status) => {
                setMyReportsStatus(status);
                setMyReportsPage(1);
              }}
              onPageChange={setMyReportsPage}
              onNew={() => selectView("new")}
            />
          )}
          {view === "how" && <HowItWorks />}
        </div>
      </main>
      <nav
        aria-label={language === "th" ? "เมนูหลัก" : "Primary navigation"}
        className={`fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] lg:hidden ${session ? "grid-cols-5" : "grid-cols-3"}`}
      >
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectView(item.id)}
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-bold ${view === item.id ? "bg-orange-50 text-[#d94e0b]" : "text-slate-600"}`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </button>
        ))}
        {session && (
          <LogoutButton className="flex min-h-11 flex-col items-center justify-center rounded-lg px-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" />
        )}
      </nav>
    </div>
  );
}

function HowItWorks() {
  const { language } = useLanguage();
  const th = language === "th";
  const steps = th
    ? [
        {
          title: "ส่งคำขอ",
          description: "ระบุปัญหา สถานที่ และรูปภาพประกอบ",
          role: "ผู้แจ้ง",
        },
        {
          title: "ตรวจสอบ",
          description: "ผู้ดูแลตรวจสอบความถูกต้องและอนุมัติงาน",
          role: "ผู้ดูแล",
        },
        {
          title: "มอบหมายงาน",
          description: "กำหนดเจ้าหน้าที่และวันครบกำหนด",
          role: "ผู้ดูแล",
        },
        {
          title: "ดำเนินการ",
          description: "เจ้าหน้าที่ซ่อม บันทึกความคืบหน้า และแนบหลักฐาน",
          role: "เจ้าหน้าที่",
        },
        {
          title: "ปิดงาน",
          description: "ผู้ดูแลตรวจรับและปิดรายการที่เสร็จสมบูรณ์",
          role: "ผู้ดูแล",
        },
      ]
    : [
        {
          title: "Submit request",
          description: "Describe the issue, location, and supporting photos.",
          role: "Requester",
        },
        {
          title: "Review",
          description: "An administrator checks and approves the request.",
          role: "Admin",
        },
        {
          title: "Assign work",
          description: "A staff member and due date are assigned.",
          role: "Admin",
        },
        {
          title: "Repair",
          description: "Staff update progress and attach repair evidence.",
          role: "Staff",
        },
        {
          title: "Close request",
          description: "The administrator verifies the result and closes it.",
          role: "Admin",
        },
      ];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(
      () => setActiveStep((current) => (current + 1) % steps.length),
      1800,
    );
    return () => window.clearInterval(interval);
  }, [steps.length]);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-2xl bg-slate-900 px-6 py-8 text-white sm:px-10 sm:py-10">
        <p className="text-sm font-bold text-orange-300">
          {th ? "วิธีการทำงาน" : "HOW IT WORKS"}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {th ? "ติดตามงานซ่อมได้ทุกขั้นตอน" : "See every step of your request"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          {th
            ? "แอนิเมชันนี้แสดงเส้นทางหลักตั้งแต่แจ้งปัญหาจนถึงปิดงาน กดแต่ละขั้นเพื่ออ่านรายละเอียด"
            : "This animation follows the standard path from an issue report to a completed request. Select any stage for its details."}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <p className="sr-only" aria-live="polite">
          {th
            ? `กำลังแสดงขั้นตอน: ${steps[activeStep].title}`
            : `Showing stage: ${steps[activeStep].title}`}
        </p>
        <ol className="grid gap-3 lg:grid-cols-5 lg:gap-4">
          {steps.map((step, index) => {
            const isActive = activeStep === index;
            return (
              <li key={step.title} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-400 ${isActive ? "border-orange-300 bg-orange-50 shadow-sm" : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"}`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${isActive ? "animate-pulse bg-[#ee641b] text-white motion-reduce:animate-none" : "bg-slate-100 text-slate-500"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="mt-4 block text-sm font-extrabold text-slate-900">
                    {step.title}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#d94e0b]">
                    {step.role}
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-slate-600">
                    {step.description}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-3 left-1/2 h-3 border-l-2 border-dashed border-orange-200 lg:-right-2 lg:bottom-auto lg:left-auto lg:top-1/2 lg:h-0 lg:w-4 lg:border-l-0 lg:border-t-2"
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-7 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-extrabold">
              {th ? "หากงานต้องแก้ไขเพิ่มเติม" : "If more work is needed"}
            </p>
            <p className="mt-1 leading-5">
              {th
                ? "ผู้ดูแลจะส่งงานกลับไปที่เจ้าหน้าที่พร้อมคำแนะนำ แล้วดำเนินการตรวจรับอีกครั้ง"
                : "The administrator returns the task to staff with guidance, then verifies it again after the update."}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-900">
            <p className="font-extrabold">
              {th ? "หากคำขอไม่ผ่านการอนุมัติ" : "If a request is not approved"}
            </p>
            <p className="mt-1 leading-5">
              {th
                ? "รายการจะถูกปิดเป็น “ไม่อนุมัติ” พร้อมเหตุผลที่ผู้ดูแลบันทึกไว้"
                : "The request is marked as rejected with the reason recorded by the administrator."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  reports,
  metrics,
  onNew,
  onViewAll,
}: {
  reports: Report[];
  metrics: { open: number; review: number; progress: number; closed: number };
  onNew: () => void;
  onViewAll: () => void;
}) {
  const { language } = useLanguage();
  const th = language === "th";
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-[#e65d15]">
            {th ? appConfig.nameTh : appConfig.name.toUpperCase()}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {th ? "บริการแจ้งซ่อม" : "Maintenance service"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {th
              ? "ภาพรวมรายการแจ้งซ่อมในระบบ"
              : "Here’s an overview of your maintenance requests."}
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ee641b] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95612]"
        >
          <Icon name="plus" className="h-4 w-4" />
          {th ? "แจ้งซ่อม" : "Submit a request"}
        </button>
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: th ? "รายการที่ยังเปิดอยู่" : "Open requests",
            value: metrics.open,
            icon: "file",
            tone: "bg-orange-50 text-[#e65d15]",
          },
          {
            label: th ? "รอตรวจสอบ" : "Awaiting review",
            value: metrics.review,
            icon: "clock",
            tone: "bg-amber-50 text-amber-600",
          },
          {
            label: th ? "กำลังดำเนินการ" : "In progress",
            value: metrics.progress,
            icon: "setting",
            tone: "bg-violet-50 text-violet-600",
          },
          {
            label: th ? "ปิดงานเดือนนี้" : "Completed this month",
            value: metrics.closed,
            icon: "grid",
            tone: "bg-emerald-50 text-emerald-600",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">
                {metric.label}
              </p>
              <div className={`rounded-lg p-2 ${metric.tone}`}>
                <Icon name={metric.icon} className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-slate-900">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {th ? "อัปเดตล่าสุด" : "Updated just now"}
            </p>
          </div>
        ))}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-bold text-slate-900">
                {th ? "รายการแจ้งซ่อมล่าสุด" : "Recent requests"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {th
                  ? "ติดตามสถานะล่าสุดของรายการแจ้งซ่อม"
                  : "Track the latest activity on your reports"}
              </p>
            </div>
            <button
              onClick={onViewAll}
              className="text-sm font-bold text-[#df5711]"
            >
              {th ? "ดูทั้งหมด" : "View all"}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {reports.slice(0, 4).map((report) => (
              <div
                key={report.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="hidden rounded-lg bg-slate-100 p-2.5 text-slate-500 sm:block">
                  <Icon name="setting" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {report.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {report.id} · {report.location}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <StatusBadge status={report.status} />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {report.updated}
                  </p>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-[#26333e] p-6 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Icon name="clock" className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-lg font-bold">
            {th ? "ต้องการความช่วยเหลือเร่งด่วน?" : "Need urgent help?"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {th
              ? "หากเป็นเหตุฉุกเฉินด้านความปลอดภัย น้ำ หรือไฟฟ้า โปรดติดต่อฝ่ายอาคารสถานที่โดยตรง"
              : "For emergencies involving safety, water, or electricity, contact the facilities desk directly."}
          </p>
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              {th ? "ศูนย์ช่วยเหลือ" : "Service help desk"}
            </p>
            <p className="mt-1 font-bold">02-329-8000 ext. 2196</p>
          </div>
          <button className="mt-5 text-sm font-bold text-[#ff9b61]">
            {th ? "ดูคู่มือการใช้บริการ →" : "View service guide →"}
          </button>
        </div>
      </section>
    </>
  );
}

function PublicRequestQueue({
  reports,
  pagination,
  state,
  onClose,
  onPageChange,
}: {
  reports: Report[];
  pagination?: Pagination;
  state: "loading" | "ready" | "error";
  onClose: () => void;
  onPageChange: (page: number) => void;
}) {
  const { language } = useLanguage();
  const th = language === "th";

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#e65d15]">
            {th ? "รายการแจ้งซ่อมทั้งหมด" : "ALL REQUESTS"}
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">
            {th ? "รายการแจ้งซ่อมในระบบ" : "System maintenance requests"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {pagination?.total ?? 0} {th ? "รายการ" : "requests"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
        >
          {th ? "ปิด" : "Close"}
        </button>
      </div>
      <div className="mt-5 divide-y divide-slate-100">
        {state === "loading" && (
          <p className="py-8 text-center text-sm text-slate-500">
            {th ? "กำลังโหลดรายการแจ้งซ่อม…" : "Loading maintenance requests…"}
          </p>
        )}
        {state === "error" && (
          <p className="py-8 text-center text-sm text-red-700">
            {th
              ? "ไม่สามารถโหลดรายการแจ้งซ่อมได้"
              : "Unable to load maintenance requests."}
          </p>
        )}
        {state === "ready" &&
          reports.map((report) => (
            <article
              key={report.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {report.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.id} · {localizeCategory(report.category, language)} ·{" "}
                  {report.location}
                </p>
              </div>
              <StatusBadge status={report.status} />
            </article>
          ))}
        {state === "ready" && reports.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            {th ? "ยังไม่มีรายการแจ้งซ่อม" : "No maintenance requests yet."}
          </p>
        )}
      </div>
      {(pagination?.totalPages ?? 0) > 1 && (
        <nav
          aria-label={th ? "หน้ารายการแจ้งซ่อม" : "Request pages"}
          className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"
        >
          <button
            type="button"
            disabled={pagination?.page === 1 || state !== "ready"}
            onClick={() => onPageChange((pagination?.page ?? 1) - 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {th ? "ก่อนหน้า" : "Previous"}
          </button>
          <p className="text-sm font-semibold text-slate-600">
            {th
              ? `หน้า ${pagination?.page ?? 1} จาก ${pagination?.totalPages ?? 1}`
              : `Page ${pagination?.page ?? 1} of ${pagination?.totalPages ?? 1}`}
          </p>
          <button
            type="button"
            disabled={
              pagination?.page === pagination?.totalPages || state !== "ready"
            }
            onClick={() => onPageChange((pagination?.page ?? 1) + 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {th ? "ถัดไป" : "Next"}
          </button>
        </nav>
      )}
    </section>
  );
}

function NewRequest({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const { language } = useLanguage();
  const th = language === "th";
  return (
    <>
      <div>
        <p className="text-sm font-semibold text-[#e65d15]">
          {th ? "แจ้งซ่อมใหม่" : "NEW MAINTENANCE REQUEST"}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          {th ? "แจ้งปัญหา" : "Report an issue"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {th
            ? "ระบุรายละเอียดให้มากที่สุดเพื่อให้ทีมงานช่วยเหลือได้รวดเร็ว"
            : "Provide as much detail as possible so our team can help quickly."}
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-4xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="field-label">
              {th ? "หัวข้อปัญหา" : "Issue title"} <b>*</b>
            </span>
            <input
              required
              name="title"
              className="field-input"
              placeholder={
                th
                  ? "เช่น เครื่องปรับอากาศรั่ว"
                  : "e.g. Air conditioner leaking"
              }
            />
          </label>
          <label>
            <span className="field-label">
              {th ? "หมวดหมู่" : "Category"} <b>*</b>
            </span>
            <select required name="category" className="field-input">
              <option value="">
                {th ? "เลือกหมวดหมู่" : "Select a category"}
              </option>
              <option value="Electrical">{th ? "ไฟฟ้า" : "Electrical"}</option>
              <option value="Plumbing">{th ? "ประปา" : "Plumbing"}</option>
              <option value="Air conditioner">
                {th ? "เครื่องปรับอากาศ" : "Air conditioner"}
              </option>
              <option value="Internet">
                {th ? "อินเทอร์เน็ต" : "Internet"}
              </option>
              <option value="Furniture">
                {th ? "เฟอร์นิเจอร์" : "Furniture"}
              </option>
              <option value="Cleaning">{th ? "ความสะอาด" : "Cleaning"}</option>
              <option value="Security">
                {th ? "ความปลอดภัย" : "Security"}
              </option>
              <option value="Other">{th ? "อื่น ๆ" : "Other"}</option>
            </select>
          </label>
          <label>
            <span className="field-label">
              {th ? "ความสำคัญ" : "Priority"} <b>*</b>
            </span>
            <select
              required
              name="priority"
              defaultValue="Medium"
              className="field-input"
            >
              <option value="Low">{th ? "ต่ำ" : "Low"}</option>
              <option value="Medium">{th ? "ปานกลาง" : "Medium"}</option>
              <option value="High">{th ? "สูง" : "High"}</option>
            </select>
          </label>
          <LocationPicker th={th} />
          <label className="md:col-span-2">
            <span className="field-label">
              {th ? "รายละเอียดปัญหา" : "Describe the issue"} <b>*</b>
            </span>
            <textarea
              required
              name="description"
              className="field-input min-h-32 resize-y"
              placeholder={
                th
                  ? "อธิบายปัญหา เวลาเริ่มเกิดเหตุ และข้อมูลอื่นที่เป็นประโยชน์…"
                  : "Tell us what happened, when it started, and anything else that may help..."
              }
            />
          </label>
          <div className="md:col-span-2">
            <span className="field-label">
              {th ? "รูปภาพ" : "Photos"}{" "}
              <span className="font-normal text-slate-400">
                {th ? "(ไม่บังคับ)" : "(optional)"}
              </span>
            </span>
            <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-[#ee641b] hover:bg-orange-50">
              <Icon name="upload" className="h-6 w-6 text-[#e65d15]" />
              <span className="mt-2 text-sm font-semibold text-slate-700">
                {th ? "อัปโหลดรูปภาพ" : "Upload photos"}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                {th
                  ? "PNG, JPG, WEBP หรือ PDF ขนาดไม่เกิน 10MB ต่อไฟล์"
                  : "PNG, JPG, WEBP, or PDF up to 10MB each"}
              </span>
              <input
                name="attachments"
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
              />
            </label>
          </div>
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            {th ? "ยกเลิก" : "Cancel"}
          </button>
          <button
            disabled={isSubmitting}
            className="rounded-lg bg-[#ee641b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d95612] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? th
                ? "กำลังส่ง…"
                : "Submitting…"
              : th
                ? "ส่งคำขอ"
                : "Submit request"}
          </button>
        </div>
      </form>
    </>
  );
}

function LocationPicker({ th }: { th: boolean }) {
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState("");
  const mapUrl = coordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.longitude - 0.004}%2C${coordinates.latitude - 0.0025}%2C${coordinates.longitude + 0.004}%2C${coordinates.latitude + 0.0025}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}`
    : "https://www.openstreetmap.org/export/embed.html?bbox=100.485%2C13.720%2C100.545%2C13.770&layer=mapnik";

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError(
        th
          ? "เบราว์เซอร์นี้ไม่รองรับตำแหน่งปัจจุบัน"
          : "This browser does not support location services.",
      );
      return;
    }
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () =>
        setLocationError(
          th
            ? "ไม่สามารถอ่านตำแหน่งปัจจุบันได้ โปรดอนุญาตการเข้าถึงตำแหน่ง"
            : "Unable to get your location. Please allow location access.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1">
          <span className="field-label">
            {th ? "คำอธิบายสถานที่" : "Place description"} <b>*</b>
          </span>
          <input
            required
            name="location"
            className="field-input"
            placeholder={
              th
                ? "อาคาร ชั้น ห้อง หรือจุดสังเกตใกล้เคียง"
                : "Building, floor, room, or nearby landmark"
            }
          />
        </label>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-sm font-bold text-[#d94e0b]"
        >
          {th ? "ใช้ตำแหน่งปัจจุบัน" : "Use my location"}
        </button>
      </div>
      <input
        type="hidden"
        name="latitude"
        value={coordinates?.latitude ?? ""}
      />
      <input
        type="hidden"
        name="longitude"
        value={coordinates?.longitude ?? ""}
      />
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <iframe
          title={th ? "แผนที่ตำแหน่ง" : "Location map"}
          src={mapUrl}
          className="h-56 w-full border-0"
          loading="lazy"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {coordinates
          ? th
            ? `พิกัดที่เลือก: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
            : `Selected coordinates: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
          : th
            ? "กดปุ่มเพื่อเลือกตำแหน่งปัจจุบันบนแผนที่"
            : "Use the button to select your current location on the map."}
      </p>
      {locationError && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {locationError}
        </p>
      )}
    </div>
  );
}

function Reports({
  reports,
  pagination,
  selectedStatus,
  onStatusChange,
  onPageChange,
  onNew,
}: {
  reports: Report[];
  pagination?: Pagination;
  selectedStatus: "ALL" | Status;
  onStatusChange: (status: "ALL" | Status) => void;
  onPageChange: (page: number) => void;
  onNew: () => void;
}) {
  const { language } = useLanguage();
  const th = language === "th";
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#e65d15]">
            {th ? "ประวัติการแจ้งซ่อม" : "REQUEST HISTORY"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            {th ? "รายการของฉัน" : "My reports"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {th
              ? "ดูสถานะและความเคลื่อนไหวล่าสุดของทุกรายการ"
              : "View the current status and latest activity for every request."}
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ee641b] px-4 py-3 text-sm font-bold text-white"
        >
          <Icon name="plus" className="h-4 w-4" />
          {th ? "แจ้งซ่อม" : "Submit a request"}
        </button>
      </div>
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-500">
            {pagination?.total ?? 0} {th ? "รายการ" : "requests"}
            {selectedStatus === "ALL" ? (th ? " ทั้งหมด" : " total") : ""}
          </p>
          <select
            value={selectedStatus}
            onChange={(event) =>
              onStatusChange(event.target.value as "ALL" | Status)
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
          >
            <option value="ALL">{th ? "ทุกสถานะ" : "All statuses"}</option>
            {(Object.keys(thaiStatus) as Status[]).map((status) => (
              <option key={status} value={status}>
                {th ? thaiStatus[status] : status}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">
                  {th ? "รายการ" : "Request"}
                </th>
                <th className="px-6 py-3 font-semibold">
                  {th ? "สถานที่" : "Location"}
                </th>
                <th className="px-6 py-3 font-semibold">
                  {th ? "ความสำคัญ" : "Priority"}
                </th>
                <th className="px-6 py-3 font-semibold">
                  {th ? "สถานะ" : "Status"}
                </th>
                <th className="px-6 py-3 font-semibold">
                  {th ? "อัปเดตล่าสุด" : "Last updated"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="transition hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {report.dbId ? (
                      <Link href={`/reports/${report.dbId}`} className="block">
                        <p className="text-sm font-bold text-slate-800">
                          {report.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {report.id} ·{" "}
                          {localizeCategory(report.category, language)}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800">
                          {report.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {report.id} ·{" "}
                          {localizeCategory(report.category, language)}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {report.location}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm font-semibold ${report.priority === "High" ? "text-red-600" : report.priority === "Medium" ? "text-amber-600" : "text-slate-500"}`}
                    >
                      {localizePriority(report.priority, language)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {report.updated}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    {th
                      ? "ไม่พบรายการในสถานะนี้"
                      : "No reports match this status."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(pagination?.totalPages ?? 0) > 1 && (
          <nav
            aria-label={th ? "หน้ารายการของฉัน" : "My report pages"}
            className="flex items-center justify-between border-t border-slate-100 p-4"
          >
            <button
              type="button"
              disabled={pagination?.page === 1}
              onClick={() => onPageChange((pagination?.page ?? 1) - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {th ? "ก่อนหน้า" : "Previous"}
            </button>
            <p className="text-sm font-semibold text-slate-600">
              {th
                ? `หน้า ${pagination?.page ?? 1} จาก ${pagination?.totalPages ?? 1}`
                : `Page ${pagination?.page ?? 1} of ${pagination?.totalPages ?? 1}`}
            </p>
            <button
              type="button"
              disabled={pagination?.page === pagination?.totalPages}
              onClick={() => onPageChange((pagination?.page ?? 1) + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {th ? "ถัดไป" : "Next"}
            </button>
          </nav>
        )}
      </div>
    </>
  );
}

export type UiLanguage = "th" | "en";

const statuses: Record<string, { th: string; en: string }> = {
  SUBMITTED: { th: "รับเรื่องแล้ว", en: "Submitted" },
  UNDER_REVIEW: { th: "กำลังตรวจสอบ", en: "Under review" },
  REJECTED: { th: "ไม่อนุมัติ", en: "Rejected" },
  APPROVED: { th: "อนุมัติแล้ว", en: "Approved" },
  ASSIGNED: { th: "มอบหมายแล้ว", en: "Assigned" },
  IN_PROGRESS: { th: "กำลังดำเนินการ", en: "In progress" },
  COMPLETED_BY_STAFF: {
    th: "เจ้าหน้าที่ดำเนินการเสร็จ",
    en: "Completed by staff",
  },
  NEEDS_REVISION: { th: "ต้องแก้ไข", en: "Needs revision" },
  CLOSED: { th: "ปิดงานแล้ว", en: "Closed" },
};

const priorities: Record<string, { th: string; en: string }> = {
  LOW: { th: "ต่ำ", en: "Low" },
  MEDIUM: { th: "ปานกลาง", en: "Medium" },
  HIGH: { th: "สูง", en: "High" },
};

const categories: Record<string, { th: string; en: string }> = {
  Electrical: { th: "ไฟฟ้า", en: "Electrical" },
  Plumbing: { th: "ประปา", en: "Plumbing" },
  "Air conditioner": { th: "เครื่องปรับอากาศ", en: "Air conditioner" },
  Internet: { th: "อินเทอร์เน็ต", en: "Internet" },
  Furniture: { th: "เฟอร์นิเจอร์", en: "Furniture" },
  Cleaning: { th: "ความสะอาด", en: "Cleaning" },
  Security: { th: "ความปลอดภัย", en: "Security" },
  Other: { th: "อื่น ๆ", en: "Other" },
};

export function localizeStatus(status: string, language: UiLanguage) {
  const key = status.replaceAll(" ", "_").toUpperCase();
  return statuses[key]?.[language] ?? status.replaceAll("_", " ");
}

export function localizePriority(priority: string, language: UiLanguage) {
  return priorities[priority.toUpperCase()]?.[language] ?? priority;
}

export function localizeCategory(category: string, language: UiLanguage) {
  return categories[category]?.[language] ?? category;
}

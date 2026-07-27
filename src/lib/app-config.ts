// Customer-facing branding: change these defaults or set the matching NEXT_PUBLIC_ variables.
export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Service Portal",
  nameTh: process.env.NEXT_PUBLIC_APP_NAME_TH?.trim() || "ศูนย์บริการ",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "S",
};

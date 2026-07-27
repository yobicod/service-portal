export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/reports/:path*"],
};

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !(await compare(password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = String(token.id);
      session.user.role = token.role as Role;
      return session;
    },
    authorized: ({ auth: session, request }) => {
      const pathname = request.nextUrl.pathname;
      if (!session?.user) return false;
      if (pathname.startsWith("/admin")) return session.user.role === Role.ADMIN;
      if (pathname.startsWith("/staff")) return session.user.role === Role.STAFF;
      return true;
    },
  },
});

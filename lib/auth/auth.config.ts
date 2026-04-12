import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma, no bcrypt, no Node.js-only modules.
// Used by middleware to validate JWTs without bloating the Edge bundle.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // Credentials provider added in auth.ts (server-only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};

import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    companyId?: string;
  }

  interface Session {
    user: User & {
      id?: string;
      companyId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    companyId?: string;
  }
}

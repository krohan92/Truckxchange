import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch, setToken, clearToken, getToken } from "@/src/api/client";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "renter" | "owner" | "vendor" | "admin";
  license_verified: boolean;
  insurance_verified: boolean;
  license_info?: any;
  insurance_info?: any;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  loginAs: (role: "renter" | "owner" | "vendor" | "admin") => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SEED: Record<string, { email: string; password: string }> = {
  renter: { email: "renter@rigrent.com", password: "Renter12345!" },
  owner: { email: "owner@rigrent.com", password: "Owner12345!" },
  vendor: { email: "vendor@rigrent.com", password: "Vendor12345!" },
  admin: { email: "admin@rigrent.com", password: "Admin12345!" },
};

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) {
        const me = await apiFetch<User>("/auth/me");
        setUser(me);
        setLoading(false);
        return;
      }
    } catch {
      await clearToken();
    }
    // Sign-in temporarily disabled — auto-enter as a trucker for testing.
    try {
      const res = await apiFetch<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        auth: false,
        body: SEED.renter,
      });
      await setToken(res.token);
      setUser(res.user);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    await setToken(res.token);
    setUser(res.user);
  };

  const loginAs = async (role: "renter" | "owner" | "vendor" | "admin") => {
    const creds = SEED[role];
    await login(creds.email, creds.password);
  };

  const register = async (name: string, email: string, password: string, role: string) => {
    const res = await apiFetch<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      auth: false,
      body: { name, email, password, role },
    });
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, loginAs, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

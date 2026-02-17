"use client";

import { useEffect, useState } from "react";
import {
  ClientSafeProvider,
  getProviders,
  signIn,
} from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import { useLoginModal } from "@/lib/store";

type Props = {
  closeModal?: () => void;
};

const LoginComponent = ({ closeModal }: Props) => {
  const { onClose } = useLoginModal();

  // 🔐 Credentials State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🌍 OAuth Providers
  const [providers, setProviders] =
    useState<Record<string, ClientSafeProvider> | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
    };
    fetchProviders();
  }, []);

  /**
   * 🔐 Credentials Login
   */
  const handleCredentialsLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError(null);
    setCredentialsLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      if (!res || res.error) {
        setError("Invalid username or password");
        return;
      }

      onClose();
      closeModal?.();
      window.location.assign(res.url ?? "/");
    } catch (err) {
      console.error("Credentials login failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setCredentialsLoading(false);
    }
  };

  /**
   * 🌍 OAuth Login
   */
  const handleOAuthLogin = async (providerId: string) => {
    setOauthLoading(providerId);
    setError(null);

    try {
      const res = await signIn(providerId, {
        redirect: false,
        callbackUrl: "/",
      });

      if (!res) throw new Error("No response from signIn");
      if (res.error) throw new Error(res.error);

      onClose();
      closeModal?.();
      window.location.assign(res.url ?? "/");
    } catch (err) {
      console.error("OAuth login failed:", err);
      setError("Login failed. Please try again.");
    } finally {
      setOauthLoading(null);
    }
  };

  /**
   * 🎨 Provider Icon Helper
   */
  const getProviderIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "google":
        return <FcGoogle size={22} />;
      case "facebook":
        return <FaFacebook size={22} className="text-[#1877F2]" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* 🔐 Credentials Form */}
      <form
        onSubmit={handleCredentialsLogin}
        className="flex flex-col space-y-4"
      >
        <div>
          <label className="text-sm font-medium text-slate-600">
            Username or Email
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600">
            Password
          </label>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={credentialsLoading}
          className="
            flex h-[44px] items-center justify-center rounded-xl
            bg-green-600 text-white text-sm font-semibold
            transition-all duration-200
            hover:bg-green-700
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {credentialsLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <span className="relative bg-white px-4 text-xs text-slate-400">
          OR CONTINUE WITH
        </span>
      </div>

      {/* 🌍 OAuth Buttons */}
      {!providers ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-[48px] w-full animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.values(providers)
            .filter((p) => p.id !== "credentials")
            .map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuthLogin(provider.id)}
                className="
                  flex min-h-[48px] w-full items-center justify-center gap-3
                  rounded-xl border border-slate-200 bg-slate-50
                  px-4 py-3 text-sm font-semibold text-slate-700
                  shadow-sm transition-all duration-200
                  hover:bg-green-50 hover:border-green-200 hover:text-green-700
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {oauthLoading === provider.id ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                ) : (
                  getProviderIcon(provider.name)
                )}
                <span>Continue with {provider.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default LoginComponent;

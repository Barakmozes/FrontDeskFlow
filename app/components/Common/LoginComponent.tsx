"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const LoginComponent = () => {
  const [username, setUsername] = useState(""); // maps to User.email
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setLoading(false);

    if (!res || res.error) {
      setError("Invalid username or password");
      return;
    }

    window.location.href = res.url ?? "/";
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col space-y-4">
      <div>
        <label className="form-label">Username or email</label>
        <input
          className="formInput"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>

      <div>
        <label className="form-label">Password</label>
        <input
          className="formInput"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button disabled={loading} className="form-button" type="submit">
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
};

export default LoginComponent;

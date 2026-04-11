"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setError("Wrong password. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-jarvis-bg flex items-center justify-center">
      <div className="bg-jarvis-surface border border-jarvis-border rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-2">JARVIS</h1>
        <p className="text-jarvis-muted text-center text-sm mb-8">AI Chief of Staff</p>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-4 py-3 text-white placeholder-jarvis-muted mb-3 focus:outline-none focus:border-indigo-500"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Entering..." : "Enter Jarvis"}
        </button>
      </div>
    </div>
  );
}

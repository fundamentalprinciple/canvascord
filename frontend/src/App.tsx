import { useState } from "react";
import { getCurrentUser, login, register, type AuthUser } from "./lib/auth";

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result =
        mode === "register"
          ? await register(username, email, password)
          : await login(identifier, password);

      const profile = await getCurrentUser(result.token);
      setToken(result.token);
      setUser(profile);
      setPassword("");
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { error?: string } } })
          .response;
        setError(response?.data?.error ?? "Authentication failed.");
      } else {
        setError("Could not connect to the server.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setToken("");
    setUser(null);
    setPassword("");
    setError("");
  }

  if (token && user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] p-6 text-gray-100">
        <section className="w-full max-w-md rounded-2xl bg-[#2b2d31] p-8 shadow-xl">
          <h1 className="mb-2 text-3xl font-bold">CanvasCord</h1>
          <p className="mb-8 text-gray-400">
            Your creative community starts here.
          </p>
          <h2 className="mb-2 text-xl font-semibold">
            Welcome, {user.username}!
          </h2>
          <p className="mb-6 text-sm text-gray-400">{user.email}</p>
          <p className="mb-6 rounded-lg bg-[#383a40] p-3 text-sm text-green-400">
            Successfully authenticated with the CanvasCord backend.
          </p>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500"
          >
            Log out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1e1f22] p-6 text-gray-100">
      <section className="w-full max-w-md rounded-2xl bg-[#2b2d31] p-8 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold">CanvasCord</h1>
        <p className="mb-8 text-gray-400">
          Create, share, and connect with your community.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-[#1e1f22] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-md px-3 py-2 ${mode === "login" ? "bg-[#404249] text-white" : "text-gray-400"}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-md px-3 py-2 ${mode === "register" ? "bg-[#404249] text-white" : "text-gray-400"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <>
              <label className="block text-sm text-gray-300">
                Username
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]+"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-lg bg-[#383a40] px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="your_username"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg bg-[#383a40] px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@example.com"
                />
              </label>
            </>
          ) : (
            <label className="block text-sm text-gray-300">
              Username or email
              <input
                required
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="mt-2 w-full rounded-lg bg-[#383a40] px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Username or email"
              />
            </label>
          )}

          <label className="block text-sm text-gray-300">
            Password
            <input
              required
              minLength={12}
              maxLength={128}
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg bg-[#383a40] px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 12 characters"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-950 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthDebugPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const testLogin = async () => {
    setError("");
    setResult(null);
    try {
      const resp = await fetch("/api/debug/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await resp.json();
      setResult({ status: resp.status, body: json });
    } catch (e: any) {
      setError(e?.message || "request failed");
    }
  };

  const checkSession = async () => {
    setError("");
    try {
      const resp = await fetch("/api/debug/auth/session");
      const json = await resp.json();
      setSession({ status: resp.status, body: json });
    } catch (e: any) {
      setError(e?.message || "request failed");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Auth Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <label htmlFor="email">Email</label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="pwd">Password</label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={testLogin}>Test Login</Button>
            <Button variant="outline" onClick={checkSession}>Check Session</Button>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          {result && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
{JSON.stringify(result, null, 2)}
            </pre>
          )}
          {session && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
{JSON.stringify(session, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


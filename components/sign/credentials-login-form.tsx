"use client";
import React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useAppContext } from "@/contexts/app";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function CredentialsLoginForm({
  hideRegisterLink = false,
  onSwitchToRegister,
}: {
  hideRegisterLink?: boolean;
  onSwitchToRegister?: () => void;
} = {}) {
  const { setShowSignModal } = useAppContext();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!isValidEmail(email)) {
      setError("请输入有效邮箱")
      return
    }
    if (!password || password.length < 8) {
      setError("密码至少8位")
      return
    }
    try {
      setLoading(true)
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!resp.ok) {
        throw new Error("登录失败")
      }
      // redirect to home
      window.location.href = "/"
    } catch (e) {
      setError("邮箱或密码错误")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">密码</Label>
        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      {error && <div role="alert" className="text-sm text-red-500">{error}</div>}
      <Button type="submit" disabled={loading}>{loading ? '登录中…' : '登录'}</Button>
      {!hideRegisterLink && (
        <div className="text-sm text-center text-muted-foreground">
          还没有账号？
          <Link
            href="/auth/register"
            className="underline underline-offset-4"
            onClick={() => setShowSignModal(false)}
          >
            去注册
          </Link>
        </div>
      )}
      {hideRegisterLink && onSwitchToRegister && (
        <div className="text-sm text-center text-muted-foreground">
          还没有账号？
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={onSwitchToRegister}
          >
            去注册
          </button>
        </div>
      )}
    </form>
  )
}

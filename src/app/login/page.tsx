"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Notice, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";

// 邮箱登录（魔法链接）。未配置云端时如实说明，不制造假的登录成功。
export default function LoginPage() {
  const { signInWithEmail, cloudAvailable, user, signOut, toast } = useStore();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    setSending(true);
    setFailed(false);
    try {
      const result = await signInWithEmail(email);
      setMessage(result.message);
      setFailed(!result.ok);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="SIGN IN"
        title="登录捕梦"
        description="登录后，灵感和作品会保存到你的账号里，换设备也能继续写。"
      />

      <Card className="max-w-[560px]">
        {!cloudAvailable ? (
          <Notice tone="warn">
            这个站点还没有配置云端账号（缺少 <code>NEXT_PUBLIC_SUPABASE_URL</code> 与{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>）。
            你仍然可以使用全部本地功能，数据会保存在这台浏览器里。
            <div className="mt-3">
              <Link href="/" className="cd-btn">
                回到首页
              </Link>
            </div>
          </Notice>
        ) : user ? (
          <>
            <p className="cd-sub">
              你已经登录：<span className="break-all text-ink">{user.email}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/settings" className="cd-btn">
                去设置
              </Link>
              <Button onClick={() => void signOut().then(() => toast("已经退出登录。"))}>
                退出登录
              </Button>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="email" className="cd-small mb-1 block">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              className="cd-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <div className="mt-4">
              <Button variant="primary" onClick={() => void submit()} disabled={sending}>
                {sending ? "发送中…" : "发送登录链接"}
              </Button>
            </div>

            {message ? (
              <div className="mt-4">
                <Notice tone={failed ? "error" : "info"}>{message}</Notice>
              </div>
            ) : null}

            <p className="cd-small mt-4">
              捕梦不设密码：点开邮件里的链接就会自动登录。链接有效期内只能使用一次。
            </p>
          </>
        )}
      </Card>
    </>
  );
}

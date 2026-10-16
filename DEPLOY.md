# 让所有人都能打开：部署手册

目标：把捕梦变成一个公网网址（例如 `https://catch-dream.vercel.app`），
别人在手机或电脑上点开就能用。

**为什么必须由你来做这一步**：部署到公网需要往一个托管平台上登录你的账号。
我没有你的账号，也不应该替你注册。下面的步骤大约 10 分钟，只需要点几下。

---

## 先明确一件事：不配任何密钥也能用

这一点我已经在生产模式下实测过（`next build` + `next start`，不带任何环境变量）：

| 功能 | 零配置部署后 | 需要什么 |
| --- | --- | --- |
| 首页灵感记录、灵感库、我的作品、版本历史、导出 | ✅ 可用 | 无 |
| 自由写计时器、观察训练、思维训练、灵感抽卡 | ✅ 可用 | 无 |
| 文学回声 | ✅ 可用 | 无（走本地 40 部公版目录 + 意象联想） |
| AI 写作伙伴（诊断/润色/结构/声音/续写） | ⚠️ 明确提示未配置 | `DEEPSEEK_API_KEY` + `DEEPSEEK_MODEL` |
| 登录与跨设备云端同步 | ⚠️ 明确提示未配置 | Supabase 两项配置 |

也就是说：**你现在就可以直接部署，先给别人用起来，之后再补 AI 和云端账号。**
未配置的能力不会假装成功，页面上会写清楚该怎么开。

每个访问者的灵感和作品默认存在**他自己的浏览器**里，互相看不到，你也不需要为存储付费。

---

## 路线 A：网页操作（推荐，不需要装任何东西）

### 第 1 步：把代码放到 GitHub

1. 打开 <https://github.com/new>，Repository name 随便填（例如 `catch-dream`），
   选择 **Private**（私有）也可以部署，然后点 **Create repository**。
2. 在项目目录里执行下面两条命令（把地址换成你自己的）：

```bash
git remote add origin https://github.com/<你的用户名>/catch-dream.git
git push -u origin main
```

第一次推送会要求登录，按提示用浏览器授权即可。

> 仓库里已经有一个初始提交。`.env.local` 已被 `.gitignore` 排除，
> 密钥不会被推上去。

### 第 2 步：在 Vercel 导入

1. 打开 <https://vercel.com/signup>，用 GitHub 账号注册/登录（免费）。
2. 进入 <https://vercel.com/new>，在列表里找到刚推上去的仓库，点 **Import**。
3. 框架会自动识别成 Next.js。**Build Command、Output Directory、Install Command
   全部保持默认，不要改。**
4. 如果你想先跑起来看看，这一步可以先不填环境变量，直接点 **Deploy**。
5. 等 1～2 分钟，你会拿到一个 `https://xxx.vercel.app` 网址。
   **这个网址就是能发给任何人的地址。**

### 第 3 步（可选）：开启 AI 写作伙伴

1. 去 <https://platform.deepseek.com/> 注册并充值，创建一个 API Key。
2. Vercel 项目 → **Settings → Environment Variables**，添加：

| Name | Value | 环境 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 你的密钥 | Production / Preview 都勾上 |
| `DEEPSEEK_MODEL` | 例如 `deepseek-chat` | 同上 |

   模型名请以 DeepSeek 官方文档的当前可用列表为准，不要照抄过时名字。
3. 回到 **Deployments**，对最新一次部署点 **⋯ → Redeploy**。

> **改了环境变量必须 Redeploy 才会生效**，这是最常见的坑。

### 第 4 步（可选）：开启登录与跨设备同步

1. 去 <https://supabase.com> 新建一个项目（免费额度足够个人使用）。
2. 进入 **SQL Editor**，把项目里 `supabase/migrations/0001_init.sql`
   的全部内容粘贴进去执行。
3. 进入 **Project Settings → API**，复制两个值，加到 Vercel 的环境变量里：

| Name | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key（这个值本来就是公开的，真正的隔离靠数据库 RLS） |

4. 进入 **Authentication → URL Configuration**，在 **Redirect URLs** 里加入：

```
https://<你的域名>/auth/callback
http://localhost:3000/auth/callback
```

   不加这一条，邮件登录链接会跳转失败。
5. 再次 **Redeploy**。

---

## 路线 B：命令行（更快，但要装一次 CLI）

```bash
npx vercel login          # 会打开浏览器让你授权
npx vercel --prod         # 部署到生产环境
```

环境变量也可以在命令里加：

```bash
npx vercel env add DEEPSEEK_API_KEY production
npx vercel env add DEEPSEEK_MODEL production
npx vercel --prod         # 加完变量必须重新部署
```

---

## 只想临时给朋友看一眼

不部署也能演示，用隧道把本机端口暴露出去：

```bash
npx cloudflared tunnel --url http://localhost:3000
```

拿到的临时网址可以直接发人，关掉终端就失效。注意你的电脑必须开着，
而且对方用 AI 功能会消耗你本地的 API 额度。长期给别人用请走上面的正路。

---

## 想用自己的域名

Vercel 项目 → **Settings → Domains** → 添加你的域名，然后按提示去域名商处
配置 CNAME 或 A 记录。域名要单独购买（约 50～80 元/年，Vercel 也支持直接购买）。

---

## 部署后自检清单

打开你的网址，逐条确认：

- [ ] 首页能打开，样式正常（暖米白背景、左侧导航）
- [ ] 手机上打开是单列布局，顶部导航可以横向滑动
- [ ] 写一条灵感 → 刷新页面 → 内容还在
- [ ] 「文学回声」输入「太阳雨」→ 出现 3 条结果，每条都有来源链接和「来源已核对」
- [ ] 点「在微信读书里搜这本书」能打开
- [ ] 「AI 写作伙伴」：配了密钥就返回分析结果，没配就显示准确的配置提示
- [ ] 「设置」页的「服务端配置状态」与你的实际配置一致
- [ ] 把网址发给一个朋友，确认他也能打开

---

## 费用与安全提醒

- **Vercel**：个人项目免费额度足够，绑卡前不会产生费用。
- **Supabase**：免费额度足够个人写作使用。
- **DeepSeek**：按量计费。建议在平台里设置消费上限。项目内已内置限流
  （默认每 IP 每分钟 12 次，可用 `AI_RATE_LIMIT_MAX` 调整），但公开站点仍建议设上限。
- 密钥只放在托管平台的环境变量里，不要写进代码，也不要在聊天里发给任何人（包括我）。
- 站点上线后，任何访客都能写内容，但内容只存在他自己的浏览器里，
  不会进入你的数据库，也不会消耗你的存储。

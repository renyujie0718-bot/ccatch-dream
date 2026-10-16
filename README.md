# 捕梦 2.0 · Catch Dream

一个以「个人灵感收集 + 文学作品发现 + AI 写作陪伴」为核心的个人写作空间。
不是 AI 代写工具，也不是效率软件：它帮用户留下瞬间的想法，遇见真实的文学作品，
并且逐渐认出自己的写作声音。

技术栈：Next.js App Router + TypeScript + Tailwind CSS + Supabase（Auth + Postgres + RLS）+ DeepSeek。

**当前交付状态**：代码完整、可构建、可运行；本地已跑通 lint / 类型检查 / 单元测试 / 生产构建。
AI 与云端能力已实现但**未做真实调用验证**（本机没有 DeepSeek 密钥，也没有 Supabase 项目）。
详见第 7 节与第 9 节，那里逐项写明了「已验证」与「未验证」。

---

## 1. 功能

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 灵感输入为核心；右侧今日统计与练习卡片；下方最近灵感与作品 |
| 文学回声 | `/echo` | 提交灵感 → 得到带真实来源链接的作品推荐，并保留历史记录 |
| 灵感库 | `/inspirations` | 灵感 CRUD、全文搜索、标签增删与筛选、排序、转成文章草稿 |
| 灵感抽卡 | `/cards` | 抽取开放式引子，可带回首页或存进灵感库 |
| 观察训练 | `/observe` | 从物件/空间/声音/气味/动作切入的细节练习 |
| 思维训练 | `/think` | 同一件事换视角、隐藏信息、反常细节 |
| 自由写 | `/write` | 15 分钟计时器（开始/暂停/继续/重置）+ 实时保存 + 字数 |
| 我的作品 | `/works` | 作品列表、新建、导出、删除 |
| 作品编辑器 | `/works/[id]` | 自动保存（保存中/已保存/保存失败）、版本历史与恢复、导出 MD/TXT |
| AI 写作伙伴 | `/ai` | 写作诊断、轻度润色、结构分析、个人声音、继续写作（五种模式） |
| 成长记录 | `/growth` | 累计统计、连续记录、最近四周活动格子、分析记录 |
| 设置 | `/settings` | 登录/退出、把本机数据同步到云端、AI 偏好、数据导出与删除、隐私说明 |
| 登录 | `/login` | 邮箱魔法链接登录（未配置云端时如实说明） |

服务端接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/feedback` | 五种写作模式；Zod 校验 + 限流 + 统一 system prompt |
| POST | `/api/literary-echoes` | 本地目录检索 + 模型解释；来源链接永不来自模型 |
| GET | `/api/status` | 只返回「是否已配置」与模型名，不返回任何密钥 |
| GET | `/auth/callback` | 邮件登录回调，用一次性 code 换取会话 cookie |

---

## 2. 几个关键设计决定

**1）文学回声不做「假联网」。**
DeepSeek 的对话接口本身没有网页检索能力。与其声称「已联网搜索」，捕梦的做法是：
维护一份人工核对过的公版作品目录（40 部），检索从目录里挑候选，
模型只在目录范围内做语义判断与解释。作品名、作者、年代、链接全部来自本地数据，
模型无法捏造。界面上明确标注这是「AI 语义匹配」还是「本地目录关键词匹配」，
并如实写出检索范围。

**1.1）短意象怎么找到足够多的作品。**
只写一个词（「太阳雨」「初雪」「深夜」）时，纯字面匹配会漏掉大量真正相关的作品。
所以检索分两轮：

- **直接命中**：你原文里真的出现的词；
- **意象联想**：由 `src/lib/echo/expansion.ts` 这张人工维护的表，把具体意象接到目录里的基础词汇上
  （太阳雨 → 雨 / 阳光 / 云 / 夏天）。联想命中的权重更低（0.45），
  并且在界面上必须标注「雨 ← 太阳雨」，绝不伪装成你写过的词。

这张表右侧的每一个词都必须真实存在于目录中，由 `expansion.test.ts` 强制校验，
写错一个词就会测试失败，它不会悄悄变成一个空转的映射。

**2）模型输出必须回验。**
AI 伙伴的每条意见都要引用用户原文。服务端会用 `quoteExistsInText()`
逐条校验引用是否真的出现在原文里（忽略空白与引号差异），
对不上就整条丢弃并计数，绝不把模型改写的句子当成作者的原文展示。
`polish` 模式下，界面显示的「原文」由服务端回填，不取模型输出。

**3）没有密钥时不是崩溃，而是明确关闭。**
缺少 `DEEPSEEK_API_KEY` 时，`/api/ai/feedback` 返回 503 与
`AI_NOT_CONFIGURED`，界面给出「去配置哪个变量」的准确提示；
缺少 Supabase 配置时，整站退化为访客本地模式，非 AI 功能完全可用。

**4）访客与登录用户共用一套接口。**
`DreamStore` 定义了统一的异步数据接口，`GuestStore`（localStorage）与
`SupabaseStore`（云端 + RLS）各自实现它。页面不需要知道自己跑在哪种模式下。
登录后可以把本机已有内容一键同步到云端（只新增，不删除本地数据）。

---

## 3. 目录结构

```
.
├── .env.example                     # 环境变量模板（复制为 .env.local）
├── .npmrc / pnpm-workspace.yaml     # 依赖布局与构建脚本白名单（见第 9 节说明）
├── next.config.mjs
├── tailwind.config.ts               # 设计 token 映射到参考 HTML 的 CSS 变量
├── tsconfig.json / vitest.config.ts
├── scripts/
│   └── verify-catalog.mjs           # 逐条访问并核对文学目录的来源链接
├── supabase/
│   ├── migrations/0001_init.sql     # 建表 + RLS 策略 + 触发器（可执行）
│   └── tests/rls_isolation.sql      # 两个用户之间的隔离验证脚本
└── src/
    ├── middleware.ts                # 刷新 Supabase 会话 cookie
    ├── app/
    │   ├── layout.tsx / globals.css  # 全站外壳与设计系统
    │   ├── page.tsx                  # 首页
    │   ├── echo|cards|observe|think|write|works|ai|growth|settings|login/
    │   ├── works/[id]/page.tsx        # 作品编辑器
    │   ├── auth/callback/route.ts
    │   └── api/
    │       ├── ai/feedback/route.ts
    │       ├── literary-echoes/route.ts
    │       └── status/route.ts
    ├── components/
    │   ├── AppShell.tsx              # 左侧固定导航 / 窄屏顶部横向导航
    │   ├── ui.tsx                    # Button / Card / Notice / ConfirmDialog …
    │   ├── EchoResults.tsx           # 文学回声结果与来源标注
    │   └── SaveActions.tsx           # 存进灵感库 / 存为草稿
    └── lib/
        ├── ai/                       # modes / prompts / schemas / deepseek / contract
        ├── api/respond.ts            # 统一错误响应与「只记 id、状态码、耗时」的日志
        ├── data/                     # types / guest-store / supabase-store / store-provider
        ├── echo/                     # types / catalog（40 部作品）/ search / expansion（意象联想）
        ├── supabase/                 # client / server（服务端取 user id 的唯一入口）
        ├── training/prompts.ts       # 抽卡与训练题库
        ├── hooks/useAutosave.ts      # 防抖自动保存状态机
        ├── stats.ts / text.ts / export.ts / rate-limit.ts / api-client.ts / env.ts
        └── **/*.test.ts              # 8 个测试文件
```

---

## 4. 快速开始

### 4.1 环境要求

- Node.js ≥ 20.9（本项目在 Node 24 上验证）
- 包管理器：npm / pnpm 均可。仓库内包含 `pnpm-lock.yaml`。

### 4.2 安装与启动

```bash
npm install          # 或 pnpm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev          # http://localhost:3000
```

不填任何环境变量也可以直接运行：访客本地模式下的灵感、作品、计时器、
训练、抽卡、文学目录匹配全部可用。

### 4.3 环境变量

全部写在 `.env.local`（已被 `.gitignore` 忽略）。**AI 密钥绝不要加 `NEXT_PUBLIC_` 前缀。**

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | AI 功能必填 | 仅服务端读取 |
| `DEEPSEEK_MODEL` | 建议填 | 模型名以 DeepSeek 官方文档为准，**不要硬编码过时模型名**：<https://api-docs.deepseek.com/quick_start/pricing> |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_TIMEOUT_MS` | 否 | 默认 45000 |
| `NEXT_PUBLIC_SUPABASE_URL` | 云端必填 | Supabase 公开配置，会进入客户端 bundle（设计如此） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 云端必填 | 同上；真正的隔离由数据库 RLS 保证 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 仅当需要服务端管理员操作时才用，**永远不要**加 `NEXT_PUBLIC_` |
| `AI_MAX_INPUT_CHARS` | 否 | 单次分析的字数上限，默认 6000 |
| `AI_RATE_LIMIT_MAX` / `AI_RATE_LIMIT_WINDOW_SECONDS` | 否 | 每个 IP 的限流，默认 12 次 / 60 秒 |

### 4.4 初始化数据库（Supabase）

1. 在 <https://supabase.com> 新建项目，进入 **SQL Editor**。
2. 粘贴并执行 `supabase/migrations/0001_init.sql`。
   它会创建 7 张表（`profiles`、`inspirations`、`writings`、`writing_versions`、
   `literary_echoes`、`ai_feedback`、`preferences`），开启 RLS，并写入全部策略。
   脚本使用 `create table if not exists` 与 `drop policy if exists`，可以重复执行。
3. 在 **Project Settings → API** 复制 URL 与 anon key，填入 `.env.local`。
4. 在 **Authentication → URL Configuration** 里把
   `http://localhost:3000/auth/callback` 与线上域名加入 Redirect URLs，
   否则邮件登录链接会跳回失败。

### 4.5 验证 RLS 隔离（建议执行）

在 SQL Editor 中执行 `supabase/tests/rls_isolation.sql`。它会：

1. 建两个测试用户；
2. 以用户 A 写入数据，断言 A 只能看到自己的 1 行；
3. 切成用户 B，断言 B 看不到任何数据；
4. 断言 B 修改 A 的数据影响 0 行、替 A 插入会被拒绝、给 A 的作品写版本会被拒绝；
5. 断言 anon 角色完全无访问权限；
6. 最后 `ROLLBACK`，不留测试数据。

全部通过会输出 `RLS isolation test passed`。

> 说明：这个脚本由本项目提供，但开发环境里没有 Supabase 实例，
> **我没有实际执行过它**。请在你自己的项目上跑一次确认。

### 4.6 核对文学目录的来源链接

```bash
npm run check:catalog           # 只报告
node scripts/verify-catalog.mjs --write   # 把通过的条目标记为 verified: true
```

脚本会真实访问每条链接，并要求页面内容能印证这部作品（书名或作者姓氏命中），
两者同时满足才算通过；明细写入 `.catalog-verification.json`。
界面上「来源已核对 / 来源待核实」的标注就是由这个结果驱动的。

**本次交付的执行结果：40 / 40 条全部通过**（Project Gutenberg 39 条 + Standard Ebooks 1 条）。

---

## 5. 文学回声的实现边界

- 目录范围：40 部公版作品，来源为 Project Gutenberg 与 Standard Ebooks。
- 检索方式：本地倒排索引 + IDF 加权 + 意象联想（`src/lib/echo/search.ts`），完全可测试、可解释。
- 单字命中会被降权（×0.65），让更具体的线索排前面，避免靠一个「雨」字刷出一堆勉强结果。
- 模型职责：只在给定候选里挑选，并解释「为什么与你这段文字有关」「哪里不同」。
  模型返回的 `id` 若不在候选列表内，整条丢弃；来源 URL 永远取自目录。
- 没有联网搜索，也没有假装有。界面上直接写出这句话。
- 检索一无所获时返回空结果并给出写作建议，不硬凑推荐。

升级路径（可选的方案 A）：接入独立搜索 API，由后端取回来源再交给模型整理。
此时需要把 `src/app/api/literary-echoes/route.ts` 里的检索步骤换掉，
并保留「来源必须由后端验证」这条原则。

**关于微信读书 / 豆瓣的数据库：不能接，但可以跳转。**
微信读书（weread.qq.com）是腾讯的商业书库，没有公开 API，用户协议也禁止抓取，
抓它的数据既违法也违反协议。所以捕梦不碰它的数据库，只在每条推荐下面提供两个**跳转链接**：

- 在微信读书里搜索这本书（`https://weread.qq.com/web/search/books?keyword=<书名>`）
- 在豆瓣里看简介（`https://search.douban.com/book/subject_search?search_text=<书名>`）

链接只是把书名交给对方站点去搜，不在捕梦这边复制对方的内容。
这两条 URL 已实测返回 200。想做正经的中文书库检索，可走合法路径：
中国哲学书电子化计划（ctext）、维基文库、中华古籍资源库，或购买商业元数据 API。

---

## 6. 数据与隐私

- 访客模式：数据写在 `localStorage`（键名前缀 `catchdream:v2:`）。
  清理浏览器数据会丢失，界面上会在灵感库、作品页与侧栏反复提示。
- 云端模式：数据存在 Supabase，由 RLS 保证「用户 A 读不到用户 B 的行」。
  子表写入额外校验父记录归属，避免借用别人的 `writing_id`。
- 服务端日志只记录 request id、路由、状态码、耗时（`src/lib/api/respond.ts`），
  不记录用户正文，也不记录密钥。
- 使用 AI 时，用户提交的文本会发送给 DeepSeek 用于生成反馈，这一点在
  AI 页面与设置页都明确写出。
- 设置页提供「导出全部数据（JSON）」「导出全部作品（Markdown）」与「删除我的全部数据」。

---

## 7. 实际执行的验证结果

以下命令都在本机实际运行过，结果如实记录：

| 命令 | 结果 |
| --- | --- |
| `pnpm install` | ✅ 成功（本机没有 npm，只有 Node 与 pnpm） |
| `npm run lint` | ✅ 通过，0 错误 0 警告 |
| `npm run typecheck` | ✅ 通过（`tsc --noEmit`，strict 模式） |
| `npm test` | ✅ 8 个测试文件 / **63 个用例全部通过** |
| `npm run build` | ✅ 成功，产出 17 条路由（15 个页面 + 中间件 + 3 个 API） |
| `node scripts/verify-catalog.mjs` | ✅ 40 / 40 条来源链接核对通过 |
| 客户端 bundle 密钥检查 | ✅ 静态 chunk 中不含 `api.deepseek.com`、`openai` SDK、`SUPABASE_SERVICE_ROLE_KEY` |

关于上面最后一项的准确表述：客户端 chunk 里能搜到字符串 `DEEPSEEK_API_KEY`，
那是**变量名**出现在给用户的提示文案里（例如「请设置 DEEPSEEK_API_KEY 后重新部署」），
不是密钥值；任何密钥值、base URL 与 service role key 都没有进入客户端。

---

## 8. 部署到 Vercel

> 第一次部署的话，直接看 [DEPLOY.md](./DEPLOY.md)：那是一份按「点哪里」写的逐步手册，
> 包含零配置先上线、之后再补 AI 与云端账号的顺序，以及部署后的自检清单。

1. 把仓库推到 GitHub / GitLab。
2. Vercel → **Add New → Project** → 选择该仓库，框架会自动识别为 Next.js。
3. 在 **Settings → Environment Variables** 添加第 4.3 节里的变量
   （至少 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`NEXT_PUBLIC_SUPABASE_URL`、
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。建议 Production / Preview 都勾上。
4. 部署。**添加或修改环境变量后必须重新部署（Redeploy）才会生效**，
   这是 Vercel 的常见坑。
5. 回到 Supabase → Authentication → URL Configuration，
   把 `https://<你的域名>/auth/callback` 加入 Redirect URLs。
6. 用 `npm run build` 之外的方式（CLI）部署也可以：
   `npx vercel --prod`，同样需要在 Vercel 侧配置环境变量。

> 我没有部署，也没有线上 URL 可以提供。上面是逐步操作说明，不是「已上线」的声明。

---

## 8.1 不部署也想让朋友看到（临时分享）

本地服务器只在你自己的电脑上监听 `localhost`，别人点不开。要临时给朋友看，
用一条隧道把本机端口暴露成一个公网地址即可：

```bash
npx cloudflared tunnel --url http://localhost:3000
# 或
npx ngrok http 3000
```

拿到的临时网址可以直接发给朋友，关掉终端就失效。注意：

- 这种方式下你的电脑必须一直开着；
- 页面里的 AI 功能用的是你本地的环境变量，所以对方会消耗你的 API 额度；
- 不要用这种方式长期给别人用，也不要提交任何密钥。

想让所有人都能用、且不依赖你的电脑，按第 8 节部署到 Vercel。

## 8.2 手机上怎么用

**不用另外做手机版**：这是响应式网页，手机浏览器打开会自动变成单列布局，
导航从左侧栏变成顶部的横向滑动条。

想让它更像一个 App：在手机浏览器里打开网址，然后

- iPhone / Safari：分享 → 「添加到主屏幕」
- Android / Chrome：右上角菜单 → 「添加到主屏幕」（或「安装应用」）

添加后图标是捕梦的月牙，打开时没有地址栏（`display: standalone`），
相关配置在 `src/app/manifest.ts`，图标是 `src/app/icon.svg` 与 `src/app/apple-icon.png`。

**如果你要的是真的微信小程序**：那是另一个工程，不能把这份代码直接发布成小程序。
可选路线是

1. 用 uni-app / Taro 重写界面，把 `src/lib/` 里那套逻辑（字数统计、检索、
   自动保存状态机、API 客户端）直接复用；
2. 或者保留这个 Next.js 站点当后端，小程序只调用 `/api/literary-echoes`
   与 `/api/ai/feedback` 两个接口，界面单独写。

需要注意：小程序不能直接用邮箱魔法链接登录，得改成微信登录 + `wx.login` 换 Supabase 会话，
而且小程序请求域名必须备案并配置在微信后台的白名单里。

---

## 9. 已知限制与未验证项

**未验证（本机条件所限，如实说明）：**

1. **DeepSeek 真实调用**：没有密钥，未做过一次真实请求。请求参数、
   `response_format: json_object` 的降级路径、超时与错误文案都只经过了类型与代码审查。
2. **Supabase RLS 实际执行**：没有项目实例，`supabase/tests/rls_isolation.sql` 未运行过。
3. **浏览器端交互**：没有做 Playwright 端到端测试，自动保存、计时器、
   移动端导航的行为只经过代码走查与人工阅读。

**已知限制：**

1. 限流状态存在单个 Node 实例的内存里。多实例部署时每个实例各算各的，
   足以防止单人刷爆额度，但严格限流需要换成 Upstash Ratelimit 或平台 WAF 规则。
2. 文学目录只有 40 部，且以西方公版作品为主（中文作品为 Gutenberg 上的
   《吶喊》《朝花夕拾》《浮生六記》《陶庵夢憶》《道德經》《詩經》《唐詩三百首》等）。
   目录外没有覆盖；仍受版权保护的现代作品不在其中。
3. 「今天改动的作品字数」是当天更新过的作品总字数，不是精确的当日增量；
   界面上按这个口径标注。
4. 版本历史上限为每篇 20 个版本，超出会删除最旧的。
5. `npm run lint` 用的是 ESLint CLI 而不是 `next lint`：在本机环境里
   `next lint` 的依赖探测会误判 TypeScript 未安装并尝试重新安装依赖，
   因此改为直接调用 ESLint（检查规则来自 `eslint-config-next`，结果等价）。
6. 依赖布局使用扁平 `node_modules`（`.npmrc` + `pnpm-workspace.yaml` 里的
   `nodeLinker: hoisted`）。原因是 pnpm 默认的符号链接布局下，TypeScript
   无法从 `@supabase/supabase-js/dist/*.d.ts` 解析出 `@supabase/auth-js`
   等传递依赖，`client.auth.getSession()` 一类调用会全部报「属性不存在」。
7. `@supabase/ssr` 与 `@supabase/supabase-js` 锁定为精确版本
   （`0.5.2` / `2.47.10`），这是本次实际验证通过的组合。

**一个容易踩的坑：不要在 `next dev` 运行期间执行 `next build`。**
两者共用 `.next` 目录。构建会覆盖 dev 的编译产物，此时页面仍返回 HTTP 200，
但它引用的 JS / CSS chunk 会变成 404，浏览器里看到的是没有样式的白页或报错页。
症状与修复方式：

```powershell
# 症状：首页 HTML 正常，但这些资源返回 404
#   /_next/static/css/app/layout.css
#   /_next/static/chunks/main-app.js
# 修复：停掉 dev 进程 -> 删除 .next -> 重新启动
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*next*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item -LiteralPath .\.next -Recurse -Force
npm run dev
```

---

## 10. 对照 PRD 验收清单

### 基础

- [x] `npm install` 成功（用 pnpm 执行）
- [x] `npm run lint` 成功
- [x] `npm run typecheck` 成功
- [x] `npm test` 成功（63 个用例）
- [x] `npm run build` 成功
- [x] 响应式：桌面左侧固定导航（225px）+ 内容区；≤900px 变顶部横向可滚动导航

### 灵感

- [x] 新建 / 编辑 / 删除灵感（删除有二次确认）
- [x] 刷新后数据仍在（localStorage 或云端）
- [x] 全文搜索（标题 / 内容 / 标签）+ 标签筛选 + 按创建或更新时间排序
- [x] 访客与登录用户的数据边界清楚（侧栏与相关页面都写明数据存哪里）
- [x] 灵感可转成文章草稿，可关联文学回声与分析记录

### AI

- [x] 五种模式都调用服务端 API（`/api/ai/feedback`）
- [x] 未配置密钥时返回 `AI_NOT_CONFIGURED` 并给出准确提示，不假装成功
- [x] 超时（504）、限流（429）、上游错误（502）都有对应的可理解文案与重试入口
- [x] 润色输出原文 / 修改稿 / 修改原因；原文由服务端回填
- [x] 密钥不进客户端 bundle（已用构建产物检查确认）
- [x] 文学回声每条都带真实来源 URL（40/40 已核对）
- [x] 不伪造引用：引用回验不过就丢弃并计数；作品与链接永不来自模型

### 云端数据

- [x] RLS policies 写在 migration 里，并显式校验子表父记录归属
- [x] 提供了隔离验证脚本，覆盖「读不到 / 改不动 / 写不进 / 匿名无权限」
- [ ] 上述脚本**尚未实际执行**（缺少 Supabase 实例）
- [x] 删除与导出流程有效（设置页：导出 JSON、导出 Markdown、全部删除）

### 部署

- [x] README 说明 GitHub 导入与 CLI 两种部署流程
- [x] 说明如何在 Vercel 配置环境变量
- [x] 说明改完环境变量需要重新部署
- [x] 未部署，因此不提供任何线上 URL

---

## 11. 视觉还原说明

设计基准是随附的 `视觉参考_捕梦_2.0_即开即用版.html`，实现方式是在
Next.js 里重建而不是嵌入 iframe 或截图：

- `src/app/globals.css` 的 `:root` 直接沿用参考文件的 CSS 变量
  （`--bg:#f6f3ee`、`--paper:#fffdfa`、`--ink:#292522`、`--muted:#8a8179`、
  `--line:#e7e0d7`、`--violet:#78678d`、`--violet2:#eee8f3`、`--warm:#a18468`）。
- `tailwind.config.ts` 把这些变量映射成颜色、圆角（20/14/11px）、阴影与字体族，
  再在 `@layer components` 里固化为 `.cd-card`、`.cd-btn`、`.cd-textarea`、
  `.cd-hero` 等组件类，页面不再重复写样式。
- 标题用 Georgia + 宋体衬线组合，正文用中文系统无衬线字体；首页 hero 保留
  「今天，捕捉一点什么。」与「不用完整。一个画面、一句话、一种说不清的感觉，都值得留下。」
- 首页构图保留「灵感输入为核心 + 右侧今日统计与练习小卡」，文学回声结果用
  分隔线 + 作品标题 / 作者 / 主题标签 / 关联解释 / 阅读链接的排版。
- 保留原有九个页面主题，并新增灵感库、设置、登录三个真实功能页面，沿用同一套卡片、
  按钮、标题与留白系统。
- 参考文件里的模拟 AI（`setTimeout` 假结果）已全部替换为真实服务端调用。

---

## 12. 常用命令

```bash
npm run dev            # 开发服务器
npm run build          # 生产构建
npm run start          # 启动生产构建
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run check:catalog  # 核对文学目录来源链接
```

> 提示：如果 `npm test` 或 `npm run build` 在受限沙箱里报
> `EPERM: operation not permitted`（realpath / mkdir `.next`），
> 请在普通终端里运行，那是沙箱权限问题，不是项目问题。

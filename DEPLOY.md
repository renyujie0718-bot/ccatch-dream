# 把捕梦变成「人人都能打开的网址」· 超详细版

这份文档假设你从没部署过网站。每一步都写清了 **你要做什么**、
**你会看到什么**、**怎么确认这步成功了**、**卡住了怎么办**。

---

## 0. 先读这一段：三个「地方」千万别搞混

大多数人卡住，不是因为命令难，而是因为搞不清现在该在哪个窗口里操作。

| 地方 | 是什么 | 用来做什么 |
| --- | --- | --- |
| **浏览器** | Chrome / Edge | 登录 GitHub、建仓库、登录 Vercel、导入项目 |
| **项目文件夹** | `C:\Users\任泽法\Documents\ChatGPT\捕梦 2` | 装代码的地方，不用你手动改 |
| **终端窗口** | 黑底白字的命令行窗口 | 敲 `git` 命令 |

后面每一步我都会标明「现在在浏览器里操作」或「现在在终端里操作」。

还有一个前提：**代码已经准备好了**。这个文件夹里已经是一个完整的 git 仓库，
有 2 个提交，工作区是干净的。你不需要 `git init`，也不需要 `git add` / `git commit`。
你要做的只是「把它推到 GitHub」和「让 Vercel 把它跑起来」。

---

## 1. 两种做法，挑一种

**做法一：你只建仓库，剩下交给我。**
你只需要在浏览器里建一个空仓库，把仓库地址复制给我。配置、推送、登录提示，我来处理。
→ 看第 2 节。

**做法二（一条命令）：你建仓库，然后跑我写好的脚本。**
项目里带了 `scripts/push-to-github.ps1`，把「配地址 + 推送 + 告诉你下一步」
合成了一条命令，还会自动检查地址写错了没有、Git 装了没有、有没有提交。
→ 看第 2 节最下面的「更省事的方式」。

**做法三：全部自己操作。**
→ 看第 3 节，那里是逐条命令的完整说明。

三种做法在「Vercel 导入」那一步完全相同，都在第 4 节。

---

## 2. 做法一：你建仓库，我推代码

### 现在在浏览器里操作

1. 打开 <https://github.com/new>
2. **Repository name** 填 `catch-dream`（这个名字随便，但建议用这个）
3. 下面有一排选项，**都不要勾**：
   - ❌ 不要勾 Add a README file
   - ❌ 不要选 Add .gitignore
   - ❌ 不要选 Choose a license

   （这几项如果勾了，仓库就不是空的，后面推送会多一步麻烦。）
4. 选择 **Private**（私有）或 **Public** 都可以。私有也能部署到 Vercel，不影响。
5. 点最下面绿色的 **Create repository**。

### 你会看到什么

页面跳到一个「Quick setup」的页面，有一块灰底的代码框，里面大概是：

```
git@github.com:你的名字/catch-dream.git
```

或者

```
https://github.com/你的名字/catch-dream.git
```

### 现在把地址发给我

复制那个 `https://github.com/...` 开头的地址（**要 https 那一行，不要 git@ 那一行**），
直接发在对话里就行。这个地址不是密码，公开它没有风险。

我拿到之后会：

1. 给本地仓库配好 `origin`；
2. 执行推送（`git push`）；
3. 如果弹出浏览器要你登录 GitHub、点一下同意，我会告诉你点哪里；
4. 推完后把结果告诉你。

然后你直接跳到第 4 节，去 Vercel 导入。

### 更省事的方式：跑一条命令

如果你不想让我碰你的仓库，也不想背两条命令，用这个：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1 -RepoUrl https://github.com/你的名字/catch-dream.git
```

把 `-RepoUrl` 后面换成你从 GitHub 复制的那一行地址（https 开头）。
脚本会依次告诉你它检查了什么、配置了什么、推送有没有成功，
最后直接提示你去 Vercel 的哪一步。

想先看看它会做什么、但不真的推送，加一个 `-DryRun`：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1 -RepoUrl https://github.com/你的名字/catch-dream.git -DryRun
```

---

## 3. 做法二：全部自己操作

### 第 1 步（浏览器）建仓库

和上面第 2 节的第 1～5 点完全一样。建完之后**停在这个页面上别关**，
下一步要用到它。

### 第 2 步（终端）打开终端，并进入项目文件夹

**最简单的方法**：

1. 打开文件资源管理器，进入 `C:\Users\任泽法\Documents\ChatGPT\捕梦 2` 这个文件夹；
2. 点一下窗口最上面的**地址栏**（就是显示路径的那一条）；
3. 把里面的内容全选删掉，输入 `powershell`，按回车。

就会弹出一个蓝底或黑底的终端窗口，并且**已经在这个文件夹里**了。

> 备选方法：在文件夹里空白处按住 Shift 点右键 → 「在此处打开 PowerShell 窗口」
> 或「在终端中打开」。

### 第 3 步（终端）确认你在正确的文件夹

在终端里输入：

```powershell
git log --oneline
```

**你会看到**（类似这样，两行）：

```
709de9b 补充部署手册 DEPLOY.md 与 git 属性配置
572ca11 捕梦 2.0：灵感记录、文学回声与 AI 写作陪伴
```

✅ **看到这两行就说明位置对了。**

❌ 如果显示 `fatal: not a git repository`，说明你在别的文件夹里，
回到第 2 步重新打开终端。

❌ 如果显示 `'git' 不是内部或外部命令`，说明这台电脑没装 Git，
去 <https://git-scm.com/download/win> 下载安装，装完重开终端。

### 第 4 步（终端）把本地仓库和 GitHub 仓库连起来

**不要手打地址。** 手打很容易拼错用户名。

回到浏览器那个 GitHub 页面，找到地址（可以用绿色的 **Code** 按钮 →
**HTTPS** → 点右边的小方块复制）。

然后在终端里输入 `git remote add origin `（注意最后有个空格），
**粘贴**刚复制的地址，按回车。完整的样子是：

```powershell
git remote add origin https://github.com/你的名字/catch-dream.git
```

> ⚠️ 重要提醒：GitHub 页面上那块灰底代码框里有好几行，
> **只复制 https 开头的那一行地址**。
> 千万不要把 `echo "# catch-dream" >> README.md` 和 `git commit` 那几行也复制进来，
> 那会往你的项目里塞多一行内容、多一个提交。

**怎么确认成功**：输入这条命令检查：

```powershell
git remote -v
```

**你会看到**：

```
origin  https://github.com/你的名字/catch-dream.git (fetch)
origin  https://github.com/你的名字/catch-dream.git (push)
```

✅ 出现这两行就对了。

❌ 如果报 `error: remote origin already exists`，说明已经配过了，
不用管，直接进下一步（或者先执行 `git remote remove origin` 再重新配）。

### 第 5 步（终端）推送代码

```powershell
git push -u origin main
```

**这时可能会弹出一个浏览器窗口**，标题类似「Sign in to GitHub」，
这是 Windows 自带的凭据管理器在帮你登录，属于正常流程：
点 **Continue** / **Authorize** 授权即可。授权完浏览器可以直接关掉。

> **如果弹出的是「Confirm access / 确认访问」页面**，它上面写着一行字：
> 「Enter the verification code sent to xxxxx@gmail.com」。
> 意思是 GitHub 已经把**一个 6 位数字验证码**发到了那个邮箱，要你填进去。
>
> - 填**那 6 位数字**，不要填邮箱地址（填邮箱会报错「请与请求的格式匹配」，
>   因为那个输入框只接受数字）；
> - 去那个邮箱收信，**记得翻垃圾邮件文件夹**；
> - 注意页面上写的是哪个邮箱。如果那个地址你打不开，
>   说明你的 GitHub 账号绑定的不是你现在用的邮箱，
>   可以先去 <https://github.com/settings/emails> 改成你能收到的邮箱；
> - 填完点绿色按钮后，**不要关终端**，推送会自动继续。

**正常情况下你会看到**（最后几行类似这样）：

```
Enumerating objects: 90, done.
Counting objects: 100% (90/90), done.
Writing objects: 100% (90/90), 245.10 KiB | 1.20 MiB/s, done.
To https://github.com/你的名字/catch-dream.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

✅ **看到 `* [new branch] main -> main` 就是成功了。**

现在刷新浏览器里的 GitHub 仓库页面，你会看到 `src`、`README.md`、`package.json`
这些文件都上去了。

### 第 6 步 推送失败时的对照表

| 你看到的提示 | 意思 | 怎么办 |
| --- | --- | --- |
| `Authentication failed` / 无限弹登录窗 | 没登录成功 | 重新执行 `git push -u origin main`，在弹出的窗口里授权 |
| `Support for password authentication was removed` | 它要的不是密码而是令牌 | 见下面「用令牌登录」 |
| `! [rejected] main -> main (fetch first)` | 仓库里已经有东西（比如你勾了 Add a README） | 执行 `git pull --rebase origin main`，再 `git push -u origin main`；如果还报错，用 `git push -u origin main --force`（仓库是你自己刚建的，强制覆盖是安全的） |
| `src refspec main does not match any` | 本地没有 main 分支 | 先执行 `git branch -M main`，再重新 push |
| `Permission denied (publickey)` | 地址用了 `git@` 开头的 | `git remote remove origin`，换成 https 地址重新配 |
| 卡住不动、没有任何输出 | 可能在等登录窗口 | 看看任务栏有没有新窗口；超过 1 分钟可按 Ctrl+C 中断重来 |

**用令牌登录**（GitHub 不再接受账号密码）：

1. 浏览器打开 <https://github.com/settings/tokens>；
2. **Generate new token (classic)** → 勾上 **repo** → 生成；
3. **立刻复制**那串以 `ghp_` 开头的字符（关掉页面就再也看不到）；
4. 回到终端重新 push，弹出输入框时：
   - `Username`：填你的 GitHub 用户名
   - `Password`：**粘贴刚才那串令牌**（不是你的登录密码）

---

## 4. 在 Vercel 上发布（两种做法到这里都一样）

### 第 1 步（浏览器）注册 / 登录

1. 打开 <https://vercel.com/signup>
2. 选 **Continue with GitHub**，用刚才那个 GitHub 账号授权登录。

### 第 2 步（浏览器）导入项目

1. 打开 <https://vercel.com/new>
2. 在 **Import Git Repository** 列表里找到 `catch-dream`，点右边的 **Import**。
   - 如果列表里没有，点 **Adjust GitHub App Permissions**，授权 Vercel 访问这个仓库，
     然后刷新页面。
3. 进入配置页。**除了下面说的，其他全部保持默认，不要改**：
   - Framework Preset：应该自动显示 `Next.js`（对，不动）
   - Build Command、Output Directory、Install Command：全部保持默认
   - Environment Variables：**这一步先留空**，我们不填也能跑起来
4. 点 **Deploy**。

### 第 3 步 等待并拿到网址

**你会看到**一个带进度条的页面，大约 1～2 分钟，最后出现撒花动画和
**Congratulations!** 字样。

页面中间会有一个网址：

```
https://catch-dream-xxxx.vercel.app
```

✅ **这个就是能发给任何人的地址。** 把它复制下来，在手机上也试着打开一次。

---

## 5. 发送给别人之前，自己先检查这几条

打开你的新网址，逐条确认：

- [ ] 首页能打开，背景是暖米白色，左边有竖排导航
- [ ] 在首页输入框写一句话，点「只保存」，然后按 F5 刷新——内容还在
- [ ] 点左侧「文学回声」，输入 `太阳雨`，点「寻找回声」
      → 应该出现 3 条结果，每条都有「来源已核对」和可点的链接
- [ ] 点「在微信读书里搜这本书」，能打开
- [ ] 点左侧「AI 写作伙伴」→ 如果还没配密钥，会显示一行提示告诉你要配置什么
      （这是正常的，不是坏了）
- [ ] 用手机打开这个网址，确认是单列布局、顶部导航可以左右滑动
- [ ] 把网址发给一个朋友，确认他也能打开

---

## 6. 想开启 AI 写作伙伴（可选，之后再做也行）

1. 打开 <https://platform.deepseek.com/>，注册并充值（几块钱就够试很久）；
2. 在控制台创建一个 API Key，**立刻复制**（只显示一次）；
3. 回到 Vercel，进入你的项目 → 顶部 **Settings** → 左侧 **Environment Variables**；
4. 添加两个变量：

   | Key | Value |
   | --- | --- |
   | `DEEPSEEK_API_KEY` | 刚才复制的密钥 |
   | `DEEPSEEK_MODEL` | `deepseek-chat` |

   两个变量的 Environments 都勾上 Production 和 Preview。
5. 回到顶部 **Deployments** → 找到最新那条 → 点右边的 **⋯** → **Redeploy** → 确认。

> ⚠️ **改了环境变量必须 Redeploy，否则不生效。**
> 这是所有人都会踩一次的坑：明明配了密钥，功能却还说没配置。

等 1 分钟，再打开网址试「AI 写作伙伴」，应该就能用了。
如果还提示未配置，去 **Settings → Environment Variables** 检查拼写（大小写也要一致）。

模型名请以 DeepSeek 官方文档的当前列表为准：<https://api-docs.deepseek.com/quick_start/pricing>

---

## 7. 想开启「登录 + 跨设备同步」（可选，之后再做也行）

不配这个也能用，只是大家的灵感和作品都只存在各自浏览器里。

1. 打开 <https://supabase.com>，注册一个项目（免费额度够个人用）；
2. 项目建好后，进入左侧 **SQL Editor**，点 **New query**；
3. 用记事本打开项目文件夹里的 `supabase\migrations\0001_init.sql`，
   全选内容复制，粘贴到 SQL Editor 里，点 **Run**。
   （这一步是在数据库里建表和设置权限。）
4. 进入左侧 **Project Settings**（齿轮图标）→ **API**，找到两个值并复制：
   - **Project URL**
   - **anon public** 那个 key
5. 回到 Vercel → 你的项目 → **Settings → Environment Variables**，添加：

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |

6. 回到 Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**，
   点 Add URL，把这两条加进去（把域名换成你自己的）：

   ```
   https://catch-dream-xxxx.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```

7. 回 Vercel **Redeploy** 一次。

之后打开网址 → 左下角「设置」→「用邮箱登录」，输入邮箱，
去邮箱点开登录链接就进去了。登录后可以去「设置」里把本机已有的内容同步到云端。

---

## 8. 常见疑问

**Q：必须用 GitHub 吗？**
不一定，但 GitHub + Vercel 是最省事的组合。Vercel 也支持直接上传文件夹，
不过那样以后每次改代码都要重新上传。

**Q：要花钱吗？**
Vercel 个人项目和 Supabase 免费额度都够用。只有 DeepSeek 按量计费，
建议在 DeepSeek 控制台设一个消费上限。

**Q：别人打开后能看到我写的东西吗？**
看不到。每个访问者的灵感和作品都存在**他自己的浏览器**里，
互相隔离，也不需要你花钱存。（只有登录后才会存进你自己的 Supabase 数据库。）

**Q：以后我改了代码，怎么更新线上？**
在项目文件夹里执行：

```powershell
git add -A
git commit -m "说明这次改了什么"
git push
```

Vercel 检测到新提交会自动重新部署，大约 1 分钟生效。

**Q：怎么在本地预览？**

```powershell
cd "C:\Users\任泽法\Documents\ChatGPT\捕梦 2"
npm run dev
```

然后浏览器打开 <http://localhost:3000>。
注意：**本地预览和线上部署是两回事**，本地改了不会自动同步到线上，
要执行上面的 `git push`。

**Q：能换成自己的域名吗？**
可以。Vercel 项目 → **Settings → Domains** → 添加域名，按提示去域名商处配置解析。
域名需要自己购买（大约 50～80 元/年）。

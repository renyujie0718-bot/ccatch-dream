# 把捕梦项目推送到你自己的 GitHub 仓库。
#
# 用法（在你从 GitHub 建好空仓库之后）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1 -RepoUrl https://github.com/你的名字/catch-dream.git
#
# 只看它会做什么、不真的推送：
#   ... -RepoUrl https://github.com/你的名字/catch-dream.git -DryRun
#
# 它会做四件事：检查环境 -> 配置 origin -> 推送 -> 告诉你下一步去哪。

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "    OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "    !!  $text" -ForegroundColor Yellow }

Step "1/4 检查仓库地址"
$cleanUrl = $RepoUrl.Trim()
if ($cleanUrl -notmatch '^https://github\.com/[^/]+/[^/]+?(\.git)?$') {
    Warn "地址看起来不对：$cleanUrl"
    Write-Host "    需要形如 https://github.com/你的名字/catch-dream.git" -ForegroundColor Yellow
    Write-Host "    提示：不要用 git@github.com 开头的地址。" -ForegroundColor Yellow
    exit 1
}
if ($cleanUrl -notmatch '\.git$') { $cleanUrl = "$cleanUrl.git" }
Ok $cleanUrl

Step "2/4 检查当前目录是不是捕梦项目"
if (-not (Test-Path -LiteralPath ".\package.json")) {
    Warn "当前目录里没有 package.json，请先进入项目文件夹再运行本脚本。"
    Write-Host "    cd `"C:\Users\任泽法\Documents\ChatGPT\捕梦 2`"" -ForegroundColor Yellow
    exit 1
}
$pkg = Get-Content -LiteralPath ".\package.json" -Raw | ConvertFrom-Json
Ok "找到项目：$($pkg.name)"

$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Warn "这台电脑没有安装 Git。请先安装：https://git-scm.com/download/win"
    exit 1
}
Ok $gitVersion

$branch = git rev-parse --abbrev-ref HEAD 2>$null
if ($branch -ne "main") {
    Warn "当前分支是 $branch，正在切换为 main"
    if (-not $DryRun) { git branch -M main }
}
Ok "分支：main"

$commitCount = git rev-list --count HEAD 2>$null
if (-not $commitCount -or [int]$commitCount -lt 1) {
    Warn "本地还没有任何提交，无法推送。"
    exit 1
}
Ok "本地已有 $commitCount 个提交"

Step "3/4 配置远程地址（origin）"
$existing = git remote get-url origin 2>$null
if ($existing) {
    if ($existing -eq $cleanUrl) {
        Ok "origin 已经是这个地址"
    } else {
        Warn "origin 原本指向 $existing，将改为 $cleanUrl"
        if (-not $DryRun) { git remote set-url origin $cleanUrl }
    }
} else {
    if ($DryRun) {
        Ok "（试运行）会执行：git remote add origin $cleanUrl"
    } else {
        git remote add origin $cleanUrl
        Ok "已设置 origin"
    }
}

Step "4/4 推送代码"
if ($DryRun) {
    Ok "（试运行）会执行：git push -u origin main"
    Write-Host "`n试运行结束，没有真的推送。去掉 -DryRun 即可正式推送。" -ForegroundColor Cyan
    exit 0
}

Write-Host "    如果弹出浏览器窗口要求登录 GitHub，点 Continue / Authorize 即可。" -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n推送成功。" -ForegroundColor Green
    Write-Host "下一步：打开 https://vercel.com/new ，选中这个仓库，点 Import，再点 Deploy。" -ForegroundColor Cyan
    Write-Host "（环境变量先不用填，什么都不配也能跑起来。）" -ForegroundColor Cyan
} else {
    Write-Host "`n推送失败，请把上面的报错发给开发者。" -ForegroundColor Red
    Write-Host "常见原因见 DEPLOY.md 第 3 节第 6 步的对照表。" -ForegroundColor Yellow
    exit 1
}

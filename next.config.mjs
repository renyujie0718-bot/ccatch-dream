/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // DeepSeek / Supabase 密钥只允许出现在服务端运行时，这里显式声明依赖，
  // 避免构建期误把服务端模块标记为可被客户端引用。
  experimental: {
    serverComponentsExternalPackages: ["openai"],
  },
};

export default nextConfig;

import { defineConfig } from '@tarojs/cli';
const origin = process.env.MINI_API_ORIGIN || '';
if (
  origin &&
  (!/^https:\/\/[^/]+$/.test(origin) ||
    new URL(origin).username ||
    new URL(origin).password ||
    new URL(origin).search ||
    new URL(origin).hash)
)
  throw Error('MINI_API_ORIGIN 必须为 HTTPS 域名');
export default defineConfig({
  projectName: 'mysite-miniapp',
  date: '2026-09-10',
  designWidth: 375,
  deviceRatio: { 375: 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-weapp'],
  defineConstants: { MINI_API_ORIGIN: JSON.stringify(origin) },
  mini: {
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
  },
  cache: { enable: false },
  copy: { patterns: [], options: {} },
});

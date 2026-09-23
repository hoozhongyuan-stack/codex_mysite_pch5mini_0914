# GEO Studio / Aition Content Commerce Mini Program System

**Current version:** V2.8.4<br>
**Status:** active development, UAT ready for private deployment and business validation.

## 中文说明

GEO Studio 是一套面向品牌官网、内容运营、展示型商城和微信小程序的轻量化全栈系统。它把 PC/H5 官网、中文后台、会员管理、商品与订单、积分商城、视频专栏、沙龙活动、表单收集、素材管理、小程序装修和 GEO/SEO 基础能力放在同一个工作台中，适合需要快速搭建“内容 + 商品 + 会员 + 活动”一体化业务入口的团队。

### 系统价值

- **一套后台管理多端内容**：文章、商品、视频、沙龙活动、表单、素材、导航、主题、首页装修和微页面都可以在后台维护，并同步服务 PC、H5 和微信小程序。
- **内容运营和交易闭环结合**：支持购物车、订单、线下付款、积分商城、活动报名、表单收集和会员资料，减少多个工具之间反复切换。
- **更适合中文品牌展示**：后台采用中文操作语境，前台支持中英文内容，适合品牌官网、内容栏目、商品展示、沙龙活动和私域会员沉淀。
- **GEO / SEO 友好**：内置站点元数据、结构化内容、AI 爬虫识别、引用来源记录和 GEO 洞察，便于搜索引擎与 AI 检索场景理解站点内容。
- **小程序装修能力**：支持首页装修、底部导航、轮播图、图片热区、商品楼层、搜索框、公告栏、辅助线和微页面管理，常规内容调整不需要频繁改代码。
- **权限和运营安全**：后台包含权限组、子账号、操作日志、隐私政策、协议管理和敏感字段保护，便于团队协作和审计。
- **私有化部署友好**：项目包含 Docker 生产部署方案、PostgreSQL 适配方向和 UAT 环境实践，适合部署到自有云服务器。

### 适用场景

- 品牌官网与内容营销站点
- 带展示、询价、线下成交的轻商城
- 微信小程序私域入口
- 课程、视频、沙龙活动和报名管理
- 需要兼顾 GEO / SEO 可见性的内容系统
- 小团队或单品牌的内容、会员、商品一体化后台

### 主要模块

| 模块 | 能力 |
| --- | --- |
| PC / H5 前台 | 多语言首页、文章、商品、视频、沙龙、积分商城、会员中心 |
| 微信小程序 | 首页装修、微页面、底部导航、分享、微信登录、手机号授权、购物车与订单 |
| 内容管理 | 文章、分类、富文本、素材、图片库、视频库 |
| 商品与订单 | 商品、规格、库存、购物车、线下付款、订单审核、发货与售后基础流程 |
| 营销中心 | 表单活动、提交记录、视频专栏、沙龙活动、积分商城 |
| 会员管理 | 邮箱账号、微信绑定、手机号、头像昵称、积分、订单与行为记录 |
| 权限与设置 | 权限组、子账号、操作日志、导航、协议、主题、网站设置 |
| GEO 洞察 | 站点健康建议、AI 爬虫识别、分享与回流分析框架 |

### 本地运行

> 具体环境变量和外部服务需要按部署环境配置。请不要把生产密钥、微信密钥、SMTP 授权码或数据库密码提交到 Git。

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

默认本地入口：

- 后台：<http://localhost:3001/admin>
- 中文前台：<http://localhost:3001/zh>
- 英文前台：<http://localhost:3001/en>

### 部署说明

项目已包含 Docker 生产部署参考，见 [`docker/README.md`](docker/README.md)。正式上线前请确认：

1. 域名、TLS、反向代理和 Cookie 域配置正确；
2. PostgreSQL、对象存储、备份和日志策略已配置；
3. 微信小程序 AppID、订阅消息模板、支付或线下付款规则已按业务开通；
4. 管理员密码、SMTP 授权码、微信密钥等敏感信息只通过环境变量或服务器密钥管理配置。

### 开源边界

本仓库适合开源代码、部署脚本、文档和演示数据。请勿提交真实会员资料、真实订单、生产数据库、服务器私钥、微信密钥、支付密钥、SMTP 授权码或任何可识别用户隐私的数据。

开源发布前建议补充明确的 `LICENSE` 文件。当前 README 不声明具体开源许可证。

---

## English Overview

GEO Studio is a lightweight full-stack system for brand websites, content operations, showcase commerce, member management, and WeChat Mini Program experiences. It combines a PC/H5 website, Chinese admin console, products, orders, points mall, videos, salons/events, forms, assets, Mini Program page decoration, and GEO/SEO foundations in one workspace.

### Why it is useful

- **One admin for multiple channels**: manage articles, products, videos, salons, forms, assets, navigation, themes, home-page decoration, and custom mini pages from a single console, then serve PC, H5, and WeChat Mini Program experiences.
- **Content and commerce in one flow**: cart, orders, offline payment, points mall, event signup, form collection, and member profiles work together instead of living in separate tools.
- **Built for Chinese brand operations**: the admin interface follows Chinese operational habits, while the public website supports Chinese and English content.
- **GEO / SEO ready**: site metadata, structured content, AI crawler identification, citation evidence, and GEO insight foundations help search engines and AI systems understand the website.
- **Mini Program page-building**: supports home decoration, bottom navigation, carousels, image hot zones, product sections, search blocks, notice bars, dividers, and reusable mini pages.
- **Team operations and auditability**: permission groups, sub-accounts, operation logs, policy management, and sensitive-field protection support safer collaboration.
- **Private-deployment friendly**: Docker deployment references, PostgreSQL integration direction, and UAT practices are included for self-hosted cloud servers.

### Good fit for

- Brand websites and content marketing sites
- Showcase commerce with inquiry or offline transactions
- WeChat Mini Program private traffic entry points
- Course, video, salon/event, and signup management
- Content systems that care about GEO / SEO visibility
- Small teams that need one backend for content, members, and products

### Main modules

| Module | Capabilities |
| --- | --- |
| PC / H5 website | Multilingual home, articles, products, videos, salons, points mall, member center |
| WeChat Mini Program | Page decoration, custom mini pages, bottom navigation, sharing, WeChat login, phone authorization, cart and orders |
| Content management | Articles, categories, rich text, assets, image library, video library |
| Products and orders | Products, options, stock, cart, offline payment, order review, fulfillment and basic after-sales |
| Marketing center | Forms, submissions, video series, salon events, points mall |
| Member management | Email account, WeChat binding, phone number, avatar, nickname, points, orders, behavior records |
| Permissions and settings | Permission groups, sub-accounts, logs, navigation, policies, themes, website settings |
| GEO insights | Site-health suggestions, AI crawler recognition, sharing and return-flow analysis foundations |

### Local development

> Configure environment variables and external services for your own environment. Never commit production secrets, WeChat credentials, SMTP authorization codes, database passwords, or private keys.

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

Default local URLs:

- Admin: <http://localhost:3001/admin>
- Chinese website: <http://localhost:3001/zh>
- English website: <http://localhost:3001/en>

### Deployment

Docker production deployment references are available in [`docker/README.md`](docker/README.md). Before going live, verify domain/TLS/reverse proxy settings, PostgreSQL and backup strategy, WeChat Mini Program credentials and templates, payment or offline-payment rules, and all required secrets.

### Open-source boundary

This repository is suitable for source code, deployment scripts, documentation, and demo data. Do not commit real member data, real orders, production databases, server private keys, WeChat credentials, payment keys, SMTP credentials, or personally identifiable information.

Please add an explicit `LICENSE` file before publishing the project as open source. This README does not declare a license yet.

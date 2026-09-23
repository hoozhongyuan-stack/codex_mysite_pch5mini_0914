# GEO Studio / Aition Content Commerce Mini Program System

**Current version:** V2.8.4<br>
**Status:** active development, UAT ready for private deployment and business validation.

## 中文说明

GEO Studio 是一套面向品牌企业、内容型企业、零售品牌、私域运营团队和活动型业务的开源三端内容与商城一体化系统。系统同时支持 **PC 网站、H5 移动网站和微信小程序**，帮助企业把中英文品牌内容、GEO 内容优化、商品销售、活动报名、积分会员和运营数据整合到同一个后台中统一管理。

它适合希望同时经营“内容传播 + 商品转化 + 私域会员”的企业使用，例如消费品品牌、生活方式品牌、酒水与食品品牌、文创零售、教育课程、线下活动、沙龙会、品牌官网和轻量电商业务。

GEO Studio 的核心思路不是单独做一个商城，也不是单独做一个内容站，而是把内容、商品、活动和会员连接起来：企业可以发布中英文文章、视频、商品、积分商品和活动；用户可以通过 PC、H5 或微信小程序浏览内容、参与活动、下单购买、兑换积分商品；后台可以统一管理内容、商品、订单、会员、权限、素材、导航、页面装修和数据统计。

### 一句话定位

> 面向品牌企业的三端内容与商城一体化系统：PC / H5 / 微信小程序，支持中英文内容、GEO 优化、商品交易、活动报名与会员运营。

### 核心亮点

| 能力 | 说明 |
| --- | --- |
| 三端一体化 | 同一套后台管理 PC 官网、H5 移动站和微信小程序，减少多套系统重复维护。 |
| 中英文内容 | PC / H5 支持中文与英文内容展示，适合品牌官网、海外展示和双语内容运营。 |
| GEO 内容优化 | 围绕 AI 搜索、搜索引擎和品牌可发现性，管理站点元数据、结构化内容、AI 爬虫识别和 GEO 健康建议。 |
| 商城与内容连接 | 商品、购物车、订单、积分商城、线下付款和微信支付配置与文章、视频、活动形成完整转化链路。 |
| 微信小程序 | 支持微信信任登录、手机号授权、分享、底部导航、首页装修、微页面、轮播图、图片热区和商品楼层。 |
| 活动与会员运营 | 支持沙龙会、报名、签到、统计、会员资料、积分、订单和行为记录。 |
| 后台运营体系 | 内容、商品、订单、素材、导航、配置、权限组、子账号、日志和数据面板集中管理。 |
| 私有化部署 | 提供 Docker 生产部署参考、UAT 实践和 PostgreSQL 适配方向，便于部署到自有云服务器。 |

### 适合哪些企业使用

- **品牌型企业**：需要官网展示、品牌内容、产品展示和线索转化。
- **消费品与零售品牌**：例如酒水、食品、生活方式、文创、家居、礼品、轻奢消费品。
- **内容驱动型企业**：需要通过文章、视频、案例、知识内容建立信任并带动转化。
- **私域运营团队**：需要微信小程序、会员资料、积分、订单、活动和复购运营。
- **活动与课程业务**：需要沙龙会、报名、签到、统计、课程或视频内容展示。
- **轻量电商团队**：需要商品、订单、线下付款、积分商城和内容导购，但不想维护多套系统。
- **重视 GEO / SEO 的团队**：希望品牌内容更容易被搜索引擎和 AI 搜索理解、引用和发现。

### 主要模块

| 模块 | 能力 |
| --- | --- |
| PC / H5 前台 | 中英文首页、文章、商品、视频、沙龙、积分商城、会员中心 |
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

GEO Studio is an open-source, multi-channel content and commerce system for brand companies, content-driven businesses, retail brands, private-domain operators, and event-based organizations. It supports **PC websites, H5 mobile websites, and WeChat Mini Programs**, allowing businesses to manage bilingual brand content, GEO-ready content, product commerce, events, points, members, and operational data from one admin console.

The system is designed for companies that want to combine content marketing, product conversion, and member operations in one platform. Typical use cases include consumer brands, lifestyle brands, wine and food businesses, cultural products, education programs, salons, offline events, brand websites, and lightweight commerce projects.

GEO Studio is not just a CMS or a standalone shop. It connects content, products, activities, and members into one business flow. Teams can publish bilingual articles, videos, products, points-based goods, and events; users can browse, register, purchase, redeem, and interact through PC, H5, and WeChat Mini Program experiences; operators can manage content, products, orders, members, permissions, assets, navigation, page decoration, and analytics in one backend.

### One-line positioning

> A multi-channel content and commerce system for brand companies: PC, H5, and WeChat Mini Program support with bilingual content, GEO optimization, product commerce, events, and member operations.

### Key highlights

| Capability | Description |
| --- | --- |
| Three-channel experience | Manage PC website, H5 mobile website, and WeChat Mini Program experiences from one admin console. |
| Bilingual content | PC and H5 support Chinese and English content, suitable for brand websites and bilingual content operations. |
| GEO-ready content | Manage metadata, structured content, AI crawler recognition, citation evidence, and GEO health suggestions for better discoverability. |
| Content + commerce | Products, cart, orders, points mall, offline payment, and WeChat payment settings connect with articles, videos, and events. |
| WeChat Mini Program | Supports WeChat trusted login, phone authorization, sharing, bottom navigation, home decoration, mini pages, carousels, image hot zones, and product sections. |
| Events and members | Supports salons, signup, check-in, statistics, member profiles, points, orders, and behavior records. |
| Admin operations | Centralized management for content, products, orders, assets, navigation, configuration, permission groups, sub-accounts, logs, and dashboards. |
| Private deployment | Includes Docker production deployment references, UAT practices, and PostgreSQL integration direction for self-hosted cloud servers. |

### Best suited for

- **Brand companies** that need brand websites, content publishing, product presentation, and conversion flows.
- **Consumer and retail brands**, including wine, food, lifestyle, cultural products, home goods, gifts, and lightweight premium products.
- **Content-driven businesses** that use articles, videos, cases, or knowledge content to build trust and drive conversion.
- **Private-domain teams** that need WeChat Mini Program entry points, member profiles, points, orders, events, and repeat-purchase operations.
- **Event and course businesses** that need salons, signup, check-in, statistics, courses, or video content.
- **Lightweight commerce teams** that need products, orders, offline payment, points mall, and content-led shopping without maintaining multiple systems.
- **GEO / SEO-focused teams** that want brand content to be easier for search engines and AI search systems to understand, cite, and discover.

### Main modules

| Module | Capabilities |
| --- | --- |
| PC / H5 website | Bilingual home, articles, products, videos, salons, points mall, member center |
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

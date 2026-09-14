# Local visitor identity service

This Django service supplies visitor email registration, verification, login,
logout, password reset and SMTP configuration. It is separate from CMS admin
identity. The CMS now uses independent Django administrator accounts and local D1/R2.
This is a local acceptance implementation, not a complete Docker deployment.

## Local startup

From the project root, install `identity/requirements.txt` into `.venv`, then run:

```sh
.venv/bin/python identity/manage.py migrate
.venv/bin/python identity/manage.py runserver 127.0.0.1:3002 --noreload
npm run dev -- --port 3001
```

Local secrets are in ignored `private-data/identity-secrets.json`. The frontend
server reads `IDENTITY_URL` and `IDENTITY_KEY` from ignored `.dev.vars`; restart
it after changing these values. Never commit either file. Database and SMTP
settings are under `private-data`, directory mode 0700 and credential file mode
0600. SMTP settings have filesystem access protection, not encryption at rest.

Publish actual registration terms and privacy policy from the local CMS before
accepting registrations. Save and enable SMTP in Settings, then explicitly send
a test email. Only SSL 465 and STARTTLS 587 are supported. No real SMTP credentials
are seeded; automated tests use mocked delivery and isolated databases.

Registration creates an inactive user with an unusable password. The mailbox
owner sets a password via an expiring verification link. Reset and verification
tokens are stored as hashes, expire in 30 minutes and are consumed transactionally.
Reset revokes existing sessions. Session tokens are hashed in storage and passed
to the browser only as HttpOnly same-origin cookies. SMTP passwords are omitted
from all read APIs. SMTP changes are recorded in the identity Audit table.

## Checks

```sh
.venv/bin/python identity/manage.py test accounts
npm test
```

## Before production deployment

Do not expose Django runserver or this internal API to the public network. Supply
a production WSGI/ASGI server, reverse proxy/TLS, protected persistent volumes and
backups, a fixed HTTPS PUBLIC_ORIGIN and strong internal credentials. Adapt CMS D1/R2 dependencies for the chosen
self-host runtime; strip external oai-authenticated-user-* headers at the edge.
The user must accept local functionality before production deployment.

## 本地第三方登录沙箱

微信、Google、Facebook 目前为模拟渠道，未实现真实平台授权或邮件验证。
测试账号使用 `@sandbox.invalid`，不会自动合并真实邮箱账号；注册来源以 `sandbox:` 开头。
在项目根目录启动本地账号服务时显式启用：

```sh
IDENTITY_SANDBOX=1 .venv/bin/python identity/manage.py runserver 127.0.0.1:3002 --noreload
```

仅当 PUBLIC_ORIGIN 为 localhost:3001 或 127.0.0.1:3001 时生效；前台代理还要求开发构建。
生产环境不要设置 IDENTITY_SANDBOX。后台渠道开关不能越过环境限制。
网站设置 → 登录与注册 → 第三方登录，可启停和排序模拟渠道；前台账号页完成模拟授权。
取消不创建账号；票据五分钟过期且单次使用；模拟绑定需有效沙箱会话，同渠道仅可绑定一个身份。
真实接入仍需各平台应用资格、ID/密钥、回调配置、真实邮箱补全及验证、真实 OAuth/OIDC 流程与验收。
本地测试账号不会自动迁移为真实平台身份。


## 营销沙龙会（开发中，2026-09-08）

活动、报名、签到、权限与通知记录存于 Django，同一活动的写操作先取得事务写锁。
本轮审批恢复后，Django 0009—0012 与 CMS `drizzle/0007_deep_jubilee.sql` 已应用；身份服务已重启。13 项本地营销接口校验通过，测试活动已归档。

通知工作进程命令（本轮未启动）：

```sh
.venv/bin/python identity/manage.py salon_mail_worker --loop
```

生产需使用进程管理器保障该进程运行；单次 SMTP 失败保留记录，人工可重试。沙箱活动不发送真实通知。发送异常或进程中断可能造成通知重复，不能声称邮件恰好一次投递。

二维码 PNG 使用 `accounts/marketing_qr.py` 适配器，已批准并安装 Segno 1.6.6（固定在 requirements）；PNG 结构、编码链接及下载接口验证通过。二维码目标来自服务端 `PUBLIC_ORIGIN`，手机扫码需配置手机可访问的地址。

本轮构建通过，尚未完成浏览器验收、手机扫码验收或生产部署；具体进度以 `docs/产品需求文档.md` 为准。

## 订单模块本地运行（2026-09-08）

订单模块使用 CMS 的 D1/R2，访客身份继续由 Django 提供。本地迁移 `drizzle/0008_sloppy_annihilus.sql` 已应用，保留现有业务数据。

在项目根目录启动待付款超时关闭任务：

```sh
node scripts/order-expiry-worker.mjs
```

一次检查可加 `--once`。本地从被忽略的 `.dev.vars` 读取服务凭据；生产通过环境变量注入 `IDENTITY_KEY` 和 `ORDER_ORIGIN`，不要将值写入文档或命令历史。任务每分钟检查一次，进程退出后不会继续运行，生产需配置常驻进程管理和故障监控。

后台“订单 → 交易设置”配置收款项目、固定运费、售后天数及权限后启用交易。不要将沙箱测试商品用于真实销售。验证结果与未完成验收项见 `docs/产品需求文档.md` 的 ORD-001—021。


## V1.7 独立后台与私有视频（本地）

- 前台 `/` 跳转 `/zh`；后台 `/admin`，登录 `/admin/login`，个人账号密码 `/admin/profile`。旧 `/?view=...` 自动兼容跳转。
- 本地已初始化管理员用户名 `admin`。初始随机密码仅保存在被 Git 忽略、权限 0600 的 `private-data/local-admin-bootstrap.json`，首次登录必须更换；不会在日志或需求文档展示。密码更换后该文件中的旧密码失效，可手动删除文件。后台可添加子账号；管理员与访客账号互相独立。
- 新环境通过安全环境变量 `INITIAL_ADMIN_USERNAME`、`INITIAL_ADMIN_EMAIL`、`INITIAL_ADMIN_PASSWORD` 执行 `.venv/bin/python identity/manage.py init_staff`。已有管理员时不覆盖。不得将真实密码写入脚本、镜像或版本库。
- 安装 FFmpeg/ffprobe 后，在项目根目录另开终端执行 `.venv/bin/python identity/manage.py video_worker`。单次队列处理用 `--once`。该进程必须运行才能将排队视频转为可发布状态。
- 原文件在 `private-data/videos/originals`，加密 HLS 在 `private-data/videos/streams`；目录不得映射到公开静态服务器。生产需独立无外网低权限转码容器、磁盘配额、备份与定期容量监控。旧版文件暂保留，以免影响已授权播放；磁盘生命周期策略在生产部署时配置。
- 视频专栏位于“营销中心”；系列封面复用图片素材库，分集通过弹窗私有视频素材选择器关联，素材支持8 MiB分块上传，限 MP4/WebM/MOV、1 GB（1,073,741,824字节）、4小时以内。实际格式由 FFmpeg 检验；失败可以重试，替换失败保留旧版。
- 公开试看无需登录；其他集需有效访客会话。15分钟播放授权、会话绑定、每个身份最多两个不同视频、加密分片与密钥请求逐次检查。10分钟续期；进度每15秒及结束时保存；没有后台运行播放保证。
- 水印为脱敏身份标识的移动叠层，不是不可移除的 DRM。授权用户仍可能录屏或提取视频，不承诺绝对防下载。
- 本轮不是生产私有化部署完成：D1/R2运行时仍需后续迁移适配，Django开发服务器不可直接公开。

### 积分活动结算（本地）

完成迁移后运行 `.venv/bin/python identity/manage.py points_worker --loop`，每30秒检查已结束且签到有效的沙龙，规则默认关闭；启用前结束的活动不补发。生产需单独配置进程托管，目前未部署。表单积分服务故障会保留待补发记录，由后台积分管理“重试待补发表单积分”处理。积分流水不支持直接编辑或删除。

### 权限组升级（2026-09-14，本地开发）

权限组设置统一展示角色基线、权限组、成员分配、历史订单/营销授权与最近200条权限操作记录。新增组只分配现有订单及营销操作，不改变 owner/editor 角色基线，不改变访客购买、会员或发布条件。所有权限组写入由身份服务使用管理员会话再次验证超级管理员身份。

升级顺序：先备份身份数据库，进入维护窗口暂停网站、身份服务及相关写入任务，再使用新版本代码执行 `.venv/bin/python identity/manage.py migrate accounts 0024 --noinput`，最后重启身份服务及网站进程。0023 新增权限组、成员分配与权限审计表，0024 为现有操作审计增加空的目标编号字段，避免将活动编号拼入受限长度的操作名称；不创建默认组、不分配成员、不改已有账号与历史授权。使用 `--noreload` 的身份服务必须重启才能加载新接口。运行中的新代码依赖这些表，应在切换新代码前完成迁移。

历史授权不自动迁移。统一入口可编辑和清空历史授权，保存会校验是否被其他管理员更新。新授权使用权限组；角色、启用权限组和历史授权叠加，彻底撤销需检查所有来源。停用组不会删除历史记录。订单历史授权在 CMS 同一事务中保存修改和审计，营销历史授权与组变更在身份数据库事务中保存，不需要跨服务事务。

本次本地备份位于 Git 忽略的 `private-data/identity-before-permissions-20260914-091359.sqlite3`，权限0600且完整性检查通过。迁移前后已有 StaffAccount、MarketingGrant 内容一致；新增组与成员分配为空。本记录不代表已部署 UAT/生产或完成浏览器验收。远程升级需另行明确授权并备份对应环境数据库；回滚代码时保留新增表及审计，不直接反向迁移删除数据。

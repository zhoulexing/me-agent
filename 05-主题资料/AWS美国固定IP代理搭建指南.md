# AWS 美国固定 IP 代理搭建指南

从注册账号，到电脑和 iPhone 接入自己的服务器。

更新日期：2026-10-15。适用环境：AWS 国际区 Lightsail、Ubuntu 24.04 LTS、macOS 上的 Clash Verge Rev、iPhone 上的 Shadowrocket。本次服务器使用 sing-box 1.14.3；菜单名称可能随软件版本变化。

> 阅读方式：按第 1～8 章依次完成。每个阶段都有“完成标志”，通过后再继续。第 9 章用于排错，第 10 章负责维护和停用。SSH 隧道仅是附录中的可选测试。
>
> 本指南基于实际搭建过程整理，电脑经 AWS 访问 HTTPS 网站、出口 IP 和 UDP DNS 已验证。手机曾因扫码后密码、算法为空而失败；更换导入编码后的手机成功结果尚未确认，因此手机主流程采用可逐项核对的手动配置。

## 1. 先看懂要搭建什么

### 1.1 最终连接流程

![电脑与手机分别连接 AWS 的流程图](../outputs/aws-proxy-guide/assets/01-architecture.svg)

电脑和手机各自连接 AWS，互不依赖。手机不用连接电脑热点，电脑关机不会影响手机。只要 AWS 实例运行、代理服务正常，两台设备可以使用同一个节点，共享服务器流量额度。

| 名称 | 可以怎样理解 | 在本方案中的作用 |
| --- | --- | --- |
| AWS | 云服务提供商 | 提供服务器、IP 和网络 |
| Lightsail | AWS 中一种套餐式云服务器产品 | 本教程购买的服务，不是 EC2 |
| Ubuntu | 服务器的操作系统 | 类似电脑上的 macOS，但运行在云端 |
| 静态公网 IPv4 | 服务器固定的互联网地址 | 客户端连接它，目标网站通常看到它作为出口 |
| sing-box | 服务器上的代理程序 | 接收并转发代理请求 |
| Shadowsocks | 客户端和服务器约定的加密通信协议 | 两端必须使用相同算法和密钥 |
| Clash Verge Rev | 电脑上的代理客户端 | 选节点、接管流量、按规则分流 |
| Shadowrocket | iPhone 上的代理客户端 | 建立手机到服务器的代理连接 |
| SSH | 管理服务器的远程终端连接 | 安装、维护软件；正式代理不依赖它常驻 |

“固定 IP”表示地址可保持稳定，不代表住宅 IP，也不代表服务商一定接受该地址。AWS 地址属于云服务网络。代理连通、目标网站可访问、账号有权使用某个模型，是三件需要分别验证的事。本教程不承诺 Claude、Cursor 或其他服务的账号审核与模型权限结果。

### 1.2 全文只使用自己的参数

先在密码管理器或私密笔记里建立一张参数表。不要把真实密钥写进公开文档。

| 参数 | 本教程采用的值 | 你需要做什么 |
| --- | --- | --- |
| AWS 地区 | Oregon / 俄勒冈，`us-west-2` | 创建时选择它 |
| 实例名称 | `personal-us-proxy` | 可照用，也可自定义 |
| 系统 | Ubuntu 24.04 LTS | 不选 WordPress 等应用镜像 |
| 静态公网 IP | `YOUR_STATIC_IP` | 替换为控制台里你自己的地址 |
| 代理端口 | `24443` | 两端与防火墙保持一致 |
| 算法 | `2022-blake3-aes-128-gcm` | 整串复制，不要删掉前缀 |
| 代理密钥 | `YOUR_SS_KEY` | 在第 5 章随机生成 |
| 电脑本地代理端口 | `7897` | 与 Clash Verge 设置中的混合端口一致 |

图中的 `203.0.113.10` 是文档示例地址，不能连接。`YOUR_STATIC_IP`、`YOUR_SS_KEY` 都是占位符，复制配置后必须替换。

## 2. 准备工作与费用

### 2.1 准备清单

- 能正常收邮件的邮箱、本人真实联系方式，以及可接收验证码的手机。
- 按注册页面要求准备有效支付方式。本文使用的传统／advanced 注册路径要求填写账单资料；部分新注册体验的要求不同。
- 一台 Mac 和浏览器，用于访问 AWS、安装与测试代理。
- Clash Verge Rev：从[项目官方发布页](https://github.com/clash-verge-rev/clash-verge-rev/releases)下载稳定版。Apple Silicon 芯片选择 ARM64/aarch64，Intel Mac 选择 x64；可在“关于本机”查看芯片。
- iPhone：从 [App Store 的 Shadowrocket 页面](https://apps.apple.com/app/shadowrocket/id932747118)安装。已经安装则直接使用；可用性及价格以自己的商店页面为准。

本方案不需要购买域名、配置 Cloudflare、安装 X-UI 面板，也不需要在电脑额外安装 sing-box。sing-box 安装在 AWS 服务器上。

### 2.2 推荐套餐与收费边界

本次采用的 Lightsail Linux 套餐包含公网 IPv4，规格为 **2 vCPU、1 GB 内存、40 GB SSD、2 TB 套餐流量，基础价 7 美元/月**。这是本教程的复现配置，最后以创建页面显示的套餐为准。[官方套餐表](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html)

| 项目 | 怎样理解 |
| --- | --- |
| 7 美元/月 | 基础套餐的月度价格；不是全账号所有费用的绝对上限 |
| 免费额度 | 符合资格的新账号可能享有抵扣金；以自己账号显示的余额、到期日和适用范围为准 |
| Free plan | 与 Paid plan 区分；当前免费计划通常以 6 个月或额度耗尽较早者为结束条件 |
| Paid plan | 超出适用抵扣额度等范围的费用会按标准价格产生 |
| 额外费用 | 超额出站流量、快照、额外磁盘等可能另收费 |

不要把旧教程中的“三个月免费”“固定赠送金额”当作每个账号必有权益。AWS 正在调整注册体验，本文核对时免费计划仍有资格和期限要求。[AWS Free Tier 官方说明](https://aws.amazon.com/free/free-tier-faqs/)

**完成标志：**你知道自己将创建什么套餐，也知道注册完成后要检查当前账号属于 Free 还是 Paid。

## 3. 注册 AWS 账号

### 3.1 先选对注册入口

操作位置：**自己电脑的浏览器**。

从 [AWS 官方注册说明](https://aws.amazon.com/resources/create-account/)进入。本文后续需要自主选择美国地区，因此按官方的 [Sign up for AWS (advanced)](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html) 路径说明操作；从该文档里的 **Sign up for AWS** 链接进入注册表单。

如果看到用 Google、Apple 等账号创建“项目”的新版入口，不要把它与传统 root 邮箱注册表单混为一谈。官方对比表说明，新体验对地区选择和服务范围有限制，advanced 路径允许自主选择地区。**advanced 注册路径不等于必须购买收费技术支持；账户 Free/Paid 计划又是另一项选择。** 已有可正常使用 Lightsail、选择美国地区的 AWS 账号，可以直接跳到第 4 章。[两种注册方式的官方对比](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html)

![注册资料与服务器地区是两回事](../outputs/aws-proxy-guide/assets/02-signup.svg)

### 3.2 填写邮箱、账号名称和密码

1. 在 **Root user email address** 填自己的邮箱。
2. 在 **AWS account name** 填方便自己识别的名称，例如 `personal-cloud`。这不是服务器名称。
3. 点击 **Verify email address**，到邮箱收验证码；没收到时查看垃圾邮件。
4. 输入验证码，按页面要求设置登录密码。
5. 如出现 **Free plan / Paid plan** 选择，阅读各自条款；只做初次试验且符合资格，可选择页面提供的 Free plan。不要因为教程提到套餐月价就直接选择升级。

### 3.3 填联系方式：不用编造美国电话和地址

1. 个人使用时，若页面提供用途选择，选 **Personal**。
2. 姓名、国家／地区、地址、邮编填写自己的真实信息。
3. 电话国家码选择自己号码对应的国家／地区，例如中国大陆号码对应 `+86`。
4. 当国家码已有独立输入框时，号码栏通常填写手机号本身，避免重复填写国家码。
5. 若默认国家是 United States，先改国家选项；不要为了创建美国服务器填写虚构美国地址。

**账号联系方式表示你是谁；Oregon 表示服务器放在哪里。二者是不同设置。** 页面如果不接受自己的真实资料，先检查入口、字段格式或联系 AWS 支持，不通过虚构资料继续。

### 3.4 账单、身份验证和激活

1. 按页面填写有效支付资料，账单地址与自己的支付资料相符。
2. 完成要求的短信、电话或其他身份验证。具体顺序以页面为准。
3. 如需选择技术支持，初次自建代理选择页面提供的免费 **Basic Support** 即可。
4. 提交注册，等待激活邮件；不要把“邮箱验证成功”当成账号已激活。
5. 收到激活确认后进入 [AWS 管理控制台](https://console.aws.amazon.com/)。

这些步骤与所需资料可对照 [AWS advanced 注册操作说明](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html)。若激活未完成，先处理账号问题，不反复创建资源。

### 3.5 第一次登录后检查两处

- **安全凭证 / Security credentials**：为 root 账号设置 MFA（多因素认证），保存恢复方式。
- **Billing and Cost Management / 账单与成本管理 → Free Tier、Credits 或当前计划页面**：记录账号计划、抵扣余额和到期日。不要用别人的截图判断自己的免费权益。

整个教程使用网页控制台管理云资源，不要求创建 AWS Access Key，也不需要把 AWS 登录密码填进 Clash 或 Shadowrocket。

**完成标志：**能登录控制台，账号已激活，并已确认计划与额度。

## 4. 创建美国服务器并绑定固定 IP

### 4.1 打开 Lightsail

操作位置：**电脑浏览器中的 AWS 控制台**。

1. 在顶部搜索框输入 `Lightsail`，打开 **Amazon Lightsail**；也可访问 [Lightsail 控制台](https://lightsail.aws.amazon.com/)。
2. 点击 **Create instance / 创建实例**。
3. 在创建页面检查 **Instance location / 实例位置**。即使之前控制台网址包含悉尼地区 `ap-southeast-2`，这里仍要重新选择目标地区。

### 4.2 按下图选择参数

![创建实例时的关键选项示意](../outputs/aws-proxy-guide/assets/03-instance.svg)

| 页面项目 | 应选择什么 | 如何核对 |
| --- | --- | --- |
| Region / 地区 | Oregon / 俄勒冈 | 地区代码为 `us-west-2` |
| Availability Zone / 可用区 | 可使用默认值 | 在所选 Oregon 地区内即可 |
| Platform / 平台 | Linux/Unix | 不选 Windows |
| Blueprint / 镜像类别 | OS Only / 仅操作系统 | 不选 Apps + OS |
| Operating system | Ubuntu 24.04 LTS | 补丁版本号可不同 |
| Networking / 网络 | 包含公网 IPv4 的方案，通常是 Dual-stack | 不选 IPv6-only |
| Plan / 套餐 | 1 GB 内存、40 GB SSD、7 美元/月这一档 | 再核对创建页面的价格和流量 |
| SSH key pair / 密钥对 | 使用／生成该地区默认 SSH 密钥 | 后面从账户 SSH keys 页面下载 |
| Instance name | `personal-us-proxy` | 名称用于自己识别 |

不用添加启动脚本。无需为本次代理添加数据库、负载均衡器、额外磁盘或自动快照。

核对地区、价格后点击 **Create instance**，等待实例状态从 **Pending** 变成 **Running**。创建实例意味着开始占用计费资源，是否抵扣取决于账号权益。[官方实例创建说明](https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html)

### 4.3 创建并绑定 Static IP

普通动态公网 IP 在停止再启动实例后可能变化。需要固定地址，就要绑定 Lightsail 静态 IP。[官方静态 IP 说明](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)

1. 在 Lightsail 导航中打开 **Networking / 网络**。
2. 点击 **Create static IP / 创建静态 IP**。部分页面也可从实例的 Networking 页进入 **Attach static IP**。
3. 地区选择 **Oregon / us-west-2**，必须与实例相同。
4. 在 **Attach to an instance** 选择刚创建的 `personal-us-proxy`。
5. 名称可填 `personal-us-proxy-ip`，点击创建并绑定。
6. 回到实例详情，复制标记为 **Static IP / 静态 IP** 的公网 IPv4。

把这个地址写入参数表，之后全文的 `YOUR_STATIC_IP` 都用它。不要复制 `172.16～172.31`、`10.x.x.x` 等内网地址，也不要继续使用绑定前的旧公网 IP。

### 4.4 打开服务器终端

新手先使用浏览器 SSH，不需要先研究本地 SSH 命令。

1. 打开实例详情 → **Connect / 连接**。
2. 点击 **Connect using SSH / 使用 SSH 连接**。
3. 等待终端出现类似 `ubuntu@ip-…:~$` 的提示符。
4. 输入下面命令，按回车：

```bash
whoami
```

通常显示 `ubuntu`。后面标注“服务器终端”的代码，都粘贴到这里执行。不要复制代码块外的提示符或解释文字。

如果终端打不开，先确认实例 Running、账号激活完成，以及 Networking 页的 SSH TCP 22 规则允许浏览器 SSH 连接。此时还没安装代理，不能从 Shadowrocket 判断原因。

**完成标志：**实例 Running、静态 IP 已绑定、浏览器 SSH 能执行 `whoami`。

## 5. 在服务器安装 sing-box

### 5.1 安装基础工具

操作位置：**AWS 实例的浏览器 SSH 终端**。

逐块执行。出现下载失败、权限错误或安装报错时，先处理这一块，不继续往下粘贴。

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates nano
```

`sudo` 表示用管理员权限执行；这里修改的是云服务器，不是你的 Mac。

### 5.2 添加官方软件源并安装

先下载软件源签名文件：

```bash
sudo mkdir -p /etc/apt/keyrings
sudo curl -fsSL https://sing-box.app/gpg.key -o /etc/apt/keyrings/sagernet.asc
sudo chmod a+r /etc/apt/keyrings/sagernet.asc
```

再完整复制下面一块，包括第一行和最后单独一行的 `EOF`：

```bash
sudo tee /etc/apt/sources.list.d/sagernet.sources > /dev/null <<'EOF'
Types: deb
URIs: https://deb.sagernet.org/
Suites: *
Components: *
Enabled: yes
Signed-By: /etc/apt/keyrings/sagernet.asc
EOF
```

安装稳定版：

```bash
sudo apt-get update
sudo apt-get install -y sing-box
sing-box version
```

看到版本号表示程序已安装。本次实测版本是 1.14.3，之后官方稳定版可能更新；若新版不接受后面的字段，先查看官方说明，不随意删除安全相关设置。[官方 APT 安装与服务管理说明](https://sing-box.sagernet.org/installation/package-manager/)

### 5.3 生成自己的代理密钥

```bash
sing-box generate rand --base64 16
```

终端会显示一串随机字符。**完整复制并保存这一行，包括末尾的 `=`。** 它是下面配置中的 `YOUR_SS_KEY`，不是 AWS 登录密码，也不是 SSH 私钥文件。

算法 `2022-blake3-aes-128-gcm` 要求 16 字节随机密钥的 Base64 表示，不能随便填一个自定义短密码。不要多次生成后混用不同结果；服务器、电脑、手机必须用同一串。[sing-box Shadowsocks 配置说明](https://sing-box.sagernet.org/configuration/inbound/shadowsocks/)

### 5.4 写入服务端配置

本步骤用于本教程的新实例。如果服务器已运行其他代理配置，先备份并合并，不能直接覆盖。

打开配置文件：

```bash
sudo nano /etc/sing-box/config.json
```

如果文件已有示例内容，将光标移到开头，用 **Control+K** 逐行剪掉旧内容，直到为空。这里是键盘 `Control` 键，不是 Mac 的 `Command` 键。随后粘贴下面完整 JSON，并把 `YOUR_SS_KEY` 替换为刚生成的密钥，保留两边英文双引号。

```json
{
  "log": {
    "level": "warn",
    "timestamp": true
  },
  "inbounds": [
    {
      "type": "shadowsocks",
      "tag": "ss-in",
      "listen": "0.0.0.0",
      "listen_port": 24443,
      "method": "2022-blake3-aes-128-gcm",
      "password": "YOUR_SS_KEY"
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    }
  ]
}
```

保存与退出顺序：**Control+O → 回车确认文件名 → Control+X**。不要使用中文引号，不要多加逗号。

`0.0.0.0` 表示服务器监听所有 IPv4 网卡；它不是客户端要填写的服务器地址。未指定 `network` 时，Shadowsocks 入站同时支持 TCP 和 UDP。

### 5.5 校验、权限与开机启动

先检查配置：

```bash
sudo sing-box check -c /etc/sing-box/config.json
```

成功时通常没有错误输出，终端回到提示符。若提示 JSON 格式或密钥长度错误，回到上一步修正，**不要先重启服务碰运气**。

本教程使用的官方 Ubuntu 包以 `sing-box` 系统用户运行。确认并设置该用户可读的权限：

```bash
systemctl show sing-box -p User
getent passwd sing-box
sudo chown root:sing-box /etc/sing-box /etc/sing-box/config.json
sudo chmod 750 /etc/sing-box
sudo chmod 640 /etc/sing-box/config.json
```

应看到 `User=sing-box`，以及该系统用户的记录。如果使用了不同来源的软件包且没有此用户，先核对软件包和服务运行身份，不要照搬 `chown`。

启用开机启动，并让服务读取新配置：

```bash
sudo systemctl enable sing-box
sudo systemctl restart sing-box
sudo systemctl is-active sing-box
sudo systemctl is-enabled sing-box
sudo ss -lntu 'sport = :24443'
```

预期分别看到 `active`、`enabled`，以及端口 `24443` 的 TCP 和 UDP 监听记录。失败时查看：

```bash
sudo journalctl -u sing-box --since '10 minutes ago' --no-pager -n 50
```

**完成标志：**配置检查通过、服务 active、开机启动 enabled、端口监听存在。此时只是服务器内部准备好了，外网还需要下一步放行。

### 5.6 在 Lightsail 放行代理端口

操作位置：**电脑浏览器中的 Lightsail 实例详情 → Networking**。

![防火墙规则和客户端端口的对应关系](../outputs/aws-proxy-guide/assets/04-firewall.svg)

在 **IPv4 firewall / IPv4 防火墙** 中点击 **Add rule / 添加规则**，分别添加：

| Application / 应用 | Protocol / 协议 | Port / 端口 | Source / 来源 |
| --- | --- | --- | --- |
| Custom / 自定义 | TCP | `24443` | Any IPv4 / 任意 IPv4，或 `0.0.0.0/0` |
| Custom / 自定义 | UDP | `24443` | Any IPv4 / 任意 IPv4，或 `0.0.0.0/0` |

每条都点击保存，最后确认规则列表里有两条。手机蜂窝公网地址会变化，所以本方案允许任意 IPv4 发起连接，再由 Shadowsocks 密钥认证；这意味着端口公开可达，密钥必须保密。

保留可用的 SSH TCP 22 管理入口。对于只运行本代理的新实例，不需要 HTTP TCP 80 规则，可以删除这条未使用规则。以后收紧 SSH 来源时，先确保自己的管理入口仍然可用。IPv6 防火墙与 IPv4 独立；本教程客户端使用 IPv4，不需要为代理额外开放 IPv6。[Lightsail 防火墙说明](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)

再回到**服务器终端**执行：

```bash
sudo ufw status
```

- 若显示 `inactive`，不用为本教程额外启用 UFW。
- 若显示 `active`，还要在操作系统防火墙放行代理端口：

```bash
sudo ufw allow 24443/tcp
sudo ufw allow 24443/udp
sudo ufw status
```

**完成标志：**云防火墙规则已保存；若启用了 UFW，它也允许两个协议的 `24443`。

## 6. 电脑配置 Clash Verge Rev

### 6.1 安装并选择操作路径

操作位置：**Mac**。

打开官方 DMG，将 Clash Verge 拖入 Applications／应用程序，然后启动。按系统提示授予必要权限。若已经安装，可以直接继续。

选一条路径即可：

- **从未配置过，或者想先独立验证 AWS：走 6.2 的独立配置。** 不需要购买其他代理订阅。
- **已经有可用订阅和国内外分流规则，希望保留：走 6.3 的扩展脚本。** 本次实际电脑采用这条路径。

### 6.2 路径 A：创建一个独立 AWS 配置

1. 打开 Clash Verge 的 **订阅／Profiles** 页面。
2. 点击 **新建**，选择本地配置（Local），名称填 `AWS 独立配置`。不同版本若提供“导入本地文件”，也可将下方内容保存成 UTF-8 纯文本 `aws-proxy.yaml` 后导入。
3. 打开该配置的编辑入口，粘贴以下内容。
4. 替换两个位置的 `YOUR_STATIC_IP` 和一处 `YOUR_SS_KEY`。YAML 缩进使用空格，不使用 Tab。

```yaml
mixed-port: 7897
allow-lan: false
mode: rule
log-level: info
ipv6: false

proxies:
  - name: AWS-US
    type: ss
    server: YOUR_STATIC_IP
    port: 24443
    cipher: 2022-blake3-aes-128-gcm
    password: "YOUR_SS_KEY"
    udp: true
    dialer-proxy: DIRECT

proxy-groups:
  - name: AWS-ROUTE
    type: select
    proxies:
      - AWS-US
      - DIRECT

dns:
  enable: true
  listen: 127.0.0.1:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
  nameserver:
    - "https://1.1.1.1/dns-query#AWS-US"

rules:
  - IP-CIDR,YOUR_STATIC_IP/32,DIRECT,no-resolve
  - DOMAIN-SUFFIX,local,DIRECT
  - DOMAIN-SUFFIX,lan,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - MATCH,AWS-ROUTE
```

5. 保存，选中／启用这张本地配置卡片，确认没有配置错误。
6. 打开 **代理／Proxies** 页面，在 `AWS-ROUTE` 中选中 **AWS-US**，不要选 DIRECT。
7. 模式使用 **规则／Rule**，开启 **系统代理**。
8. 在设置中检查 **混合端口／Mixed Port**，以下测试默认使用 `7897`。Clash Verge 的应用设置可能覆盖文件中的端口、DNS 等字段；如果端口不同，以实际设置为准并修改测试命令。如果启用了全局 DNS 覆写，测试此配置时应关闭该覆写或确认最终配置保留了上面的 DNS。

这份基础配置会让被客户端接管的普通公网访问默认走 AWS，**还不是完整的国内外自动分流配置**。它不依赖远程规则库，适合先验证链路。`dialer-proxy: DIRECT` 表示直接连接 AWS；DNS 示例把查询经 AWS 发到 DoH 服务，节点本身使用数字 IP，避免为节点解析域名时循环依赖。[Mihomo Shadowsocks 配置](https://wiki.metacubex.one/config/proxies/ss/)、[DNS 附加参数](https://wiki.metacubex.one/config/dns/)

### 6.3 路径 B：给现有订阅加入 AWS 节点

操作前，从订阅卡片打开配置目录或导出功能，备份现有配置和已有扩展脚本。不要将下面代码直接覆盖到承载其他功能的脚本上；已有脚本应合并逻辑。

1. 在 **代理** 页找到控制日常国外流量的主选择组，记下完整名称。本次环境名称是 `🔰 选择节点`，你的可能不同。
2. 回到 **订阅** 页，右键当前使用的订阅卡片，进入 **编辑扩展脚本／Script**。优先使用该订阅的扩展，避免影响其他配置。
3. 如果原脚本只是空的 `main` 模板，可替换为下方内容。
4. 替换 IP、密钥和 `GROUP_NAME`，其中组名要与第 1 步完全相同。

```javascript
function main(config) {
  const GROUP_NAME = "🔰 选择节点";
  const node = {
    name: "AWS-US",
    type: "ss",
    server: "YOUR_STATIC_IP",
    port: 24443,
    cipher: "2022-blake3-aes-128-gcm",
    password: "YOUR_SS_KEY",
    udp: true,
    "dialer-proxy": "DIRECT"
  };

  const group = (config["proxy-groups"] || [])
    .find(item => item.name === GROUP_NAME);
  if (!group) {
    throw new Error("找不到代理组，请核对 GROUP_NAME：" + GROUP_NAME);
  }
  if (group.type !== "select") {
    throw new Error("请选择手动选择组，避免自动测速切换出口");
  }

  config.proxies = (config.proxies || [])
    .filter(item => item.name !== node.name)
    .concat([node]);
  group.proxies = [node.name].concat(
    (group.proxies || []).filter(name => name !== node.name)
  );

  const directRule = "IP-CIDR," + node.server + "/32,DIRECT,no-resolve";
  config.rules = [directRule].concat(
    (config.rules || []).filter(rule => rule !== directRule)
  );
  return config;
}
```

5. 保存并重新应用当前订阅，确认脚本没有报错。
6. 在主选择组里手动选中 **AWS-US**；新增节点排在第一位，不代表运行中的选择一定已经改变。
7. 若有 AI、流媒体等单独分组，也检查它们是否跟随主组。某个分组固定选择其他节点时，该组流量仍会走其他节点。

订阅更新时，扩展脚本会重新应用，减少手工修改订阅原文被覆盖的问题。菜单和执行优先级可对照 [Clash Verge 扩展配置说明](https://www.clashverge.dev/guide/extend.html)。

![Clash 中配置、策略组和流量接管的三层关系](../outputs/aws-proxy-guide/assets/05-clash.svg)

### 6.4 系统代理、TUN、规则模式怎么选

| 设置 | 控制什么 | 本教程建议 |
| --- | --- | --- |
| 系统代理 | 让遵循系统代理的浏览器和应用通过 Clash | 初次浏览器测试先开启 |
| TUN / 虚拟网卡 | 接管更多不使用系统代理的程序流量 | 需要终端或更多应用时开启；按提示安装／启用服务模式 |
| 规则 / Rule | 根据规则选择直连或某个代理组 | 日常使用 |
| 全局 / Global | 被接管的流量按全局组出口发送 | 临时排查分流问题；仍要选择全局组里的 AWS |
| 直连 / Direct | 被接管的流量直接连接 | 不用于验证 AWS 出口 |

“规则模式”不等于自动知道哪些网站在国内，效果取决于配置里的规则。系统代理也不保证所有程序都遵守。[Clash Verge 官方快速入门](https://www.clashverge.dev/guide/quickstart.html)

路径 A 若只想让几个国内站点直连，可在最后的 `MATCH,AWS-ROUTE` **之前**增加自己的域名规则，例如：

```yaml
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
```

这些只是举例，不能覆盖所有国内网站及其 CDN。需要完整国内外分流时，优先采用自己已验证的规则配置并走路径 B；修改后在“连接”页核对真实命中规则。

### 6.5 先在电脑上验收

操作位置：**Mac 的“终端”应用**。可按 Command+空格，搜索 Terminal／终端打开。

```bash
curl --noproxy '' --proxy http://127.0.0.1:7897 --max-time 20 https://api4.ipify.org
```

输出应与 `YOUR_STATIC_IP` 完全相同。若没有换行，IP 后面紧跟终端提示符也正常。

再验证一个 HTTPS 网站：

```bash
curl --noproxy '' --proxy http://127.0.0.1:7897 --max-time 20 \
  -o /dev/null -sS -w 'HTTP=%{http_code} TLS=%{ssl_verify_result}\n' \
  https://www.apple.com/
```

通常应得到 HTTP 200 和 `TLS=0`。可用的 HTTP 响应说明请求已到网站；`TLS=0` 表示此次证书验证通过。

然后用浏览器打开 [出口 IP 检测](https://api4.ipify.org/)，确认浏览器也显示同一地址。显式指定代理的 curl 成功，只能证明这条测试请求走代理，不能代替浏览器测试。

打开 Clash 的 **连接／Connections** 页，找到刚访问的域名，检查链路里包含 `AWS-US`。如果显示其他国家节点，回到相应策略组修改。

**其他代理还要开吗？** 直接连接 AWS 成功后，不需要其他节点中转。Clash Verge 客户端仍须运行；原订阅可保留作规则来源或备用。若扩展脚本附着在原订阅上，也要继续启用那份配置，它和“正在使用原订阅的其他节点”不是同一回事。

**完成标志：**电脑测试出口等于自己的静态 IP、HTTPS 正常、Clash 连接链路指向 AWS。

## 7. iPhone 配置 Shadowrocket

### 7.1 第一次先手动添加

操作位置：**iPhone → Shadowrocket**。

1. 打开首页，点击添加节点的 **＋**。
2. 类型选择 **Shadowsocks**，不要选 ShadowsocksR、SOCKS5 或 HTTPS。
3. 按下表填写。可从自己的密码管理器复制密钥，避免手输出错。

![Shadowrocket 节点编辑字段示意](../outputs/aws-proxy-guide/assets/06-shadowrocket.svg)

| 手机字段 | 填写内容 |
| --- | --- |
| 类型 | Shadowsocks |
| 地址 | 自己的静态公网 IPv4，即 `YOUR_STATIC_IP` |
| 端口 | `24443` |
| 密码 | 第 5.3 节生成的完整密钥 |
| 算法 | `2022-blake3-aes-128-gcm` |
| 混淆 | `none` |
| 插件 | `none` |
| 一次性认证 | 关闭 |
| UDP Over TCP | 关闭，服务端未配置这一扩展 |
| TCP 快速打开 | 初次测试保持关闭 |
| UDP 转发 | 开启 |
| 代理通过 | 留空，不选择其他节点 |
| 备注 | `AWS-US` |

**“算法”就是加密方式。** `aes-128-gcm` 和 `2022-blake3-aes-128-gcm` 是不同算法，不能互换。若列表没有完整算法，先更新 Shadowrocket；不要随便选一个近似名称。

4. 点右上角 **保存**。
5. 回到首页，点选 **AWS-US**，确认选中标记在它旁边。
6. 将 **全局路由** 暂时设为 **代理**，便于排除分流干扰。
7. 打开顶部连接开关，第一次按 iOS 提示允许添加 VPN 配置，完成系统要求的验证。

### 7.2 在手机上验证

1. 用 Safari 打开 [https://api4.ipify.org/](https://api4.ipify.org/)。
2. 确认显示自己服务器的静态 IP。
3. 再打开 [Apple](https://www.apple.com/) 或其他 HTTPS 网站。
4. 分别在 Wi-Fi、蜂窝网络下测试一次。切换网络后可关闭再打开 Shadowrocket 连接，避免旧连接影响判断。

VPN 图标或开关打开只表示系统接管已启用，不代表服务器认证一定成功。节点延迟数字也不能替代出口 IP 验证。

初次测试成功后，可以把“全局路由”切回“配置”进行分流，但前提是已经选用了合适的规则配置。新装 App 没有验证过分流规则时，先不要假定国内流量一定直连。

### 7.3 扫码导入为什么仍要核对

节点可以通过 `ss://` 链接或二维码分享。**先手动配置成功，再用 Shadowrocket 的“分享节点”生成二维码供自己的其他设备导入，是更容易核对的路径。** 分享内容包含密钥。

本次实测曾遇到：扫码后地址和端口正确，但密码显示“必填”，算法一栏为空，随后 Safari 提示无法建立安全连接。服务器同时出现认证失败日志。这说明“生成了二维码、扫出了节点”并不能证明字段完整。

Shadowsocks 2022 的标准链接要求特定的用户信息编码方式；不同客户端版本的解析兼容性可能有差异。本次更换编码后尚未收到手机重测成功反馈，不能把替代格式写成已证实的通用解决方案。[官方 SIP002 链接格式](https://shadowsocks.org/doc/sip002.html)

如果导入后密码或算法为空，直接按 7.1 手动补齐，再保存、重连。无需因为这一现象立即重装服务器或修改 Safari 的证书校验。

**完成标志：**手机独立显示自己的 AWS 静态 IP，且 HTTPS 页面可打开。

## 8. 怎样判断“整个方案已经成功”

![从服务监听到应用权限的分层验收图](../outputs/aws-proxy-guide/assets/07-validation.svg)

按顺序验收，不跳过前面的层次：

| 层次 | 检查方法 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| 服务 | `systemctl is-active`、`ss -lntu` | 程序运行、端口监听 | 手机一定可连 |
| 网络与认证 | 客户端请求成功、服务端无对应认证错误 | 当前网络与节点参数可用 | 所有运营商都稳定 |
| 出口 | 在每台设备打开 IP 检测页 | 该次请求出口是 AWS | 所有应用都已走 AWS |
| HTTPS | 访问正常 HTTPS 网站 | 该次 TLS 与网页连接正常 | 某个平台账号权限正常 |
| 目标应用 | 用自己的账号完成一次实际功能请求 | 该应用在当前账号下可用 | 以后永远不触发平台限制 |

若要测试 Claude Code，可先启用 Clash TUN，或在**启动 Claude Code 的同一个 Mac 终端窗口**设置代理环境变量：

```bash
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
```

然后从该窗口启动工具并发起一次实际请求；这些变量不会自动修改已经运行的 GUI 应用。大小写变量保持一致，是为了避免旧的小写代理值优先生效。若原有 `NO_PROXY` 或 `no_proxy` 包含 `*`、目标域名，会绕过代理，需要先检查并调整。Claude Code 官方支持 HTTP/HTTPS 代理，不支持 SOCKS 代理，因此这里使用 Clash 的 HTTP 混合端口。[Claude Code 网络配置说明](https://code.claude.com/docs/en/network-config)

Cursor 还可能经过自身的服务链路，要结合客户端日志中的请求地址、状态码和错误文字分析，不把所有拒绝都归结为本地 IP。

无需立即写入 `.zshrc`，先验证当前窗口的临时设置。撤销临时变量：

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
```

如果某 API 返回 401，且内容是缺少 API key，说明服务器已响应认证要求，**不代表模型调用已成功**。如果返回明确的账号、地区或使用策略拒绝，应按平台说明处理；换 IP 不能保证解决。

## 9. 常见故障：从哪里查起

### 9.1 先按现象定位

| 现象 | 优先检查 | 下一步 |
| --- | --- | --- |
| 浏览器 SSH 打不开 | 实例状态、TCP 22、账号激活 | 先恢复管理连接 |
| `sing-box check` 报错 | JSON 逗号、引号、密钥长度 | 修正配置后再重启 |
| 服务不是 active | 服务日志、配置文件权限 | 查看 `journalctl` 的具体错误 |
| 客户端连接超时 | 公网 IP、云防火墙、UFW、当前网络到端口的连通性 | 比较 Wi-Fi／蜂窝，核对 TCP 24443 |
| `message authentication failed` | 两端算法、密码是否一致 | 核对完整算法和密钥，尤其末尾 `=` |
| `bad header` | 协议／插件不一致，或无效外部连接 | 先核对客户端，结合请求时间和来源判断 |
| Safari 无法建立安全连接 | 节点参数、是否真正走代理、TLS／DNS | 先测其他 HTTPS 网站，再查对应服务日志 |
| 手机失败但电脑正常 | 手机导入字段、网络差异、App 版本 | 手动重建节点并换网络复测 |
| 出口仍是旧节点 | 策略组、规则命中、其他 VPN、旧连接 | 在连接页确认实际链路，断开重连 |
| 浏览器可用、终端不可用 | 终端未使用系统代理 | 临时环境变量或 TUN |
| 只有某个网站不可用 | 该域名的分流、网站状态、账号／服务限制 | 不先重装整个代理 |
| 401 / 403 / UsagePolicy | 具体响应内容与账号权限 | 区分认证、服务政策与网络连接 |

公网端口可能收到与自己无关的探测连接。日志里看到一次认证失败，不能直接断言来自自己的手机；需要对应重试时间、来源地址或可控的停止／启动测试。

### 9.2 常用排查命令

**在服务器终端执行：**

```bash
sudo systemctl status sing-box --no-pager
sudo journalctl -u sing-box --since '10 minutes ago' --no-pager -n 50
sudo ss -lntu 'sport = :24443'
curl --max-time 20 https://api4.ipify.org
```

最后一条只检查服务器自身出站，不能代替手机测试。实时看日志可以用下方命令，结束时按 Control+C：

```bash
sudo journalctl -u sing-box -f
```

**在 Mac 终端执行：**先把命令里的 IP 替换成自己的。

```bash
nc -vz -G 5 YOUR_STATIC_IP 24443
```

它只测试 TCP 端口可达，不验证 Shadowsocks 密钥。如果 Mac 开着 TUN 或其他 VPN，此结果也不一定代表底层网络直连；判断直连时需核对 DIRECT 规则和当前接管状态。

### 9.3 认证失败时按这张清单核对

1. 服务器与客户端的端口都是 `24443`。
2. 手机类型是 Shadowsocks，电脑类型是 `ss`。
3. 算法完整一致，特别是 `2022-blake3-` 前缀。
4. 密钥没有空格、换行，末尾 `=` 没被漏掉。
5. 插件与混淆都是未启用。
6. 修改手机节点后点了“保存”，并确实选中了这个节点。
7. 若改过服务器配置，已经检查配置并重启服务。

## 10. 日常使用、维护与停止计费

### 10.1 平时哪些东西需要运行

| 位置 | 正式使用时需要什么 | 不需要什么 |
| --- | --- | --- |
| AWS | 实例运行，sing-box 服务 active | 不用一直开浏览器 SSH 窗口 |
| Mac | Clash Verge 运行，所需代理接管开启 | 不需要旧的 SSH 动态隧道常驻 |
| iPhone | Shadowrocket 连接开启 | 不依赖 Mac 或电脑热点 |

sing-box 的开机启动是“服务器重启后自动启动代理服务”。Clash Verge 的登录启动是“Mac 登录后自动打开客户端”。它们与之前的 SSH 自动重连任务是不同机制。

如果以前专门创建了 SSH 自启动任务，应在新的 Shadowsocks 已完成出口验收后，只停用对应任务。不要停止系统中所有 SSH 进程；它们可能是其他工作连接。可选 SSH 测试方法见附录 A。

### 10.2 看费用与停用资源

Lightsail 基础实例按小时累计、按月度套餐上限计费；**停止实例仍会计费，删除实例才停止该实例继续产生费用**。静态 IPv4 绑定实例时不额外收取该静态地址费用，闲置未绑定超过规定时间会收费。快照等资源独立计费。[Lightsail 官方计费说明](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)

1. 定期打开 **Billing and Cost Management → Bills / 账单**，查看 Lightsail 明细；同时查看 Credits／Free Tier 的余额与到期日。
2. 若使用 Paid plan，可在 **Budgets / 预算** 建立月度成本邮件提醒，例如 10 美元。传统 AWS Budgets 的提醒不等于自动停机或硬性扣费上限。
3. 免费计划到期或额度耗尽后，若未升级，可能失去资源访问；不要把它理解为会永远自动免费续期。是否已升级、是否收费，以账号当前计划为准。

确定不再使用时：

1. 私密保存仍需要的配置；需要保留数据时先完成备份。
2. 在电脑和手机关闭该代理，恢复可用的直连或其他配置。
3. Lightsail → Instances，找到正确实例，选择 **Delete / 删除** 并核对名称。删除会丢失该实例的数据。
4. 到 Networking 检查不再使用的静态 IP，删除／释放它。释放后不能保证还能取回原地址。
5. 检查是否还有快照、额外磁盘等资源，按需删除。
6. 回到账单页复查；账单数据可能有延迟，删除前已产生的费用仍会保留。

### 10.3 软件更新与密钥管理

更新前在**服务器终端**备份配置，备份文件含密钥，不对外发送：

```bash
sudo cp -a /etc/sing-box/config.json "/root/sing-box-config-$(date +%Y%m%d-%H%M%S).json"
sudo apt-get update
sudo apt-get install --only-upgrade sing-box
sudo sing-box check -c /etc/sing-box/config.json
```

检查成功后再执行：

```bash
sudo systemctl restart sing-box
sudo systemctl is-active sing-box
```

更新后重新做电脑与手机出口测试。更换密钥时，在服务器生成新密钥、修改配置并校验重启，然后同步修改全部客户端；服务器修改后旧密钥立即无法继续使用。

### 10.4 本次方案会安装或留下哪些东西

| 位置 | 主要内容 |
| --- | --- |
| AWS 服务器 | sing-box 软件包、官方 APT 软件源、systemd 服务、`/etc/sing-box/config.json` |
| Mac | Clash Verge 及其配置；如果采用附录 B，会保存一份 SSH 私钥；可能有本地节点链接／二维码 |
| iPhone | Shadowrocket App、节点配置、iOS VPN 配置 |

分享本指南时，不要附带自己的 SSH `.pem` 私钥、代理密钥、实际节点二维码或含密码的配置文件。

## 附录 A：先用临时 SSH 隧道测试服务器（可选）

适合在安装 sing-box 之前，先判断服务器能否作为出口。它依赖附录 B 的本地 SSH 私钥准备。已经完成 Shadowsocks 的读者无需再做。

在 **Mac 终端窗口 A** 执行，替换自己的 IP：

```bash
ssh -i ~/.ssh/lightsail-us-west-2.pem \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -N -D 127.0.0.1:18080 ubuntu@YOUR_STATIC_IP
```

首次连接的服务器身份核对方法见附录 B。连接成功后这个窗口通常没有新输出，也不会返回提示符，这是正常现象：SSH 正在前台维持隧道。

再打开 **Mac 终端窗口 B**：

```bash
curl --noproxy '' --proxy socks5h://127.0.0.1:18080 \
  --max-time 20 https://api4.ipify.org
```

应显示服务器静态 IP。结束测试，在窗口 A 按 **Control+C**，隧道就会停止。本附录不设置登录启动、不安装 autossh；重开电脑后不会自动恢复这个临时隧道。

SSH 端口能用不能证明 Shadowsocks 的 `24443` 也能用；两者是不同的网络入口。若其他 VPN/TUN 正在接管 SSH，测试也不能单凭出口证明“直连 AWS”。

## 附录 B：下载 SSH 密钥，在 Mac 终端管理服务器

使用浏览器 SSH 完成主流程的读者可以暂时跳过。私钥是登录服务器的凭据，要像密码一样保存。

1. 打开 Lightsail 的 **Account / 账户 → SSH keys / SSH 密钥**。
2. 找到 **Oregon / us-west-2** 对应的默认密钥，点击下载。必须与创建实例时使用的密钥匹配。
3. 确认下载文件名；常见名称为 `LightsailDefaultKey-us-west-2.pem`。
4. 在 **Mac 终端**逐行执行。如果文件名不同，改第二条命令的源文件名。

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cp ~/Downloads/LightsailDefaultKey-us-west-2.pem ~/.ssh/lightsail-us-west-2.pem
chmod 600 ~/.ssh/lightsail-us-west-2.pem
chmod 600 ~/Downloads/LightsailDefaultKey-us-west-2.pem
```

执行前确认目标路径没有自己需要保留的其他密钥文件；不要覆盖同名旧密钥。

5. 在 **浏览器 SSH 终端**执行下面命令，记录 ED25519 主机公钥指纹：

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

6. 在 **Mac 终端**连接：

```bash
ssh -i ~/.ssh/lightsail-us-west-2.pem \
  -o IdentitiesOnly=yes \
  -o HostKeyAlgorithms=ssh-ed25519 \
  ubuntu@YOUR_STATIC_IP
```

首次提示是否信任主机时，核对与第 5 步的 SHA256 指纹一致，再输入 `yes`。出现 `ubuntu@…` 提示符后，输入 `whoami` 应返回 `ubuntu`。完成后输入 `exit` 返回 Mac。

如果提示 `Permission denied (publickey)`，检查用户名是不是 `ubuntu`、密钥是否属于正确地区和实例。如果提示私钥权限过宽，重新执行 `chmod 600`。如果提示主机指纹变化，先查是否重建了实例或连错 IP，不直接绕过校验。

## 最后的完成清单

- 已确认 AWS 账号计划、余额和到期日。
- 美国实例 Running，静态公网 IPv4 已绑定。
- sing-box 配置检查成功、服务 active、开机启动 enabled。
- TCP/UDP `24443` 已按需放行。
- Mac 代理请求的出口等于静态 IP，HTTPS 正常。
- iPhone 密码和算法非空，独立出口测试成功。
- 实际目标应用完成了一次有权限的功能请求；若失败，已记录具体错误层次。
- 没有把真实密钥、私钥、节点二维码随指南对外分享。

相关主题入口：[梯子](梯子.md)。本文的图均为教学示意图，使用示例值，不是 AWS 或 Shadowrocket 当前界面的逐像素截图。

## 常用链接：查看免费额度、剩余天数和流量

以下控制台链接需要先登录自己的 AWS 账号。

| 查看内容 | 链接与操作 |
| --- | --- |
| 免费额度、免费计划剩余天数 | [AWS Free Tier / 免费套餐](https://us-east-1.console.aws.amazon.com/costmanagement/home?region=us-east-1#/freetier)：展开“查看详细信息”，查看剩余服务抵扣金和剩余天数；具体展示以自己的账号计划为准。 |
| 本月入站流量 | [personal-us-proxy 入站流量（Current month）](https://ap-northeast-1.console.aws.amazon.com/lightsail/webapp/us-west-2/instances/personal-us-proxy/metrics/NetworkIn?timeRange=MTD)：查看 Incoming network traffic，并将鼠标移到图中的数据点查看数值。 |
| 本月出站流量 | [personal-us-proxy 出站流量（Current month）](https://ap-northeast-1.console.aws.amazon.com/lightsail/webapp/us-west-2/instances/personal-us-proxy/metrics/NetworkOut?timeRange=MTD)：查看 Outgoing network traffic，并将鼠标移到图中的数据点查看数值。 |
| 流量额度如何计算、何时重置、超额如何收费 | [AWS 官方：Lightsail 数据传输额度常见问题](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html)。 |

**其他读者如何使用：** 上面两个流量链接指向俄勒冈 `us-west-2` 的 `personal-us-proxy` 实例。如果你的实例名称或地区不同，请从 [Lightsail 控制台](https://lightsail.aws.amazon.com/)进入自己的实例，选择 **Metrics / 指标 → Incoming 或 Outgoing network traffic → Current month / 本月**。链接中的控制台入口域名不代表实例实际所在地区，以实例页面显示的地区为准。

**读数时注意：** 本月视图中的单个数据点可能是某一天的合计，不是整月累计，也不是“剩余流量”。入站和出站都计入套餐流量额度；代理转发会同时产生服务器入站和出站流量。估算本月剩余额度时，需要用套餐额度减去本月累计入站与出站用量，并留意监控数据延迟。流量额度按月重置，免费计划剩余天数与流量额度是两回事；实际费用以账单为准。

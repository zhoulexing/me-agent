# AWS 美国固定 IP 代理搭建指南

适用：**Mac + iPhone**。更新：2026-10-16。

这篇教程从准备软件开始，带你搭好美国 AWS 代理。完成后，**Claude、Anthropic 和 `api4.ipify.org` 走美国 AWS 固定 IP，其他网站继续按原来的规则访问。**

按下面六步做，每一步看到“完成标志”再继续。电脑和手机的这套方案均已在本次搭建中跑通；手机结果由使用者确认。截图中的名称是示例，配置中的 `YOUR_STATIC_IP`、`YOUR_SS_KEY` 要换成你自己的值。

1. [前期准备：设备、软件和账号](#step-1)
2. [先搭好梯子：订阅 + Clash Verge](#step-2)
3. [注册美区 Apple 账号，安装 Shadowrocket](#step-3)
4. [注册 AWS，创建美国 Lightsail 服务器](#step-4)
5. [设置代理：服务器 → Mac → iPhone](#step-5)
6. [打开 IP 检测网站，验证是否成功](#step-6)

<a id="step-1"></a>
## 1. 前期准备：设备、软件和账号

### 需要准备什么

| 准备项 | 用途 / 去哪里找 |
| --- | --- |
| 一台 Mac、一部 iPhone | 本教程不涉及 Windows、Android |
| 一个可用的代理订阅 | 前期访问相关网站，后期作为连接 AWS 的中转线路 |
| [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev/releases) | 装在 Mac 上，免费；下载官方稳定版 |
| [Shadowrocket](https://apps.apple.com/us/app/shadowrocket/id932747118) | 装在 iPhone 上，App Store 付费购买；需要可下载它的商店账号 |
| 长期使用的邮箱和中国大陆手机号 | 接收 Apple、AWS 的验证信息 |
| AWS 接受的支付卡及真实账单地址 | 注册与支付云服务器费用；是否可用以 AWS 验证为准 |
| 美区 Apple 账号可用的付款方式或合规购买的美区余额 | 用于购买 Shadowrocket；注册账号和购买 App 是两件事 |

Mac 上只需要安装 Clash Verge Rev。**sing-box 安装在 AWS 服务器上**，手机只安装 Shadowrocket。浏览器用 Safari 或 Chrome 即可。

### 预计要花多少钱

| 项目 | 费用 |
| --- | --- |
| 代理订阅 | 按服务商当前套餐支付 |
| Clash Verge Rev | 免费 |
| Shadowrocket | 按美区 App Store 当时显示的价格购买 |
| Lightsail 服务器 | 本文选 **7 美元/月**：1 GB 内存、2 vCPU、40 GB SSD、2 TB 套餐流量、含公网 IPv4 |

Lightsail 按小时累计实例费用，有月度套餐上限；税费、超额流量和额外资源另计。免费额度是否抵扣、能用多久，看自己账号的 **Free Tier** 页面。它不是“买一个月，到期自动停机”的产品：**付费计划下，资源保留就会持续计费，停止实例也不等于停止计费。** [套餐价格](https://aws.amazon.com/lightsail/pricing/) · [计费说明](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)

**完成标志：** 设备齐全，邮箱、手机号能收验证码，已准备好支付方式。

<a id="step-2"></a>
## 2. 先搭好梯子：订阅 + Clash Verge

先确保能访问后面要用的网站。本教程以 **[iKuuu 入口](https://ikuuu.one/user) + Clash Verge Rev** 为例；已经有可用订阅，可以直接复用。订阅负责提供节点，Clash Verge 负责在电脑上使用这些节点。站点的入口、套餐和可用线路可能变化，以页面为准。

### 2.1 获得订阅链接

1. 打开 [iKuuu](https://ikuuu.one/user)，按站点提示注册或登录。
2. 选择适合自己的套餐。先确认线路可用，不必为本教程购买长期套餐。
3. 在用户中心找到 **订阅 / 一键导入 / Clash 订阅**，复制适用于 Clash 的订阅链接。

订阅链接通常带有个人凭据，自己保存，不发到公开文档。如果连入口都打不开，先使用已有的可用网络或向服务商确认入口；安装 Clash 本身不会自动获得网络线路。

### 2.2 安装 Clash Verge Rev

1. 在 Mac 左上角 ** → 关于本机** 看芯片：Apple M 系列选 `aarch64` / ARM64；Intel 选 `x64`。
2. 到 [官方 Releases](https://github.com/clash-verge-rev/clash-verge-rev/releases) 下载对应的 `.dmg`。
3. 打开安装包，把 Clash Verge 拖到 **Applications / 应用程序**，再从应用程序启动。
4. 打开 **订阅** 页，将链接粘到 **订阅文件链接**，点 **导入**，然后点新出现的订阅卡片启用。

### 2.3 先让普通代理能用

1. 在 **代理** 页选 **规则** 模式。
2. 在日常使用的选择组中选一个可用节点，例如美国、日本或香港节点。
3. 在 **首页** 打开 **系统代理**。本教程先用它接管浏览器；需要接管不遵循系统代理的软件时，再按客户端提示安装服务模式、开启 TUN。
4. 打开 [GitHub](https://github.com/) 和 [AWS 注册页面](https://signin.aws.amazon.com/signup?request_type=register)，确认能加载。

**完成标志：** Clash 已导入订阅，浏览器能正常访问上述页面。

> 后面这套方案仍然需要订阅节点：它负责“从你这里到 AWS”的第一段连接。日常只开 Clash Verge 这一个电脑代理客户端即可，不需要再开第二个 VPN 或 SSH 隧道。中转能否提速取决于实际线路。

<a id="step-3"></a>
## 3. 注册美区 Apple 账号，安装 Shadowrocket

已有可下载 Shadowrocket 的账号，直接安装后跳到第 4 步。

- 注册入口：[创建 Apple 账户](https://account.apple.com/)。进入后点 **创建你的 Apple 账户**，国家或地区选择 **美国**。
- 准备未被占用的邮箱、真实生日，以及本人长期使用的手机号。**电话号码区号可选中国大陆 `+86`，使用中国手机号验证，不需要先买美国号码；能否通过以注册页面的实际验证结果为准。** 商店地区和手机号区号是不同设置。
- 完成邮箱、手机号验证。遇到无法创建的提示，按 [Apple 官方注册说明](https://support.apple.com/zh-cn/108647) 排查。
- iPhone **设置 → 你的名字 → 媒体与购买项目**，退出这里的原账号，再登录新账号；保留原来的 iCloud 登录。
- 打开 [Shadowrocket 的美区 App Store 页面](https://apps.apple.com/us/app/shadowrocket/id932747118)，按商店要求补全付款与账单资料并购买。开发者为 **Shadow Launch Technology Limited**，不要下载名字相近的仿冒 App。

**完成标志：** iPhone 上能打开 Shadowrocket。

<a id="step-4"></a>
## 4. 注册 AWS，创建美国 Lightsail 服务器

本章都在 **Mac 浏览器** 操作。先注册 AWS 国际区账号，再进入 Lightsail；Lightsail 不需要另注册一个账号。

### 4.1 注册 AWS 账号

入口：[AWS 注册](https://signin.aws.amazon.com/signup?request_type=register)。本教程使用可自主选择地区的传统 / **advanced** 注册流程。若看到新的简化注册流程，先看 [AWS 注册方式对照](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html)，选择支持完整服务与地区选择的入口。

**① 填邮箱和账号名称 → 验证邮箱。** 去邮箱取验证码，回页面填写。

![AWS 注册：邮箱、账号名称、验证邮箱按钮（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-signup-01.jpg)

**② 设置登录密码 → 继续。** 保存到自己的密码管理器。

![AWS 注册：设置密码（官方示例界面）](../outputs/aws-proxy-guide/assets/aws-signup-02.png)

**③ 如果出现 Free / Paid 账号计划选择，先看费用说明。** 符合条件可选免费计划试用；免费计划有期限和服务限制。要转付费时再确认，不把“免费额度”理解成永久免费。

**④ 联系信息选 Personal / 个人，填写自己的真实信息。** 在中国就选 China，手机区号选 `+86`。美国服务器是在下一节选择，**这里不需要编一个美国地址或美国电话**。

![AWS 注册：联系信息（官方示例；图中默认美国，实际改成自己的国家和区号）](../outputs/aws-proxy-guide/assets/aws-signup-03.png)

**⑤ 填支付卡，账单地址与银行记录一致 → 完成银行验证。** 国家也按实际账单信息选择。

![AWS 注册：支付信息（官方示例界面）](../outputs/aws-proxy-guide/assets/aws-signup-04.png)

**⑥ 完成手机身份验证。** 选择能接收验证码的号码，发送短信，填收到的验证码；若出现人机验证，按页面完成。

![AWS 注册：填写收到的验证码（官方示例界面）](../outputs/aws-proxy-guide/assets/aws-signup-07.png)

**⑦ 支持计划选 Basic / 免费基础支持 → 完成注册。** 它与服务器套餐、Free / Paid 账号计划不是同一项。收到激活邮件后再继续；激活有时需要等待。

![AWS 注册：选择免费基础支持（官方历史示例，付费支持的名称和价格以现页面为准）](../outputs/aws-proxy-guide/assets/aws-signup-08.png)

这些注册示例图来自 [AWS 官方入门教程](https://docs.aws.amazon.com/hands-on/latest/setup-environment/module-one.html)，部分仍是旧版界面，图中的“12 个月免费”等宣传不作为本教程的权益承诺。当前步骤以 [AWS 账号注册说明](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html) 和实际页面为准。注册成功后按提示保护账号并设置 MFA。

**完成标志：** 收到账号激活邮件，能登录 [Lightsail 控制台](https://lightsail.aws.amazon.com/)。

### 4.2 创建美国服务器

**① 打开 [Lightsail](https://lightsail.aws.amazon.com/) → Instances / 实例 → Create instance / 创建实例。**

**② 地区选 Oregon / 俄勒冈。** 不是这个地区，就点 **Change AWS Region and Availability Zone** 更改，确认代码 `us-west-2`。

![Lightsail 创建实例：地区选择 Oregon（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-01-region.jpg)

**③ 选择 Linux operating system → Ubuntu 24.04 LTS。** 旧版界面的对应入口是 **Linux/Unix → OS Only → Ubuntu**。

![Lightsail 创建实例：选择纯 Linux 系统与 Ubuntu 24.04（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-02-ubuntu.jpg)

**④ 选择 General purpose → Dual-stack → 7 美元/月。** 核对 **1 GB、2 vCPU、40 GB、2 TB**。Dual-stack 含本教程需要的公网 IPv4。

![Lightsail 创建实例：双栈网络和七美元套餐（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-03-plan.jpg)

**⑤ 名称填 `personal-us-proxy`，数量保持 1。** 自动快照先不勾选；展开 **Advanced settings**，SSH key 使用 **Default SSH key**，首次使用时按提示生成地区默认密钥。启动脚本留空。

![Lightsail 创建实例：名称、数量、默认 SSH 密钥（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-04-name-key.jpg)

**⑥ 核对地区、套餐和数量 → 点 Create instance。** 等实例状态变为 **Running**。创建会占用计费资源，是否抵扣取决于账号权益。

![Lightsail 创建实例：页面底部的 Create instance 按钮（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-05-create.jpg)

### 4.3 把服务器 IP 固定下来

普通公网 IP 可能在停止、启动后变化，所以要绑定 **Static IP / 静态 IP**。

1. Lightsail 左侧 **Networking → Create static IP**。
2. 地区选 **Oregon / us-west-2**。
3. **Attach to an instance** 选 `personal-us-proxy`。
4. 名称填 `personal-us-proxy-ip` → **Create**。
5. 回实例详情，复制 **Static IP address**。后面所有 `YOUR_STATIC_IP` 都替换成它。

![静态 IP 已绑定时会显示 Attached to（AWS 官方示例图）](../outputs/aws-proxy-guide/assets/aws-06-static-ip.png)

上图来自 [AWS 静态 IP 文档](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)，只看 **Attached to** 这个完成标志；本教程的地区是 Oregon，实例名是 `personal-us-proxy`。若出现“No instances available to attach to”，先确认实例与静态 IP 地区相同，以及实例是否已经绑定过静态 IP。

### 4.4 打开服务器终端

进入实例 → **Connect → Connect using SSH**。会打开一个终端窗口，以后标注“服务器终端”的命令都粘贴到这里。

![Lightsail：点击 Connect using SSH 打开服务器终端（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-08-connect.jpg)

输入 `whoami` 并回车，应显示 `ubuntu`。

**完成标志：** 美国实例 Running、静态 IP 已绑定、浏览器 SSH 能执行命令。

<a id="step-5"></a>
## 5. 设置代理：服务器 → Mac → iPhone

最终连接关系如下。手机独立连接，**Mac 关机后手机仍能使用**。

```text
Claude / Anthropic / api4.ipify.org
    ↓
Mac 的 Clash Verge 或 iPhone 的 Shadowrocket
    ↓
你选中的订阅中转节点（美国、日本、香港等任选一条可用线路）
    ↓
美国 AWS：固定 IP + sing-box / Shadowsocks
    ↓
目标网站看到 AWS 的固定 IP

其他网站 → 原来的分流规则 → 普通节点或直接连接
```

### 5.1 服务器：安装 sing-box

**操作位置：刚打开的 AWS 浏览器 SSH 终端。** 每次复制一个完整代码块，回车，等执行结束再继续；出现错误时先停在该步排查。

**① 安装基础工具，再添加 sing-box 官方软件源。**

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates nano
sudo mkdir -p /etc/apt/keyrings
sudo curl -fsSL https://sing-box.app/gpg.key -o /etc/apt/keyrings/sagernet.asc
sudo chmod a+r /etc/apt/keyrings/sagernet.asc
```

下面这块从第一行复制到最后的 `EOF_APT`：

```bash
sudo tee /etc/apt/sources.list.d/sagernet.sources > /dev/null <<'EOF_APT'
Types: deb
URIs: https://deb.sagernet.org/
Suites: *
Components: *
Enabled: yes
Signed-By: /etc/apt/keyrings/sagernet.asc
EOF_APT
```

```bash
sudo apt-get update
sudo apt-get install -y sing-box
sing-box version
```

看到版本号即可。本次使用 1.14.3，官方稳定版之后可能更新。[官方安装说明](https://sing-box.sagernet.org/installation/package-manager/)

**② 生成代理密码。**

```bash
sing-box generate rand --base64 16
```

把输出的整行保存好，包括末尾 `=`。它就是后面的 `YOUR_SS_KEY`，电脑、手机与服务器都要用同一串。不要改成自己随手编的短密码。[算法与密钥要求](https://sing-box.sagernet.org/configuration/inbound/shadowsocks/)

| 后面反复用到的参数 | 你要填写的内容 |
| --- | --- |
| `YOUR_STATIC_IP` | 刚绑定的 AWS 静态公网 IPv4 |
| 端口 | `24443` |
| 算法 / 加密方式 | `2022-blake3-aes-128-gcm` |
| `YOUR_SS_KEY` | 刚生成的整行随机密码 |

**③ 写入配置。** 以下用于本教程新建的服务器；已有 sing-box 配置时先备份，不要覆盖其他服务。

```bash
sudo nano /etc/sing-box/config.json
```

用 **Control+K** 清掉原有示例行，粘贴下面内容，仅把 `YOUR_SS_KEY` 换成自己的密码，保留英文双引号。

```json
{
  "log": { "level": "warn", "timestamp": true },
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
  "outbounds": [ { "type": "direct", "tag": "direct" } ]
}
```

保存：**Control+O → 回车 → Control+X**。这里按的是 Control，不是 Command。

**④ 检查并启动。**

```bash
sudo sing-box check -c /etc/sing-box/config.json
systemctl show sing-box -p User
```

第一条应无报错；本教程官方 Ubuntu 包第二条显示 `User=sing-box`。确认后执行：

```bash
sudo chown root:sing-box /etc/sing-box /etc/sing-box/config.json
sudo chmod 750 /etc/sing-box
sudo chmod 640 /etc/sing-box/config.json
sudo systemctl enable sing-box
sudo systemctl restart sing-box
sudo systemctl is-active sing-box
sudo systemctl is-enabled sing-box
sudo ss -lntu 'sport = :24443'
```

应看到 **active、enabled，以及 TCP / UDP 24443 的监听记录**。如果服务用户不同或检查失败，先核对安装来源及错误，不继续粘贴。失败日志用下面这条查看：

```bash
sudo journalctl -u sing-box --since '10 minutes ago' --no-pager -n 50
```

### 5.2 服务器：放行 24443 端口

回到 **Lightsail 实例 → Networking → Firewall rules → Add rule**。旧版页面叫 **IPv4 firewall**。

分别添加两条：

| Application | Protocol | Port | Source / Preset |
| --- | --- | --- | --- |
| Custom | TCP | `24443` | Anywhere IPv4，`0.0.0.0/0` |
| Custom | UDP | `24443` | Anywhere IPv4，`0.0.0.0/0` |

![防火墙填写参考：Custom、TCP、24443、Anywhere IPv4（已保存规则的编辑界面实截）](../outputs/aws-proxy-guide/assets/aws-07-firewall-form.jpg)

新建时点 **Add rule / Create** 保存；上图是已存在规则的编辑页，所以底部叫 Update rule。旧版页面若用“Restrict to IP address”复选框，不勾选即允许任意 IPv4。

![完成标志：规则列表中同时出现 TCP 24443 和 UDP 24443（当前界面实截）](../outputs/aws-proxy-guide/assets/aws-07-firewall-result.jpg)

这两个端口允许公网连接，由代理密码认证。保留 SSH 22 管理入口；截图里的 HTTP 80 是默认规则，本代理不依赖它。无需额外开放代理的 IPv6 端口。[官方防火墙操作说明](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-editing-firewall-rules.html)

在**服务器终端**执行 `sudo ufw status`：显示 `inactive` 就继续；若为 `active`，再执行：

```bash
sudo ufw allow 24443/tcp
sudo ufw allow 24443/udp
```

**完成标志：** sing-box 正常运行，云端及已启用的系统防火墙都允许 TCP / UDP 24443。

### 5.3 Mac：只让指定网站经中转走 AWS

**操作位置：Mac 的 Clash Verge。** 使用第 2 步已启用的订阅，保留它原来的国内外分流规则。

**① 记下一个能用的中转节点名称。** 在代理列表复制完整名称，包含旗帜、空格和后缀。可以准备美国、日本、香港三条候选线路，但每次实际只选一条。

**② 打开 订阅 → 右键当前订阅卡片 → 扩展脚本。** 这是订阅自己的扩展脚本，不是“编辑文件”或“编辑规则”。先保存原脚本备份；如果原脚本已有自己的业务逻辑，需要合并，不能直接覆盖。

**③ 粘贴下面脚本。只需改开头三项：IP、密码、中转节点列表。** 至少填一个真实存在的中转节点；其余候选可以删除整行。后面的规则直接保留。

```javascript
function main(config) {
  // 只改这里：自己的静态 IP、密码、订阅中真实存在的节点名称。
  const server = "YOUR_STATIC_IP";
  const password = "YOUR_SS_KEY";
  const relayCandidates = [
    "🇺🇲 美国Z02 | IEPL | x1.5",
    "🇭🇰 香港Z02 | IEPL",
    "🇯🇵 日本Z01 | IEPL"
  ];

  const awsName = "Claude 专用 AWS";
  const relayGroup = "🚀 AWS 中转";
  const claudeGroup = "🤖 Claude / Anthropic";
  if (server === "YOUR_STATIC_IP" || password === "YOUR_SS_KEY") {
    throw new Error("请先填写自己的 AWS 静态 IP 和代理密码");
  }
  const proxies = (config.proxies || []).filter(p => p.name !== awsName);
  const names = new Set(proxies.map(p => p.name));
  const relays = relayCandidates.filter(n => names.has(n));
  if (!relays.length) {
    throw new Error("找不到中转节点，请复制订阅中的完整节点名称");
  }
  config.proxies = proxies.concat([{
    name: awsName, type: "ss", server, port: 24443,
    cipher: "2022-blake3-aes-128-gcm", password, udp: true,
    "dialer-proxy": relayGroup
  }]);
  config["proxy-groups"] = (config["proxy-groups"] || [])
    .filter(g => g.name !== relayGroup && g.name !== claudeGroup);
  // AWS 只放到 Claude 专用组，不加入日常的选择组。
  for (const group of config["proxy-groups"]) {
    if (group.proxies) group.proxies = group.proxies.filter(n => n !== awsName);
    if ((group["include-all"] || group["include-all-proxies"])
        && !(group["exclude-filter"] || "").includes("^Claude 专用 AWS$")) {
      const oldFilter = group["exclude-filter"];
      group["exclude-filter"] = oldFilter
        ? "(" + oldFilter + ")|^Claude 专用 AWS$" : "^Claude 专用 AWS$";
    }
  }
  config["proxy-groups"].push(
    { name: relayGroup, type: "select", proxies: relays },
    { name: claudeGroup, type: "select", proxies: [awsName] }
  );
  const domains = [
    "anthropic.com", "claude.ai", "claude.com",
    "claudeusercontent.com", "claude.app", "claudemcpcontent.com"
  ];
  const additions = domains.map(d => "DOMAIN-SUFFIX," + d + "," + claudeGroup);
  additions.push("DOMAIN,api4.ipify.org," + claudeGroup);
  additions.push("IP-CIDR," + server + "/32,DIRECT,no-resolve");
  const managed = new Set(additions.map(r => r.split(",").slice(0, 2).join(",")));
  config.rules = additions.concat((config.rules || []).filter(r =>
    !managed.has(r.split(",").slice(0, 2).join(","))
  ));
  return config;
}
```

这是在订阅原配置上添加专用节点、两组和优先规则；其他规则及其顺序保留。中转依赖 Mihomo 的 [dialer-proxy](https://wiki.metacubex.one/config/proxies/dialer-proxy/)，扩展脚本的入口见 [Clash Verge 官方说明](https://www.clashverge.dev/guide/script.html)。本例适用于包含 `proxies` 节点列表的常见订阅；只有 `proxy-providers` 的订阅需要按其结构另行调整。

**④ 保存 → 订阅页点“重新激活订阅” → 去代理页确认。**

| 位置 | 应选什么 |
| --- | --- |
| 模式 | **规则** |
| 日常选择组，如“🔰 选择节点” | 平时使用的普通节点 |
| “🚀 AWS 中转” | 美国、日本、香港候选中的一条可用线路 |
| “🤖 Claude / Anthropic” | **Claude 专用 AWS** |

![Clash Verge：普通选择组、AWS 中转组和 Claude 专用组（当前界面实截）](../outputs/aws-proxy-guide/assets/clash-01-groups.png)

切换“🚀 AWS 中转”只改变去 AWS 的路径，最终出口仍是自己的 AWS IP。不要把日常选择组切到 AWS，也不要切“全局”模式。

**⑤ 在左侧“规则”页搜索 `claude.com`、`api4.ipify.org`。** 应看到指向 **🤖 Claude / Anthropic** 的规则。扩展脚本的结果在运行时生效，所以在原始订阅文本里搜不到，不代表没有配置。

**完成标志：** 新增两组可见，规则能搜到，Clash 没有脚本报错。第 6 步再测真实出口。

### 5.4 iPhone：Shadowrocket 使用相同链路

**① 先导入普通订阅。** 在订阅服务的手机页面复制 **Shadowrocket 订阅链接**，使用“一键导入 Shadowrocket”，或在 Shadowrocket 首页 **＋ → 类型 Subscribe / 订阅 → URL** 粘贴并保存。确认普通节点能连接。

**② 手动添加 AWS 节点。** Shadowrocket 首页点 **＋**，按表填写：

| 手机界面里的项目 | 填什么 |
| --- | --- |
| 类型 | **Shadowsocks** |
| 地址 | 自己的 `YOUR_STATIC_IP` |
| 端口 | `24443` |
| 密码 | 自己的 `YOUR_SS_KEY`，不要漏掉末尾 `=` |
| **算法** | **2022-blake3-aes-128-gcm**；这就是“加密方式” |
| 混淆、插件 | 都是 `none` |
| 一次性认证、UDP Over TCP | 关闭 |
| UDP 转发 | 开启 |
| 备注 | **AWS-US-Compatible**，后面的规则用这个名字 |

填好点 **保存**。如果用二维码导入，也要进节点详情核对密码和算法非空；本次曾遇到 SS2022 链接导入后这两项为空，导致 Safari 无法连接。

**③ 给 AWS 节点设置“代理通过”。**

1. 首页找到 **AWS-US-Compatible**，点右侧 **ⓘ**。
2. 点 **代理通过**，选择订阅里的可用中转节点，例如美国 Z02。
3. 返回并保存。这个中转节点本身不要再通过 AWS，避免形成循环。

此时链路为：**iPhone → 选中的中转节点 → AWS → 网站**。

**④ 添加七条分流规则。**

1. 底部 **配置** → 找到当前使用的配置。新安装可用内置 `default.conf`。
2. 先导出一份备份；若使用远程配置，先复制为本地配置，例如 `Claude-AWS.conf`，避免远程更新覆盖自己的修改。
3. 点配置的 **ⓘ → 规则 → ＋**，按下表逐条添加，策略选择节点 **AWS-US-Compatible**。
4. 把这七条放在已有普通分流规则之前，保留其他原有规则。

| 类型 | 内容 | 策略 |
| --- | --- | --- |
| DOMAIN-SUFFIX / 域名后缀 | `anthropic.com` | AWS-US-Compatible |
| DOMAIN-SUFFIX / 域名后缀 | `claude.ai` | AWS-US-Compatible |
| DOMAIN-SUFFIX / 域名后缀 | `claude.com` | AWS-US-Compatible |
| DOMAIN-SUFFIX / 域名后缀 | `claudeusercontent.com` | AWS-US-Compatible |
| DOMAIN-SUFFIX / 域名后缀 | `claude.app` | AWS-US-Compatible |
| DOMAIN-SUFFIX / 域名后缀 | `claudemcpcontent.com` | AWS-US-Compatible |
| DOMAIN / 域名 | `api4.ipify.org` | AWS-US-Compatible |

更习惯复制文本的话，点配置 → **编辑纯文本**，在已有 `[Rule]` 行的紧下方粘贴以下七行。**不要覆盖整份配置，也不要重复添加 `[Rule]`。** 两种方式选一种即可。

```ini
DOMAIN-SUFFIX,anthropic.com,AWS-US-Compatible
DOMAIN-SUFFIX,claude.ai,AWS-US-Compatible
DOMAIN-SUFFIX,claude.com,AWS-US-Compatible
DOMAIN-SUFFIX,claudeusercontent.com,AWS-US-Compatible
DOMAIN-SUFFIX,claude.app,AWS-US-Compatible
DOMAIN-SUFFIX,claudemcpcontent.com,AWS-US-Compatible
DOMAIN,api4.ipify.org,AWS-US-Compatible
```

如果已安装包含同样七条规则的 `Claude-AWS-Only` 模块，启用模块即可，不用重复添加；有其他模块时检查是否抢先匹配这些域名。模块优先于基础配置。菜单与规则说明可参考 [Shadowrocket 社区使用手册](https://github.com/LOWERTOP/Shadowrocket/wiki)。

**⑤ 启用配置并重连。**

- 在 **配置** 页点修改后的文件 → **使用配置**，确认出现选中标记。
- 首页的 **全局路由选“配置”**。
- 首页选择平时使用的普通节点，保持 AWS 节点中的“代理通过”设置。
- 打开顶部连接开关；首次按 iOS 提示允许添加 VPN 配置。已连接则关闭再打开。

**完成标志：** AWS 节点的密码和算法正确，“代理通过”已选中转节点，七条规则已启用，全局路由为“配置”。

> 扫码可以减少填写，但节点二维码通常只包含节点，不能自动完成中转关系和全部分流规则。分享给自己时可以用 AirDrop，或同一 Wi-Fi 内的临时配置页面；导入后仍核对上述三项。不要把含密码的二维码放进公开教程。

<a id="step-6"></a>
## 6. 打开 IP 检测网站，验证是否成功

### 6.1 电脑和手机分别测一次

1. 从 Lightsail 实例详情复制自己的 **Static IP address**。
2. Mac 保持 Clash **规则模式**，浏览器打开 **[https://api4.ipify.org](https://api4.ipify.org/)**。
3. iPhone 保持 Shadowrocket **全局路由＝配置**，Safari 打开同一个链接。
4. 两边显示的 IP 都应与第 1 步完全一致。
5. 再关闭 Mac 上的代理，单独用 iPhone 蜂窝网络重测一次；手机仍应显示 AWS IP。测完恢复 Mac 代理。

```text
Lightsail 静态 IP：  你自己的 IPv4
Mac 的检测结果：    与上面完全一致  ✓
iPhone 检测结果：   与上面完全一致  ✓
```

如果页面显示旧结果，刷新页面，或新建无痕标签页再打开。

### 6.2 确认 Claude 和其他网站各走各的

| 验证什么 | 怎么看 |
| --- | --- |
| Claude 的出口 | 打开 [Claude 网络信息](https://claude.ai/cdn-cgi/trace)，若页面提供该信息，`ip=` 应等于 AWS 静态 IP |
| 电脑命中规则 | Clash **连接** 页搜索 `claude.ai` 或 `api4.ipify.org`，看规则和链路是否经过 Claude 专用 AWS、中转节点 |
| 手机命中规则 | Shadowrocket **数据 → 代理** 开启日志，重新访问，再查看相应请求的节点和规则 |
| 普通网站 | 打开 GitHub、百度等，在客户端连接记录中确认仍按原规则使用普通节点或 DIRECT |
| 目标服务能否实际使用 | 登录自己的 Claude 账号并发送一条消息；使用 API / Claude Code 时发起一次自己有权限的请求 |

**不要只看“美国”二字，要核对具体 IP。** 订阅里的美国节点也是美国 IP，但不一定是自己的 AWS IP。其他 IP 检测域名没有加专用规则时，显示普通节点的 IP 是正常现象。

AWS 提供的是数据中心 IP。出口正确只说明网络配置成功，不能保证目标服务的账号、地区、付费权限或风控一定通过。

### 6.3 常见问题，从这一张表查

| 现象 | 优先检查 |
| --- | --- |
| 手机 Safari 提示“无法建立安全连接” | AWS 节点的密码、**算法**是否为空；24443 是否开放；中转节点是否可用。不需要安装 HTTPS 解密证书 |
| IP 检测显示订阅节点的 IP | 电脑是否是规则模式、手机是否是配置模式；七条规则是否启用且优先；手机的规则策略是否真的是 AWS-US-Compatible |
| 电脑可以，手机不行 | 手机不会自动继承电脑规则；核对节点、中转关系、配置三部分 |
| Claude 很慢，其他网页正常 | 在“🚀 AWS 中转”或手机“代理通过”换一条中转线路，再断开重连；先不用升级服务器套餐 |
| Clash 节点旁显示 446、168 等数字 | 那是延迟，单位 ms，不是下载速度。普通测速网站未加专用规则时，测到的也不一定是 AWS 链路 |
| 更新订阅后找不到中转节点 | 节点可能改名；重新复制完整名称到脚本，手机也重新选择“代理通过” |
| 返回 401 / 403 | 记录响应正文；401 常见于认证缺失，403 可能是权限或策略限制，不能只凭状态码判定代理坏了 |
| 浏览器可用，Claude Code 不行 | 终端可能未使用系统代理；按下面的可选设置测试 |

**可选：让 Mac 终端里的 Claude Code 使用 Clash。** 先到 Clash 设置核对混合 / HTTP 端口；若是 `7897`，在启动 Claude Code 的同一个终端执行：

```bash
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1
curl --proxy http://127.0.0.1:7897 --max-time 20 https://api4.ipify.org
```

确认返回 AWS IP 后，再在该终端启动 `claude`。端口不是 7897 就替换数字。这些变量只作用于当前终端及其子进程；Claude Code 官方支持 HTTP / HTTPS 代理，不用 SOCKS 格式的 `ALL_PROXY`。[Claude Code 网络配置](https://code.claude.com/docs/en/network-config)

Cursor 内调用模型还可能经过 Cursor 服务端，不能仅凭本地浏览器出口推断其模型请求的出口；需要结合具体错误排查。

### 6.4 用完以后，费用在哪里看

服务器上的 sing-box 会开机自动启动。电脑日常运行 Clash Verge，手机运行 Shadowrocket；不需要常驻 SSH 隧道。代理订阅和 AWS 套餐是两笔独立费用，中转转发也会消耗订阅流量。

付费计划下，如果完全不用了，需要删除不再需要的实例及额外资源，并释放不再使用的静态 IP，再检查账单。**Stop / 停止实例仍计费；未绑定实例的静态 IPv4 也可能单独收费。** 删除前自行保存需要的配置。[AWS 计费与静态 IP 说明](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)

最后核对：Mac 与 iPhone 的 `api4.ipify.org` 都显示自己的 AWS IP；Claude 请求命中专用规则；其他网站保持原分流。达到这三项，代理部分就搭好了。

### 常用链接：免费额度、剩余天数和流量

| 查看内容 | 链接与操作 |
| --- | --- |
| 免费额度、剩余天数 | [AWS Free Tier / 免费套餐](https://us-east-1.console.aws.amazon.com/costmanagement/home?region=us-east-1#/freetier)，查看自己的抵扣余额和到期日 |
| 本月费用 | [AWS 账单与成本控制台](https://us-east-1.console.aws.amazon.com/costmanagement/home#/home)，查看账单和实际收费 |
| 本月入站流量 | [personal-us-proxy 入站流量](https://ap-northeast-1.console.aws.amazon.com/lightsail/webapp/us-west-2/instances/personal-us-proxy/metrics/NetworkIn?timeRange=MTD) |
| 本月出站流量 | [personal-us-proxy 出站流量](https://ap-northeast-1.console.aws.amazon.com/lightsail/webapp/us-west-2/instances/personal-us-proxy/metrics/NetworkOut?timeRange=MTD) |
| 流量额度与超额费用 | [Lightsail 数据传输额度说明](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html) |

流量链接适用于 `us-west-2` 的 `personal-us-proxy`。如果名称或地区不同，从 [Lightsail 控制台](https://lightsail.aws.amazon.com/) 进入自己的实例 → **Metrics → Incoming / Outgoing network traffic → Current month**。

本月图中的单个点不一定是整月累计；入站和出站都消耗套餐额度，代理转发会同时产生两种流量。额度按月重置，免费计划剩余天数是另一回事，实际费用以账单为准。

相关主题：[梯子](梯子.md)。本文实截图片取自 2026-10-16 的界面；官方示例图已在对应位置标明来源与版本差异。公开分享前，不要把自己的密码、订阅链接、SSH 私钥或真实节点二维码填入本文。

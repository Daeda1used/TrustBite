# TrustBite 现场 Demo 步骤

## 启动

如果服务没有运行：

```powershell
cd "D:\UKFinnovator 2026 London\Code"
npm start
```

打开四个独立角色页面：

```text
Visitor:  http://127.0.0.1:4100/visitor
Expert:   http://127.0.0.1:4100/expert
Merchant: http://127.0.0.1:4100/merchant
Admin:    http://127.0.0.1:4100/admin
```

当前网络：

```text
XRPL Devnet: wss://s.devnet.rippletest.net:51233
Explorer: https://devnet.xrpl.org/transactions
```

## 推荐讲解顺序

### 1. Visitor 页面

展示普通顾客不需要钱包、不需要账号，直接通过网页搜索餐厅、查看地图、按专家评分排序。

重点讲：
- 普通用户不能打分，所以不会引入大众刷分。
- 所有公开 review 都来自已认证 expert。
- 顾客看到的是匿名化 expert review，不显示 reviewer 姓名。
- 每条 review 有链上 verified record，可打开 XRPL Explorer。

### 2. Admin 页面

先点击右上角 `Sign in with Admin Wallet`。这个过程会创建登录 challenge，用 Admin / Credential Issuer 钱包签名，并由后端验证 signer address 是否等于平台 admin 地址。

登录后展示平台如何建立可信参与方：
- `Demo infrastructure` 折叠区里可以查看 Devnet、钱包地址和余额。
- `Issue Credential` 区域可以直接输入一个线下面试通过的 XRPL 地址，并由 Admin issuer 发起 credential 上链。
- 如果输入的是 demo 内置 expert 钱包，系统会自动完成 `CredentialCreate` 和 `CredentialAccept`；如果是外部地址，Admin 只能发出 `CredentialCreate`，该地址需要用自己的钱包接受 credential。
- `Expert list` 只展示匿名 expert，不展示姓名；点击某个 expert 后，左侧才显示该 expert 的地址、credential、每日限制、reward 和 credential 交易。
- 右侧默认显示该 expert 的 `Pending review`，也可以按 All / Challenged / Published / Excluded 过滤。
- 选中 expert 后可以执行 `Suspend Credential` / `Reactivate Credential` / `Remove Credential`，每个动作都有 Yes/No 确认，并在附近显示可点击的链上交易链接。
- `Audit Log` 默认收起，需要时展开查看。
- Admin 可以 publish 或 exclude review；publish 后从 Review Reward Pool 支付 2 XRP。

重点讲：
- Admin 页面不是随便可访问的后台操作，必须通过 XRPL 地址签名登录。
- Credential 代表线下面试后，平台把“这个地址属于已认证 expert”的事实上链。
- 暂停/恢复 credential 是平台治理状态，会用 XRPL memo anchor 记录；移除 credential 会优先尝试 XRPL `CredentialDelete`，如果网络状态不允许则回退到 memo anchor，保证仍有链上证明。
- Review Reward Pool 和运营钱包分开，奖励资金隔离。
- Admin 只做审核和结算，不替商家删除差评。

### 3. Expert 页面

现场操作：
1. 右上角可以选择已认证 expert，也可以选择 `Not expert yet 01/02/03`。
2. 选择 `Not expert yet` 钱包登录时，只会显示该钱包地址和 `You are not expert yet`，不会出现 review 表单。
3. Admin 给这个地址 issue credential 后，刷新 Expert 页面，该地址会从候选钱包变成可登录的 expert。
4. 选择已认证 expert 后，点击 `Sign in with Selected Wallet`。
5. 系统自动完成：创建 login challenge、用 demo wallet 签名、后端验签、确认 signer 地址等于当前选择的钱包地址。
6. 已认证 expert 成功后右上角显示 `Wallet verified` 和钱包短地址，并解锁 review 表单。

讲解点：
- 这不是普通前端身份选择，而是地址签名登录。
- 登录本身不是 Devnet transaction，因为它只做身份验证，不改变链上状态。
- 后端用 `ripple-keypairs` 验证签名，并从签名公钥推导 XRPL 地址。
- 候选钱包登录只证明“我控制这个地址”，不会获得 review 权限。
- 提交 review 时必须同时满足：有效 expert session、地址已有 active credential、expert 状态 active；只传 `expertId` 会被拒绝。

提交 review：
1. 在地图上点击餐厅 pin，选定本次到访餐厅。
2. 分别填写 Food、Service、Hygiene、Consistency、Value 五个 1-5 分维度。
3. 填写 visit data，例如 visit type、party size、GBP per person、wait time、dishes sampled、revisit intent 和运营标签。
4. 点击 `Demo GPS Near Selected Restaurant` 或使用浏览器 GPS。
5. 点击 `Submit Expert Review to XRPL`。

提交后会生成：
- review content hash
- GPS evidence hash
- structured data hash
- XRPL review transaction
- review 状态进入 `Pending review`，等待 Admin publish，或商家在 challenge window 内提出 challenge。

### 4. Merchant 页面

右上角选择 `Merchant Wallet 01` 或 `Merchant Wallet 02` 登录。每个 merchant wallet 对应一家 verified restaurant；当前 demo 中每个账号下拉只有自己那一家餐厅，未来可以扩展为一个商家管理多个餐厅。

重点讲：
- Merchant 登录同样是 XRPL 地址签名验证，不是前端假登录。
- 登录后只能看到该地址名下的餐厅 dashboard。
- Dashboard 展示 trust score、维度拆解、rating trend、平均等待时间、人均消费、运营信号标签和 challenge windows。
- 商家不能回复、删除、改分。
- 商家不能指定 expert。
- 商家只能在 challenge window 内 challenge review。
- 最终由 Admin publish 或 exclude。
- 商家可以发布 review bounty：选择需要几位 expert、每位 expert 的 XRP reward、focus area 和说明。
- Bounty funding 是真实 XRPL Payment：从商家钱包支付到 TrustBite Merchant Bounty Pool，并在 memo 中记录 bounty 参数 hash。
- Admin 页面可以看到所有餐厅 bounty，并通过 random 或 manual assignment 分配 expert；分配动作也会写入 XRPL governance anchor transaction。

当前 demo 已创建两个 funded bounty，分别对应两家 verified restaurant，尚未 assignment，适合现场在 Admin 页面演示分配。

## 已经跑通的真实链上行为

### XRPL Credentials

Expert #01 CredentialCreate:

```text
E96BD5E82796F95232A9C2C5C916A2A1382DB6788BF5CE26760C1E59CFCDD406
```

Expert #01 CredentialAccept:

```text
28E89A497CE707D8D38FB765A6A429DAEF12D53AD06A8D9D63F2C04BD8E00B2A
```

### Review Hash + GPS Evidence Hash

Review tx:

```text
08FD8A33A6A329755ECB69622EDC081B7E0C7E126EE805619F01FE6310330989
```

GPS evidence hash:

```text
012ca7450b81c877e3766842ba622975eaeb3f160a1a89fbe71187ab69aff522
```

### Reward Payment

Reward tx:

```text
F6B4BB4736DEAE3578C02F4E124D43742183C0C946677A30301EB5DE00E7EDC0
```

### Merchant Bounty Funding

South Kensington Pasta House bounty funding tx:

```text
887543E2BDD48DBAF064BE227CD0FA611BDF5D8FA443CEAF91F943E3A8C65039
```

Queen's Gate Vegan Kitchen bounty funding tx:

```text
E965BA9C80CB8152FF034A242CF69C5BD09DE05EAFDED1AED63F0F82C9E04EFB
```

## 关键解释

GPS 不是由 XRPL 直接判断真假。流程是：
1. 浏览器或 demo GPS 产生位置 evidence。
2. 后端检查 GPS 是否在餐厅 100 米范围内。
3. 后端生成 GPS evidence hash。
4. GPS evidence hash、review content hash 和 structured data hash 写入 XRPL transaction memo。

XRPL 证明的是：
- 某个 evidence hash 在某个时间点已经被提交。
- 平台之后不能静默修改 evidence 或 review 内容。
- review、expert、restaurant 和 GPS evidence 可以被追溯绑定。

## 重置 Demo

在 Admin 页面登录后点击：

```text
Reset Reviews Only
```

这会清空 reviews、GPS evidence、challenge、reward records，但保留 wallets 和 credentials。

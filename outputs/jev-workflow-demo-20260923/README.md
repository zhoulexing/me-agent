# Jev 驱动的动态 Workflow 样例

这是 YBA Workflow 源码格式的最小样例：`workflow.mjs` 根据每轮新增的证据，请 Jev 从当前合法节点中选择下一步。节点结果由 `fixture.json` 提供，模拟未来的业务数据适配器。最多执行四轮；低置信度、证据不足、缺少节点结果都会停下来。

本机运行：

```bash
node demo.mjs
```

当前环境未提供 `TYPESAFE_API_KEY`，默认使用 `fixture.json` 中**人工编写的模拟 Jev 响应**，用于演示控制流；这不是 Jev 真实推理结果。取得 Key 并通过环境变量或密钥管理器注入 `TYPESAFE_API_KEY` 后，可以调用真实接口：

```bash
node demo.mjs --live
```

`workflow.mjs` 使用 YBA 现有的 `ctx.request` 形状，访问 `POST /v1/systemone` 时仅传 `credential_ref: "typesafe"`，不将密钥写进脚本或触发数据。YBA 宿主需要配置该 credential resolver；当前仓库中的 Workflow 主入口仍未接通。因此此目录是可运行的编排演示，不代表它现在可以在 YBA Pod 里直接启用。

运行轨迹预期为：检查结算漏斗 → 独立核验支付异常 → 结束。若 Jev 选了未提供的节点，Workflow 会报错停止；置信度低或证据不足时选 `finish` 会返回 `needs_review`；节点没有返回证据则返回 `blocked`。

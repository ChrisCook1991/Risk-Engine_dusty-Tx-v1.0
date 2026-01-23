
📋 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [数据格式](#数据格式)
- [风险检测逻辑](#风险检测逻辑)
- [技术架构](#技术架构)
- [配置说明](#配置说明)
- [开发说明](#开发说明)


✨ 功能特性

🎯 核心功能

- **多链支持**: 支持 EVM (Ethereum) 和 Tron 链的地址检测
- **智能地址匹配**: 基于前缀/后缀规则的地址相似性检测
- **小额交易识别**: 自动识别可疑的小额测试交易
- **逻辑回归决策**: 使用 Sigmoid 函数计算风险置信度
- **四级风险分类**: PASS / REMINDER / WARNING / BLOCK
- **实时可视化**: 完整的决策计算过程展示

🎨 用户体验

- **现代化 UI**: 采用深色主题和玻璃拟态设计
- **地址高亮显示**: 智能高亮匹配字符，快速识别风险模式
- **完整地址展示**: 不截断地址，支持一键复制
- **响应式设计**: 适配各种屏幕尺寸
- **实时参数调整**: 支持动态修改权重和阈值

🚀 快速开始

环境要求

- Python 3.x (用于本地服务器)
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

启动步骤

1. 克隆或下载项目**
   bash
   cd risk_engine_dusty\ tx

2. 启动本地服务器**
   bash
   python3 -m http.server 8080

3. 访问应用
   
   在浏览器中打开: `http://localhost:8080`

4. 上传数据文件
   - 上传交易数据 JSON 文件
   - 上传锚点地址库 JSON 文件
   - 查看分析结果

📖 使用指南

1. 准备数据文件

交易数据 (`transactions.json`)
包含待检测的交易列表，每笔交易需包含以下字段：

json
[
  {
    "counterparty_addr": "0xbb2f33f73cCC2c74E3fB9bb8EB75241AC65706E6",
    "token_amount": 0.00015,
    "caip2": "eip155:1",
    "nonce": 3
  }
]

锚点地址库 (`anchors.json`)
包含用户历史真实收款地址，用于相似度比对：

json
[
  {
    "anchor_to_addr": "0xbb2f33f73cCC2c74E3f457346775241AC15337E0",
    "caip2": "eip155:1"
  }
]

2. 上传数据

1. 点击 "交易数据" 卡片的"选择文件"按钮
2. 选择交易数据 JSON 文件
3. 点击 "锚点地址库" 卡片的"选择文件"按钮
4. 选择锚点地址 JSON 文件

3. 查看结果

系统会自动分析并显示：
- 风险等级 (PASS / REMINDER / WARNING / BLOCK)
- 置信度百分比
- 完整的交易和锚点地址信息（带智能高亮）
- Trait 1 (地址相似性) 检测结果
- Trait 2 (小额交易) 检测结果
- 完整的决策计算过程

4. 调整参数（可选）

在 "参数配置" 区域可以调整：    

权重参数:
- `bias`: 偏置项 (默认: -2)
- `w₁`: 地址相似度权重 (默认: 2)
- `w₂`: 交易数额权重 (默认: 1.5)
- `b₁₂`: 交互项系数 (默认: 1)

阈值参数:
- `T₀`: PASS ↔ REMINDER 阈值 (默认: 0.3)
- `T₁`: REMINDER ↔ WARNING 阈值 (默认: 0.5)
- `T₂`: WARNING ↔ BLOCK 阈值 (默认: 0.7)

---

📊 数据格式

交易数据字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `counterparty_addr` | string | ✅ | 对手方地址 |
| `token_amount` | number | ✅ | 交易金额 |
| `caip2` / `caip_2` | string | ✅ | 链标识符 (CAIP-2 格式) |
| `nonce` | number | ❌ | 交易序号（可选） |

锚点地址字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `anchor_to_addr` | string | ✅ | 参考地址 |
| `caip2` / `caip_2` | string | ✅ | 链标识符 (CAIP-2 格式) |

支持的链标识符

| CAIP-2 值 | 链名称 | 地址格式 |
|-----------|--------|----------|
| `eip155:1` | Ethereum Mainnet | 0x + 40 hex chars |
| `eip155:56` | BSC | 0x + 40 hex chars |
| `eip155:137` | Polygon | 0x + 40 hex chars |
| `tron:0x2b6653dc` | Tron Mainnet | T + 33 base58 chars |

---

🔍 风险检测逻辑

Trait 1: 地址相似性检测

系统会比较交易地址与锚点地址库中的地址，检测前缀和后缀匹配：

EVM 地址规则

| 规则 | 条件 | 匹配类型 | s₁ 值 |
|------|------|----------|-------|
| Rule C | 前缀 ≥ 5 且 后缀 ≥ 3 | `prefix+suffix` | 1 |
| Rule B | 前缀 ≥ 5 | `prefix` | 1 |
| Rule A | 后缀 ≥ 3 | `suffix` | 1 |

Tron 地址规则

| 规则 | 条件 | 匹配类型 | s₁ 值 |
|------|------|----------|-------|
| Rule F | 前缀 ≥ 4 且 后缀 ≥ 3 | `prefix+suffix` | 1 |
| Rule E | 前缀 ≥ 4 | `prefix` | 1 |
| Rule D | 后缀 ≥ 3 | `suffix` | 1 |

重要: 仅在相同链类型之间进行比对（EVM 与 EVM，Tron 与 Tron）

Trait 2: 小额交易检测

- 如果 `token_amount < 0.001`，则 `s₂ = 1`
- 否则 `s₂ = 0`

决策计算

使用逻辑回归模型计算风险置信度：

z_base = bias + (w₁ × s₁) + (w₂ × s₂)
z_interaction = b₁₂ × s₁ × s₂
z = z_base + z_interaction
confidence = 1 / (1 + e^(-z))

风险等级映射

| 置信度范围 | 等级 | 动作 | 颜色 |
|------------|------|------|------|
| `< T₀` (0.3) | L0 | PASS | 绿色 |
| `[T₀, T₁)` (0.3-0.5) | L1 | REMINDER | 蓝色 |
| `[T₁, T₂)` (0.5-0.7) | L2 | WARNING | 橙色 |
| `≥ T₂` (0.7) | L3 | BLOCK | 红色 |

---

🏗️ 技术架构

技术栈

- 前端: 纯 HTML5 + CSS3 + Vanilla JavaScript
- 样式: 自定义 CSS (深色主题 + 玻璃拟态)
- 字体: Inter, Mona Sans, JetBrains Mono, Minecraft
- 服务器: Python HTTP Server (开发环境)

文件结构

risk_engine_dusty tx/
├── index.html          # 主页面结构
├── styles.css          # 样式定义
├── app.js              # 核心逻辑
├── test-data/          # 测试数据
│   ├── user_tx.json    # 示例交易数据
│   └── user_anchors.json # 示例锚点地址
└── README.md           # 本文档

核心模块

app.js 主要功能

| 函数 | 功能 |
|------|------|
| `detectAddressType()` | 检测地址类型 (EVM/Tron) |
| `checkAddressSimilarity()` | 地址相似性检测 |
| `analyzeTransactions()` | 交易风险分析 |
| `calculateDecision()` | 决策计算 (Sigmoid) |
| `highlightAddressMatch()` | 地址高亮渲染 |
| `createResultCard()` | 结果卡片生成 |
| `renderResults()` | UI 渲染 |


⚙️ 配置说明

默认参数

javascript
// 权重参数
const DEFAULT_PARAMS = {
  bias: -2,      // 偏置项
  w1: 2.8,         // 地址相似度权重
  w2: 1.5,       // 交易数额权重
  b12: 2         // 交互项系数
};

// 阈值参数
const DEFAULT_THRESHOLDS = {
  t0: 0.2,       // PASS ↔ REMINDER
  t1: 0.6,       // REMINDER ↔ WARNING
  t2: 0.9       // WARNING ↔ BLOCK
}

自定义配置

所有参数都可以通过 UI 界面实时调整，修改后会立即重新计算所有结果。

---

🛠️ 开发说明

本地开发

1. 修改代码文件 (`index.html`, `styles.css`, `app.js`)
2. 刷新浏览器查看更改（建议使用硬刷新: `Cmd+Shift+R` / `Ctrl+Shift+F5`）

添加新的链支持

在 `app.js` 中修改 `getChainName()` 和 `detectAddressType()` 函数：

javascript
function getChainName(caip2) {
  const chainMap = {
    'eip155:1': 'Ethereum',
    'eip155:56': 'BSC',
    // 添加新链...
  };
  return chainMap[caip2] || caip2;
}

自定义地址匹配规则

在 `checkAddressSimilarity()` 函数中修改规则逻辑：

javascript
// EVM 规则示例
if (suffix >= 3 && prefix >= 5) {
  return { match: true, type: 'prefix+suffix', ... };
}


🎨 UI 特性

地址高亮系统

系统会根据匹配类型对地址字符进行颜色编码：

- 绿色加粗: 前缀匹配字符
- 橙色加粗: 后缀匹配字符  
- 红色加粗: 同时匹配前缀和后缀的字符
- 半透明灰: 未匹配字符

响应式设计

- 自适应布局，支持桌面和移动设备
- 卡片式设计，便于浏览和比较
- 平滑动画和过渡效果

---

📝 示例数据

项目包含示例数据文件，位于 `test-data/` 目录：

- `user_tx.json`: 包含多笔测试交易
- `user_anchors.json`: 包含参考锚点地址

可以直接使用这些文件测试系统功能。

---

🔒 安全说明

- 本系统为纯前端应用，所有数据处理在浏览器本地完成
- 不会上传任何数据到服务器
- 建议在内网环境中使用，避免敏感数据泄露

---

📄 许可证

MIT License

---

🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至项目维护者


风险决策分析系统 - 让风控决策更智能、更透明

Made with ❤️ by Risk Analysis Team


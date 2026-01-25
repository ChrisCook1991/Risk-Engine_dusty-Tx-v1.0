# 风险决策分析系统 (Risk Decision Analysis System)

基于机器学习的区块链交易风险检测系统，支持多特征检测和连续强度计算。

---

## 📋 目录

- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [数据格式](#-数据格式)
- [风险检测逻辑](#-风险检测逻辑)
- [技术架构](#-技术架构)
- [配置说明](#-配置说明)
- [开发说明](#-开发说明)

---

## ✨ 功能特性

### 🎯 核心功能

- **三重风险特征检测**:
  - **Trait 1**: 地址相似度（连续强度 + 3条子规则）
  - **Trait 2**: 小额交易识别
  - **Trait 3**: 时序接近度（指数衰减模型）
- **多链支持**: 支持 EVM (Ethereum) 和 Tron 链的地址检测
- **连续强度建模**: 使用 ramp_with_floor 函数计算各规则的连续强度
- **交互项建模**: 支持 3-way 交互效应 (S1×S2, S1×S3, S2×S3)
- **逻辑回归决策**: 使用 Sigmoid 函数计算风险置信度
- **三级风险分类**: PASS / WARNING / BLOCK
- **实时可视化**: 完整的决策计算过程展示

### 🎨 用户体验

- **现代化 UI**: 采用深色主题和玻璃拟态设计
- **地址高亮显示**: 智能高亮匹配字符，快速识别风险模式
- **完整地址展示**: 不截断地址，支持一键复制
- **响应式设计**: 适配各种屏幕尺寸
- **实时参数调整**: 支持动态修改权重和阈值

---

## 🚀 快速开始

### 环境要求

- Python 3.x (用于本地服务器)
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

### 启动步骤

1. **进入项目目录**
   ```bash
   cd risk_engine_dusty\ tx
   ```

2. **启动本地服务器**
   ```bash
   python3 -m http.server 8080
   ```

3. **访问应用**
   
   在浏览器中打开: `http://localhost:8080`

4. **上传数据文件**
   - 上传交易数据 JSON 文件
   - 上传锚点地址库 JSON 文件
   - 查看分析结果

---

## 📖 使用指南

### 1. 准备数据文件

#### 交易数据 (`transactions.json`)
包含待检测的交易列表，每笔交易需包含以下字段：

```json
[
  {
    "counterparty_addr": "0xbb2f33f73cCC2c74E3fB9bb8EB75241AC65706E6",
    "token_amount": 0.00015,
    "caip_2": "eip155:1",
    "blockTimestamp": "1769186566",
    "nonce": 3
  }
]
```

#### 锚点地址库 (`anchors.json`)
包含用户历史真实收款地址，用于相似度比对：

```json
[
  {
    "anchor_to_addr": "0xbb2f33f73cCC2c74E3f457346775241AC15337E0",
    "caip_2": "eip155:1",
    "blockTimestamp": "1769186506"
  }
]
```

### 2. 上传数据

1. 点击 "交易数据" 卡片的"选择文件"按钮
2. 选择交易数据 JSON 文件
3. 点击 "锚点地址库" 卡片的"选择文件"按钮
4. 选择锚点地址 JSON 文件

### 3. 查看结果

系统会自动分析并显示：
- 风险等级 (PASS / WARNING / BLOCK)
- 置信度百分比
- 完整的交易和锚点地址信息（带智能高亮）
- **Trait 1** (地址相似性) 检测结果
  - 主规则 (A/B/C)
  - 前缀/后缀匹配长度
  - 连续强度值 (s₁)
  - 子规则强度 (s_A, s_B, s_C)
- **Trait 2** (小额交易) 检测结果
- **Trait 3** (时序性) 检测结果
  - 时间差 (人类可读格式 + 秒数)
  - 时序强度 (s₃)
- 完整的决策计算过程 (z_base, z_interaction, confidence)

### 4. 调整参数（可选）

在 "参数配置" 区域可以调整：

**权重参数**:
- `bias`: 偏置项 (默认: -2.0)
- `w₁`: 地址相似度权重 (默认: 2.8)
- `w₂`: 交易数额权重 (默认: 1.5)
- `w₃`: 时序性权重 (默认: 0.8)
- `b₁₂`: 地址×金额 交互系数 (默认: 2.0)
- `b₁₃`: 地址×时序 交互系数 (默认: 0.3)
- `b₂₃`: 金额×时序 交互系数 (默认: 0.1)
- `s₀`: Trait 1 门槛强度地板 (默认: 0.65)
- `c_boost`: 规则 C 加成系数 (默认: 1.1)

**阈值参数**:
- `T₀`: PASS ↔ WARNING 阈值 (默认: 0.3)
- `T₁`: WARNING ↔ BLOCK 阈值 (默认: 0.65)

---

## 📊 数据格式

### 交易数据字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `counterparty_addr` | string | ✅ | 对手方地址 |
| `token_amount` | number | ✅ | 交易金额 |
| `caip_2` / `caip2` | string | ✅ | 链标识符 (CAIP-2 格式) |
| `blockTimestamp` | string | ❌ | 区块时间戳（Unix 秒，用于 Trait 3） |
| `nonce` | number | ❌ | 交易序号（可选） |

### 锚点地址字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `anchor_to_addr` | string | ✅ | 参考地址 |
| `caip_2` / `caip2` | string | ✅ | 链标识符 (CAIP-2 格式) |
| `blockTimestamp` | string | ❌ | 区块时间戳（Unix 秒，用于 Trait 3） |

### 支持的链标识符

| CAIP-2 值 | 链名称 | 地址格式 |
|-----------|--------|----------|
| `eip155:1` | Ethereum Mainnet | 0x + 40 hex chars |
| `eip155:56` | BSC | 0x + 40 hex chars |
| `eip155:137` | Polygon | 0x + 40 hex chars |
| `tron:0x2b6653dc` | Tron Mainnet | T + 33 base58 chars |

---

## 🔍 风险检测逻辑

### Trait 1: 地址相似性检测（连续强度模型）

系统会比较交易地址与锚点地址库中的地址，使用连续强度建模：

#### 🎯 EVM 地址规则

| 规则 | Boolean 条件 | 匹配类型 | 连续强度计算 |
|------|--------------|----------|--------------|
| **Rule A** | 后缀 ≥ 4 | `suffix` | `s_A = ramp_with_floor(suffix_len, 4, 10, s0)` |
| **Rule B** | 前缀 ≥ 6 | `prefix` | `s_B = ramp_with_floor(prefix_len, 6, 12, s0)` |
| **Rule C** | 后缀 ≥ 3 **且** 前缀 ≥ 5 | `prefix+suffix` | `s_C = clip(c_boost × max(s_C_suffix, s_C_prefix))` |

**规则 C 特殊公式**（max 聚合 + 10% 加成）：
```
s_C_suffix = ramp_with_floor(suffix_len, 3, 9, s0)
s_C_prefix = ramp_with_floor(prefix_len, 5, 11, s0)
s_C = clip_{0..1}(c_boost × max(s_C_suffix, s_C_prefix))
```
- `c_boost = 1.1` (10% 加成，奖励前后缀组合模式)
- 使用 **max** 强调较强的一侧（而非短板效应）

#### 🎯 Tron 地址规则

| 规则 | Boolean 条件 | 匹配类型 | 连续强度计算 |
|------|--------------|----------|--------------|
| **Rule A** | 后缀 ≥ 4 | `suffix` | `s_A = ramp_with_floor(suffix_len, 4, 10, s0)` |
| **Rule B** | 前缀 ≥ 4 | `prefix` | `s_B = ramp_with_floor(prefix_len, 4, 10, s0)` |
| **Rule C** | 后缀 ≥ 3 **且** 前缀 ≥ 3 | `prefix+suffix` | `s_C = clip(c_boost × max(s_C_suffix, s_C_prefix))` |

#### 📐 ramp_with_floor 函数

线性斜坡函数，带强度地板：

```javascript
function ramp_with_floor(len, L0, L1, s0) {
  if (len < L0) return 0;
  if (len >= L1) return 1;
  
  // len 在 [L0, L1) 区间内：
  r = (len - L0) / (L1 - L0);
  return s0 + (1 - s0) * r;  // 从 s0 线性增长到 1
}
```

**参数说明**：
- `len`: 匹配长度
- `L0`: 门槛长度（低于此强度为 0）
- `L1`: 饱和长度（达到此强度为 1）
- `s0`: 强度地板（门槛处的起始强度，默认 0.65）

#### 🔍 计算逻辑优化

**执行顺序**（性能优化）：
1. **Step 1**: 先检查 boolean 命中条件
2. **Step 2**: 只对命中的规则计算连续强度
3. 未命中的规则强度自动为 0

**最终强度**：
- `s1 = max(s_A, s_B, s_C)`（取最强规则的强度）
- 主规则优先级：C > A > B

**重要规则**：
- ✅ 仅在相同链类型之间进行比对（EVM 与 EVM，Tron 与 Tron）
- ✅ 前缀匹配包含 `0x` 或 `T` 前缀
- ✅ 地址完全相同不视为中毒攻击（返回 hit=false）

---

### Trait 2: 小额交易检测

- 如果 `token_amount < 0.001`，则 `s₂ = 1`
- 否则 `s₂ = 0`

---

### Trait 3: 时序接近度检测（指数衰减模型）

检测交易与锚点地址的时序关系，使用指数衰减建模：

#### ⏰ 时序强度计算

```javascript
Δt = tx.blockTimestamp - anchor.blockTimestamp  // 以秒为单位

// 方向约束：只考虑在锚点之后的交易
if (Δt <= 0) {
    s3 = 0  // 交易在锚点之前，无时序关联
}
// 紧密跟随
else if (Δt <= t_min) {  // t_min = 120秒（2分钟）
    s3 = 1  // 最大可疑度
}
// 指数衰减区间
else if (Δt < t_max) {  // t_max = 21600秒（6小时）
    r = (Δt - t_min) / (t_max - t_min)
    s3 = exp(-k × r)  // k = 3（衰减率）
}
// 时间过远
else {
    s3 = 0  // 无时序关联
}
```

#### 📊 时序强度示例

| 时间差 (Δt) | 强度 (s₃) | 状态 |
|-------------|-----------|------|
| ≤ 0秒 | 0 | ❌ 无关联（之前） |
| 60秒 (1分钟) | 1.000 | ✓ 紧密跟随 |
| 617秒 (~10分钟) | ~0.920 | ⚠ 时序关联 |
| 3600秒 (1小时) | ~0.615 | ⚠ 时序关联 |
| 21600秒 (6小时) | 0 | ❌ 无关联（之后） |

**配置参数**：
- `t_min = 120` 秒（2分钟）: 紧密跟随阈值
- `t_max = 21600` 秒（6小时）: 最大关联时间窗口
- `k = 3`: 指数衰减率

---

### 🧮 决策计算

使用逻辑回归模型 + 交互项：

```
z_base = bias + w₁×s₁ + w₂×s₂ + w₃×s₃
z_interaction = b₁₂×s₁×s₂ + b₁₃×s₁×s₃ + b₂₃×s₂×s₃
z = z_base + z_interaction
confidence = 1 / (1 + e^(-z))
```

**参数说明**：
- `bias`: 偏置项，控制基准风险
- `w₁, w₂, w₃`: 各特征的线性权重
- `b₁₂, b₁₃, b₂₃`: 交互项系数，捕捉特征组合效应
- `s₁, s₂, s₃`: 各特征的强度值 [0, 1]

### 🎯 风险等级映射

| 置信度范围 | 等级 | 动作 | 颜色 |
|------------|------|------|------|
| `< T₀` (0.3) | L0 | PASS | 绿色 |
| `[T₀, T₁)` (0.3-0.65) | L2 | WARNING | 橙色 |
| `≥ T₁` (0.65) | L3 | BLOCK | 红色 |

---

### 🔗 独立特征检测

**重要设计原则**：

✅ **Trait 1, 2, 3 可以独立触发**
- 交易会出现在结果中，如果满足：`s₁ > 0` **OR** `s₂ = 1` **OR** `s₃ > 0`
- 即使 Trait 1 未命中，Trait 3 仍会检查所有锚点
- 选择最强的 Trait 3 匹配（如果 Trait 1 未命中）

**锚点优先级**：
1. 如果 Trait 1 命中：使用该锚点，同时计算 Trait 3
2. 如果 Trait 1 未命中：遍历所有锚点寻找最强的 Trait 3 匹配

---

## 🏗️ 技术架构

### 技术栈

- **前端**: 纯 HTML5 + CSS3 + Vanilla JavaScript
- **样式**: 自定义 CSS (深色主题 + 玻璃拟态)
- **字体**: Inter, JetBrains Mono
- **服务器**: Python HTTP Server (开发环境)

### 文件结构

```
risk_engine_dusty tx/
├── index.html          # 主页面结构
├── styles.css          # 样式定义
├── app.js              # 核心逻辑
├── test-data/          # 测试数据
│   ├── user_tx.json    # 示例交易数据
│   └── user_anchors.json # 示例锚点地址
└── README.md           # 本文档
```

### 核心模块

#### app.js 主要功能

| 函数 | 功能 |
|------|------|
| `detectAddressType()` | 检测地址类型 (EVM/Tron) |
| `getPrefixMatchLength()` | 计算前缀匹配长度 |
| `getSuffixMatchLength()` | 计算后缀匹配长度 |
| `ramp_with_floor()` | 线性斜坡强度函数 |
| `checkAddressSimilarity()` | 地址相似性检测（Trait 1） |
| `checkSmallAmount()` | 小额交易检测（Trait 2） |
| `calculateTemporalProximity()` | 时序接近度检测（Trait 3） |
| `calculateDecision()` | 逻辑回归决策计算 |
| `analyzeTransactions()` | 交易风险分析主引擎 |
| `highlightAddressMatch()` | 地址高亮渲染 |
| `createResultCard()` | 结果卡片生成 |
| `renderResults()` | UI 渲染 |

---

## ⚙️ 配置说明

### 默认参数

```javascript
const config = {
  // 决策权重
  bias: -2.0,
  w1: 2.8,    // 地址相似度
  w2: 1.5,    // 交易数额
  w3: 0.8,    // 时序性
  
  // 交互项系数
  b12: 2.0,   // 地址 × 金额
  b13: 0.3,   // 地址 × 时序
  b23: 0.1,   // 金额 × 时序
  
  // 阈值
  t0: 0.3,    // PASS ↔ WARNING
  t1: 0.65,   // WARNING ↔ BLOCK
  
  // Trait 1 参数
  s0: 0.65,   // 强度地板
  c_boost: 1.1,  // 规则C加成
  
  // Trait 3 参数
  t_min: 120,    // 2分钟
  t_max: 21600,  // 6小时
  k: 3,       // 衰减率
  
  // Trait 2 参数
  small_amount_threshold: 0.001
};
```

### 自定义配置

所有参数都可以通过 UI 界面实时调整，修改后会立即重新计算所有结果。

---

## 🛠️ 开发说明

### 本地开发

1. 修改代码文件 (`index.html`, `styles.css`, `app.js`)
2. 刷新浏览器查看更改（建议使用硬刷新: `Cmd+Shift+R` / `Ctrl+Shift+F5`）

### 添加新的链支持

在 `app.js` 中修改 `getChainName()` 和 `detectAddressType()` 函数：

```javascript
function getChainName(caip2) {
  const chainMap = {
    'eip155:1': 'Ethereum',
    'eip155:56': 'BSC',
    // 添加新链...
  };
  return chainMap[caip2] || caip2;
}
```

### 自定义地址匹配规则

在 `checkAddressSimilarity()` 函数中修改规则逻辑和参数配置。

---

## 🎨 UI 特性

### 地址高亮系统

系统会根据匹配类型对地址字符进行颜色编码：

- **绿色加粗**: 前缀匹配字符
- **橙色加粗**: 后缀匹配字符  
- **红色加粗**: 同时匹配前缀和后缀的字符
- **半透明灰**: 未匹配字符

### 响应式设计

- 自适应布局，支持桌面和移动设备
- 卡片式设计，便于浏览和比较
- 平滑动画和过渡效果

---

## 📝 示例数据

项目包含示例数据文件，位于 `test-data/` 目录：

- `user_tx.json`: 包含多笔测试交易（含时间戳）
- `user_anchors.json`: 包含参考锚点地址（含时间戳）

可以直接使用这些文件测试系统功能。

---

## 🔒 安全说明

- 本系统为纯前端应用，所有数据处理在浏览器本地完成
- 不会上传任何数据到服务器
- 建议在内网环境中使用，避免敏感数据泄露

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至项目维护者

---

**风险决策分析系统 - 让风控决策更智能、更透明**

Made with ❤️ by Risk Analysis Team

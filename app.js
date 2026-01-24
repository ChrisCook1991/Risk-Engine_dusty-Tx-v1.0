/**
 * 风险决策分析系统 - 核心逻辑
 */

// ========================================
// Global State
// ========================================
let transactions = [];
let anchors = [];
let config = {
    bias: -2,
    w1: 2,
    w2: 1.5,
    b12: 1,
    t0: 0.3,
    t1: 0.5,
    t2: 0.7,
    // Trait 1 Continuous Strength Parameters
    s0: 0.65,  // Threshold strength floor
    // EVM Rules
    evm_L0_suffix_A: 4,
    evm_L1_suffix_A: 10,
    evm_L0_prefix_B: 6,
    evm_L1_prefix_B: 12,
    evm_L0_suffix_C: 3,
    evm_L1_suffix_C: 9,
    evm_L0_prefix_C: 5,
    evm_L1_prefix_C: 11,
    // Tron Rules
    tron_L0_suffix_A: 4,
    tron_L1_suffix_A: 10,
    tron_L0_prefix_B: 4,
    tron_L1_prefix_B: 10,
    tron_L0_suffix_C: 3,
    tron_L1_suffix_C: 9,
    tron_L0_prefix_C: 3,
    tron_L1_prefix_C: 9
};

// ========================================
// DOM Elements
// ========================================
const transactionsFile = document.getElementById('transactions-file');
const anchorsFile = document.getElementById('anchors-file');
const transactionsStatus = document.getElementById('transactions-status');
const anchorsStatus = document.getElementById('anchors-status');
const transactionsUpload = document.getElementById('transactions-upload');
const anchorsUpload = document.getElementById('anchors-upload');
const clearTransactionsBtn = document.getElementById('clear-transactions');
const clearAnchorsBtn = document.getElementById('clear-anchors');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const resultsContainer = document.getElementById('results-container');
const resultsCount = document.getElementById('results-count');

// Config inputs
const configInputs = {
    bias: document.getElementById('bias'),
    w1: document.getElementById('w1'),
    w2: document.getElementById('w2'),
    b12: document.getElementById('b12'),
    t0: document.getElementById('t0'),
    t1: document.getElementById('t1'),
    t2: document.getElementById('t2')
};

// ========================================
// Utility Functions for Continuous Strength
// ========================================

/**
 * Clip value to [0, 1] range
 * @param {number} x - Value to clip
 * @returns {number} Clipped value
 */
function clip_0_1(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}

/**
 * Ramp function with floor threshold
 * Returns 0 if x < L0, s0 at L0, linearly increases to 1 at L1
 * @param {number} x - Input value (match length)
 * @param {number} L0 - Threshold length (minimum to trigger)
 * @param {number} L1 - Saturation length (maximum, returns 1)
 * @param {number} s0 - Floor strength at threshold
 * @returns {number} Strength value [0, 1]
 */
function ramp_with_floor(x, L0, L1, s0) {
    if (x < L0) return 0;
    if (x >= L1) return 1;
    // Linear interpolation from s0 to 1
    return s0 + (1 - s0) * (x - L0) / (L1 - L0);
}

// ========================================
// Address Matching Algorithms
// ========================================

/**
 * Detect address type
 * @param {string} addr - Address to check
 * @returns {'evm' | 'tron' | 'unknown'}
 */
function detectAddressType(addr) {
    if (!addr || typeof addr !== 'string') return 'unknown';
    if (addr.startsWith('0x') && addr.length === 42) return 'evm';
    if (addr.startsWith('T') && addr.length === 34) return 'tron';
    return 'unknown';
}

/**
 * Get prefix match length between two addresses
 * @param {string} addr1 
 * @param {string} addr2 
 * @returns {number}
 */
function getPrefixMatchLength(addr1, addr2) {
    let count = 0;
    const minLen = Math.min(addr1.length, addr2.length);
    for (let i = 0; i < minLen; i++) {
        if (addr1[i].toLowerCase() === addr2[i].toLowerCase()) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

/**
 * Get suffix match length between two addresses
 * @param {string} addr1 
 * @param {string} addr2 
 * @returns {number}
 */
function getSuffixMatchLength(addr1, addr2) {
    let count = 0;
    const len1 = addr1.length;
    const len2 = addr2.length;
    const minLen = Math.min(len1, len2);
    for (let i = 0; i < minLen; i++) {
        if (addr1[len1 - 1 - i].toLowerCase() === addr2[len2 - 1 - i].toLowerCase()) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

/**
 * Check address similarity (Trait 1) with continuous strength
 * @param {string} counterpartyAddr - Current transaction address
 * @param {string} anchorAddr - Known anchor address
 * @returns {{hit: boolean, strength: number, evidence: object | null}}
 */
function checkAddressSimilarity(counterpartyAddr, anchorAddr) {
    // If addresses are identical, not considered similarity poisoning
    if (counterpartyAddr.toLowerCase() === anchorAddr.toLowerCase()) {
        return { hit: false, strength: 0, evidence: null };
    }

    const addrType = detectAddressType(counterpartyAddr);
    const anchorType = detectAddressType(anchorAddr);

    // Only compare same type addresses
    if (addrType !== anchorType || addrType === 'unknown') {
        return { hit: false, strength: 0, evidence: null };
    }

    const prefixLen = getPrefixMatchLength(counterpartyAddr, anchorAddr);
    const suffixLen = getSuffixMatchLength(counterpartyAddr, anchorAddr);

    const s0 = config.s0;
    let hit = false;
    let strength = 0;
    let primaryRule = '';
    let matchType = '';

    // Sub-rule strengths
    let s_A = 0;
    let s_B = 0;
    let s_C = 0;

    if (addrType === 'evm') {
        // EVM Rules
        // Rule A: suffix >= 4
        s_A = ramp_with_floor(suffixLen, config.evm_L0_suffix_A, config.evm_L1_suffix_A, s0);

        // Rule B: prefix >= 6
        s_B = ramp_with_floor(prefixLen, config.evm_L0_prefix_B, config.evm_L1_prefix_B, s0);

        // Rule C: suffix >= 3 AND prefix >= 5 (short-board effect)
        const s_C_suffix = ramp_with_floor(suffixLen, config.evm_L0_suffix_C, config.evm_L1_suffix_C, s0);
        const s_C_prefix = ramp_with_floor(prefixLen, config.evm_L0_prefix_C, config.evm_L1_prefix_C, s0);
        s_C = Math.min(s_C_suffix, s_C_prefix); // Short-board: both must be strong

        // Boolean hit: any rule meets its threshold
        const rule_A_hit = suffixLen >= config.evm_L0_suffix_A;
        const rule_B_hit = prefixLen >= config.evm_L0_prefix_B;
        const rule_C_hit = suffixLen >= config.evm_L0_suffix_C && prefixLen >= config.evm_L0_prefix_C;

        hit = rule_A_hit || rule_B_hit || rule_C_hit;

        if (hit) {
            // Final strength = max of all sub-strengths
            strength = Math.max(s_A, s_B, s_C);

            // Determine primary rule (priority: C > A > B)
            if (s_C === strength && rule_C_hit) {
                primaryRule = 'C';
                matchType = 'prefix+suffix';
            } else if (s_A === strength && rule_A_hit) {
                primaryRule = 'A';
                matchType = 'suffix';
            } else {
                primaryRule = 'B';
                matchType = 'prefix';
            }
        }

    } else if (addrType === 'tron') {
        // Tron Rules
        // Rule A: suffix >= 4
        s_A = ramp_with_floor(suffixLen, config.tron_L0_suffix_A, config.tron_L1_suffix_A, s0);

        // Rule B: prefix >= 4
        s_B = ramp_with_floor(prefixLen, config.tron_L0_prefix_B, config.tron_L1_prefix_B, s0);

        // Rule C: suffix >= 3 AND prefix >= 3 (short-board effect)
        const s_C_suffix = ramp_with_floor(suffixLen, config.tron_L0_suffix_C, config.tron_L1_suffix_C, s0);
        const s_C_prefix = ramp_with_floor(prefixLen, config.tron_L0_prefix_C, config.tron_L1_prefix_C, s0);
        s_C = Math.min(s_C_suffix, s_C_prefix); // Short-board: both must be strong

        // Boolean hit: any rule meets its threshold
        const rule_A_hit = suffixLen >= config.tron_L0_suffix_A;
        const rule_B_hit = prefixLen >= config.tron_L0_prefix_B;
        const rule_C_hit = suffixLen >= config.tron_L0_suffix_C && prefixLen >= config.tron_L0_prefix_C;

        hit = rule_A_hit || rule_B_hit || rule_C_hit;

        if (hit) {
            // Final strength = max of all sub-strengths
            strength = Math.max(s_A, s_B, s_C);

            // Determine primary rule (priority: C > A > B for Tron)
            if (s_C === strength && rule_C_hit) {
                primaryRule = 'C';
                matchType = 'prefix+suffix';
            } else if (s_A === strength && rule_A_hit) {
                primaryRule = 'A';
                matchType = 'suffix';
            } else {
                primaryRule = 'B';
                matchType = 'prefix';
            }
        }
    }

    if (hit) {
        return {
            hit: true,
            strength: clip_0_1(strength), // Ensure [0, 1] range
            evidence: {
                match_type: matchType,
                primary_rule: primaryRule,
                ref_addr: anchorAddr,
                suspect_addr: counterpartyAddr,
                addr_type: addrType,
                prefix_len: prefixLen,
                suffix_len: suffixLen,
                // Sub-strengths for transparency
                strength_A: s_A,
                strength_B: s_B,
                strength_C: s_C,
                // Overall strength
                strength: clip_0_1(strength)
            }
        };
    }

    return { hit: false, strength: 0, evidence: null };
}

/**
 * Check small amount (Trait 2)
 * @param {number} tokenAmount 
 * @param {number} threshold 
 * @returns {{hit: boolean, evidence: object | null}}
 */
function checkSmallAmount(tokenAmount, threshold = 0.001) {
    const amount = parseFloat(tokenAmount);
    const hit = amount <= threshold;

    if (hit) {
        return {
            hit: true,
            evidence: {
                token_amount: amount,
                threshold: threshold
            }
        };
    }

    return { hit: false, evidence: null };
}

// ========================================
// Chain Name Mapping
// ========================================

/**
 * Get chain name from caip2 identifier
 * @param {string} caip2 - Chain identifier
 * @returns {string}
 */
function getChainName(caip2) {
    if (!caip2) return 'N/A';
    if (caip2 === 'eip155:1') return 'ETH主网';
    if (caip2.startsWith('eip155:')) return `EVM链 (${caip2})`;
    if (caip2 === 'tron:0x294270c5' || caip2 === 'tron:mainnet') return 'Tron链';
    if (caip2.startsWith('tron:')) return `Tron链 (${caip2})`;
    return caip2;
}

/**
 * Get chain type from caip2 for comparison
 * @param {string} caip2 - Chain identifier
 * @returns {'evm' | 'tron' | 'unknown'}
 */
function getChainType(caip2) {
    if (!caip2) return 'unknown';
    if (caip2.startsWith('eip155:')) return 'evm';
    if (caip2.startsWith('tron:')) return 'tron';
    return 'unknown';
}

// ========================================
// Decision Calculation
// ========================================

/**
 * Calculate decision based on traits and config
 * @param {number} s1 - Trait 1 strength [0, 1] (continuous)
 * @param {number} s2 - Trait 2 score (0 or 1)
 * @param {object} cfg - Configuration parameters
 * @returns {object}
 */
function calculateDecision(s1, s2, cfg) {
    // z_base = bias + (w1 × s1) + (w2 × s2)
    const zBase = cfg.bias + (cfg.w1 * s1) + (cfg.w2 * s2);

    // z_interaction = b12 × s1 × s2
    const zInteraction = cfg.b12 * s1 * s2;

    // z = z_base + z_interaction
    const z = zBase + zInteraction;

    // confidence = 1 / (1 + e^(-z))
    const confidence = 1 / (1 + Math.exp(-z));

    // Level mapping
    let level, action;
    if (confidence < cfg.t0) {
        level = 'L0';
        action = 'PASS';
    } else if (confidence < cfg.t1) {
        level = 'L1';
        action = 'REMINDER';
    } else if (confidence < cfg.t2) {
        level = 'L2';
        action = 'WARNING';
    } else {
        level = 'L3';
        action = 'BLOCK';
    }

    return {
        zBase,
        zInteraction,
        z,
        confidence,
        level,
        action
    };
}

// ========================================
// Analysis Engine
// ========================================

/**
 * Analyze all transactions against all anchors
 * Once a transaction hits Trait 1 with any anchor, stop checking other anchors
 * @returns {Array}
 */
function analyzeTransactions() {
    const results = [];

    for (const tx of transactions) {
        // Check Trait 2 once per transaction (amount-based, independent of anchor)
        const trait2Result = checkSmallAmount(tx.token_amount);
        const s2 = trait2Result.hit ? 1 : 0;

        // Track if this transaction has already matched Trait 1
        let trait1Matched = false;
        let matchedAnchor = null;
        let matchedTrait1Evidence = null;
        let s1 = 0; // Continuous strength [0, 1]

        // Get transaction chain type for same-chain comparison
        const txChainType = getChainType(tx.caip2);

        for (const anchor of anchors) {
            // Only compare addresses on the same chain
            const anchorChainType = getChainType(anchor.caip2);
            if (txChainType !== anchorChainType || txChainType === 'unknown') {
                continue;
            }

            // Check Trait 1 (address similarity)
            const trait1Result = checkAddressSimilarity(
                tx.counterparty_addr,
                anchor.anchor_to_addr
            );

            if (trait1Result.hit) {
                // Found a match - record it and stop checking other anchors
                trait1Matched = true;
                matchedAnchor = anchor;
                matchedTrait1Evidence = trait1Result.evidence;
                s1 = trait1Result.strength; // Use continuous strength
                break; // Stop checking other anchors for this transaction
            }
        }

        // Only include if at least one trait is hit
        if (trait1Matched || s2 === 1) {
            const decision = calculateDecision(s1, s2, config);

            results.push({
                transaction: tx,
                anchor: matchedAnchor, // May be null if only Trait 2 hit
                s1,
                s2,
                trait1Evidence: matchedTrait1Evidence,
                trait2Evidence: trait2Result.evidence,
                decision
            });
        }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.decision.confidence - a.decision.confidence);

    return results;
}

// ========================================
// UI Rendering
// ========================================

/**
 * Render analysis results
 */
function renderResults() {
    const results = analyzeTransactions();

    // Clear previous results
    resultsContainer.innerHTML = '';

    // Update state visibility
    if (transactions.length === 0 || anchors.length === 0) {
        emptyState.hidden = false;
        noResultsState.hidden = true;
        resultsCount.textContent = '';
        return;
    }

    emptyState.hidden = true;

    if (results.length === 0) {
        noResultsState.hidden = false;
        resultsCount.textContent = '';
        return;
    }

    noResultsState.hidden = true;
    resultsCount.textContent = `${results.length} 条风险`;

    // Render each result card
    results.forEach((result, index) => {
        const card = createResultCard(result, index + 1);
        resultsContainer.appendChild(card);
    });
}

/**
 * Create a result card element
 * @param {object} result 
 * @param {number} index 
 * @returns {HTMLElement}
 */
function createResultCard(result, index) {
    const { transaction, anchor, s1, s2, trait1Evidence, trait2Evidence, decision } = result;

    const card = document.createElement('div');
    card.className = `result-card level-${decision.action.toLowerCase()}`;

    const confidencePercent = (decision.confidence * 100).toFixed(1);

    card.innerHTML = `
        <div class="card-header">
            <div class="card-header-left">
                <span class="action-badge ${decision.action.toLowerCase()}">${decision.action}</span>
                <span class="level-tag">${decision.level}</span>
            </div>
            <div class="card-header-right">
                <div class="confidence-display">
                    <div class="confidence-label">置信度</div>
                    <div class="confidence-value">${confidencePercent}%</div>
                </div>
                <div class="card-index">#${index}</div>
            </div>
        </div>
        <div class="card-body">
            <div class="info-grid">
                <div class="info-box">
                    <h4>交易信息</h4>
                    <div class="info-item">
                        <span class="info-label">对手方地址</span>
                        <span class="info-value addr-display copyable" title="点击复制" onclick="copyToClipboard('${transaction.counterparty_addr}')">${highlightAddressMatch(transaction.counterparty_addr, trait1Evidence?.ref_addr, trait1Evidence?.prefix_len || 0, trait1Evidence?.suffix_len || 0)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">交易金额</span>
                        <span class="info-value">${transaction.token_amount}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">链</span>
                        <span class="info-value">${getChainName(transaction.caip2)}</span>
                    </div>
                    ${transaction.nonce !== undefined ? `
                    <div class="info-item">
                        <span class="info-label">Nonce</span>
                        <span class="info-value">${transaction.nonce}</span>
                    </div>
                    ` : ''}
                </div>
                ${anchor ? `
                <div class="info-box">
                    <h4>锚点地址库</h4>
                    <div class="info-item">
                        <span class="info-label">参考地址</span>
                        <span class="info-value addr-display copyable" title="点击复制" onclick="copyToClipboard('${anchor.anchor_to_addr}')">${highlightAddressMatch(anchor.anchor_to_addr, transaction.counterparty_addr, trait1Evidence?.prefix_len || 0, trait1Evidence?.suffix_len || 0)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">链</span>
                        <span class="info-value">${getChainName(anchor.caip2)}</span>
                    </div>
                </div>
                ` : `
                <div class="info-box">
                    <h4>锚点地址库</h4>
                    <div class="info-item">
                        <span class="info-label">状态</span>
                        <span class="info-value">未匹配锚点地址</span>
                    </div>
                </div>
                `}
            </div>
            
            <div class="traits-grid">
                ${createTrait1Card(s1, trait1Evidence)}
                ${createTrait2Card(s2, trait2Evidence)}
            </div>
            
            <div class="calculation-section">
                <div class="calculation-title">决策计算过程</div>
                <div class="calculation-steps">
                    <div class="calc-step">
                        <span class="formula">z_base = bias + (w₁ × s₁) + (w₂ × s₂)</span> = 
                        <span class="result">${decision.zBase.toFixed(4)}</span>
                    </div>
                    <div class="calc-step">
                        <span class="formula">z_interaction = b₁₂ × s₁ × s₂</span> = 
                        <span class="result">${decision.zInteraction.toFixed(4)}</span>
                    </div>
                    <div class="calc-step">
                        <span class="formula">z = z_base + z_interaction</span> = 
                        <span class="result">${decision.z.toFixed(4)}</span>
                    </div>
                    <div class="calc-step">
                        <span class="formula">confidence = 1 / (1 + e^(-z))</span> = 
                        <span class="result">${decision.confidence.toFixed(4)}</span>
                    </div>
                    <div class="calc-step">
                        <span class="formula">等级映射</span>: confidence ${decision.confidence.toFixed(2)} 
                        ${decision.level === 'L0' ? '< T₀' : decision.level === 'L1' ? '∈ [T₀, T₁)' : decision.level === 'L2' ? '∈ [T₁, T₂)' : '≥ T₂'}
                        → <span class="result">${decision.level} (${decision.action})</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    return card;
}

/**
 * Create Trait 1 card HTML
 */
function createTrait1Card(s1, evidence) {
    const hitClass = s1 > 0 ? 'trait1 hit' : 'miss';
    const strengthPercent = (s1 * 100).toFixed(1);

    if (s1 > 0 && evidence) {
        // Build sub-strengths display
        let subStrengthsHTML = '';
        if (evidence.addr_type === 'evm') {
            subStrengthsHTML = `
                <div class="trait-evidence-item">
                    <span class="trait-evidence-label">规则 A 强度</span>
                    <span class="trait-evidence-value">${(evidence.strength_A * 100).toFixed(1)}%</span>
                </div>
                <div class="trait-evidence-item">
                    <span class="trait-evidence-label">规则 B 强度</span>
                    <span class="trait-evidence-value">${(evidence.strength_B * 100).toFixed(1)}%</span>
                </div>
                <div class="trait-evidence-item">
                    <span class="trait-evidence-label">规则 C 强度</span>
                    <span class="trait-evidence-value">${(evidence.strength_C * 100).toFixed(1)}%</span>
                </div>
            `;
        } else {
            subStrengthsHTML = `
                <div class="trait-evidence-item">
                    <span class="trait-evidence-label">规则 A 强度</span>
                    <span class="trait-evidence-value">${(evidence.strength_A * 100).toFixed(1)}%</span>
                </div>
                <div class="trait-evidence-item">
                    <span class="trait-evidence-label">规则 B 强度</span>
                    <span class="trait-evidence-value">${(evidence.strength_B * 100).toFixed(1)}%</span>
                </div>
            `;
        }

        return `
            <div class="trait-card ${hitClass}">
                <div class="trait-header">
                    <span class="trait-title">Trait 1: 地址相似度</span>
                    <span class="trait-score">s₁ = ${s1.toFixed(3)}</span>
                </div>
                <div class="trait-evidence">
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">强度</span>
                        <span class="trait-evidence-value strength-highlight">${strengthPercent}%</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">主规则</span>
                        <span class="trait-evidence-value">规则 ${evidence.primary_rule}</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">地址类型</span>
                        <span class="trait-evidence-value">${evidence.addr_type.toUpperCase()}</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">匹配类型</span>
                        <span class="trait-evidence-value">${evidence.match_type}</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">前缀匹配</span>
                        <span class="trait-evidence-value">${evidence.prefix_len} 字符</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">后缀匹配</span>
                        <span class="trait-evidence-value">${evidence.suffix_len} 字符</span>
                    </div>
                    ${subStrengthsHTML}
                </div>
            </div>
        `;
    }

    return `
        <div class="trait-card ${hitClass}">
            <div class="trait-header">
                <span class="trait-title">Trait 1: 地址相似度</span>
                <span class="trait-score">s₁ = ${s1.toFixed(3)}</span>
            </div>
            <div class="trait-evidence">
                <span class="trait-miss-text">未命中</span>
            </div>
        </div>
    `;
}

/**
 * Create Trait 2 card HTML
 */
function createTrait2Card(s2, evidence) {
    const hitClass = s2 === 1 ? 'trait2 hit' : 'miss';

    if (s2 === 1 && evidence) {
        return `
            <div class="trait-card ${hitClass}">
                <div class="trait-header">
                    <span class="trait-title">Trait 2: 交易数额</span>
                    <span class="trait-score">s₂ = ${s2}</span>
                </div>
                <div class="trait-evidence">
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">交易金额</span>
                        <span class="trait-evidence-value">${evidence.token_amount}</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">阈值</span>
                        <span class="trait-evidence-value">${evidence.threshold}</span>
                    </div>
                    <div class="trait-evidence-item">
                        <span class="trait-evidence-label">状态</span>
                        <span class="trait-evidence-value">✓ 小额交易</span>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="trait-card ${hitClass}">
            <div class="trait-header">
                <span class="trait-title">Trait 2: 交易数额</span>
                <span class="trait-score">s₂ = ${s2}</span>
            </div>
            <div class="trait-evidence">
                <span class="trait-miss-text">未命中</span>
            </div>
        </div>
    `;
}

/**
 * Highlight matched characters in address
 * @param {string} addr - Address to display
 * @param {string} refAddr - Reference address to compare (optional)
 * @param {number} prefixLen - Prefix match length (optional)
 * @param {number} suffixLen - Suffix match length (optional)
 * @returns {string} HTML string with highlighted address
 */
function highlightAddressMatch(addr, refAddr = null, prefixLen = 0, suffixLen = 0) {
    if (!addr) return '';

    // If no match info, just return the plain address
    if (!refAddr || (prefixLen === 0 && suffixLen === 0)) {
        return `<span class="addr-plain">${addr}</span>`;
    }

    const addrLen = addr.length;
    let result = '';

    // Build the highlighted address
    for (let i = 0; i < addrLen; i++) {
        const char = addr[i];
        const isPrefix = i < prefixLen;
        const isSuffix = i >= (addrLen - suffixLen);

        if (isPrefix && isSuffix) {
            // Both prefix and suffix match (overlapping case, shouldn't happen in practice)
            result += `<span class="addr-match-both">${char}</span>`;
        } else if (isPrefix) {
            result += `<span class="addr-match-prefix">${char}</span>`;
        } else if (isSuffix) {
            result += `<span class="addr-match-suffix">${char}</span>`;
        } else {
            result += `<span class="addr-no-match">${char}</span>`;
        }
    }

    return result;
}

/**
 * Truncate address for display (legacy, kept for compatibility)
 */
function truncateAddress(addr) {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Could show a toast notification here
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// ========================================
// File Handling
// ========================================

/**
 * Handle file upload
 */
function handleFileUpload(file, type) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (type === 'transactions') {
                if (!Array.isArray(data)) {
                    throw new Error('交易数据必须是数组格式');
                }
                // Normalize data
                transactions = data.map(item => ({
                    ...item,
                    caip2: item.caip2 || item.caip_2 || '' // Handle caip_2 key
                }));
                transactionsStatus.textContent = `✓ 已加载 ${data.length} 条交易记录`;
                transactionsStatus.classList.remove('error');
                transactionsUpload.classList.add('loaded');
                clearTransactionsBtn.hidden = false;
            } else {
                if (!Array.isArray(data)) {
                    throw new Error('地址数据必须是数组格式');
                }
                // Normalize data
                anchors = data.map(item => ({
                    ...item,
                    caip2: item.caip2 || item.caip_2 || '' // Handle caip_2 key
                }));
                anchorsStatus.textContent = `✓ 已加载 ${data.length} 条地址记录`;
                anchorsStatus.classList.remove('error');
                anchorsUpload.classList.add('loaded');
                clearAnchorsBtn.hidden = false;
            }

            renderResults();
        } catch (err) {
            const statusEl = type === 'transactions' ? transactionsStatus : anchorsStatus;
            statusEl.textContent = `✗ 解析失败: ${err.message}`;
            statusEl.classList.add('error');
        }
    };

    reader.onerror = () => {
        const statusEl = type === 'transactions' ? transactionsStatus : anchorsStatus;
        statusEl.textContent = '✗ 文件读取失败';
        statusEl.classList.add('error');
    };

    reader.readAsText(file);
}

/**
 * Clear transactions data
 */
function clearTransactions() {
    transactions = [];
    transactionsFile.value = '';
    transactionsStatus.textContent = '';
    transactionsUpload.classList.remove('loaded');
    clearTransactionsBtn.hidden = true;
    renderResults();
}

/**
 * Clear anchors data
 */
function clearAnchors() {
    anchors = [];
    anchorsFile.value = '';
    anchorsStatus.textContent = '';
    anchorsUpload.classList.remove('loaded');
    clearAnchorsBtn.hidden = true;
    renderResults();
}

// ========================================
// Config Handling
// ========================================

/**
 * Update config from inputs
 */
function updateConfig() {
    config.bias = parseFloat(configInputs.bias.value) || 0;
    config.w1 = parseFloat(configInputs.w1.value) || 0;
    config.w2 = parseFloat(configInputs.w2.value) || 0;
    config.b12 = parseFloat(configInputs.b12.value) || 0;
    config.t0 = parseFloat(configInputs.t0.value) || 0.3;
    config.t1 = parseFloat(configInputs.t1.value) || 0.5;
    config.t2 = parseFloat(configInputs.t2.value) || 0.7;

    renderResults();
}

// ========================================
// Event Listeners
// ========================================

// File uploads
transactionsFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFileUpload(e.target.files[0], 'transactions');
    }
});

anchorsFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFileUpload(e.target.files[0], 'anchors');
    }
});

// Clear buttons
clearTransactionsBtn.addEventListener('click', clearTransactions);
clearAnchorsBtn.addEventListener('click', clearAnchors);

// Config inputs
Object.values(configInputs).forEach(input => {
    input.addEventListener('change', updateConfig);
    input.addEventListener('input', updateConfig);
});

// Drag and drop support
['transactions-upload', 'anchors-upload'].forEach(id => {
    const el = document.getElementById(id);
    const type = id.includes('transactions') ? 'transactions' : 'anchors';

    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.style.borderColor = 'var(--accent-primary)';
    });

    el.addEventListener('dragleave', () => {
        el.style.borderColor = '';
    });

    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.borderColor = '';

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            handleFileUpload(file, type);
        }
    });
});

// Initialize
renderResults();

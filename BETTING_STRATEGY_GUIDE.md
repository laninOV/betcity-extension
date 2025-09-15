# 🎯 Bradley-Terry Betting Strategy Guide

## Overview

This implementation provides a "battle-tested" betting strategy based on the Bradley-Terry model with strict quality filters. The system is designed to identify high-confidence betting opportunities while filtering out unreliable matches.

## Key Features

### 🔍 Quality Filters System

**Red Flags (Automatic Skip):**
- **RF_H2H**: Head-to-head data shows either balanced results (40-60%) or style dissonance
- **RF_DEC**: Too many tiebreak matches (3:2/2:3 results)  
- **RF_SW**: Player shows "swings" (both dominant wins and losses)

**Stability Checks:**
- Minimum 18 total sets from both players
- Maximum volatility σ ≤ 3.5 for both players

**Signal Strength Tiers:**
- **Tier A** (🟢): p_match ≥ 0.78 (Strong bet)
- **Tier B** (🟡): p_match ≥ 0.72 (Moderate bet)

### 📊 Calibration System

The system uses temperature scaling (default 1.2) to prevent overconfidence:
```javascript
p_set = σ(logit(p_set_raw) / temperature)
```

## Usage Examples

### Basic Implementation

```javascript
// Get last 5 matches for each player and H2H data
const last5A = convertGamesToBTFormat(playerA_games, "PlayerA", "Opponent");
const last5B = convertGamesToBTFormat(playerB_games, "PlayerB", "Opponent");  
const h2h = convertH2HToBTFormat(h2h_games, "PlayerA", "PlayerB");

// Apply betting strategy
const strategy = btBettingStrategy(last5A, last5B, h2h, "PlayerA", "PlayerB");

console.log(strategy.recommendation);
// Output: "🟢 STRONG BET on PlayerA (78.5%)" or "❌ SKIP: RED-FLAGS"
```

### Custom Configuration

```javascript
const strategy = btBettingStrategy(last5A, last5B, h2h, "PlayerA", "PlayerB", {
  // BT Model parameters
  halfLife: 21,        // Days for time decay
  betaMargin: 0.15,    // Margin bonus factor
  lambdaMatch: 0.7,    // Match result weight
  alphaPrior: 2.0,     // Regularization strength
  temperature: 1.2     // Calibration temperature
});

// Custom betting thresholds
const bettingDecision = shouldBetBT(
  { p_set_raw: strategy.p_set_raw, p_set: strategy.p_set, p_match: strategy.p_match },
  last5A, last5B, h2h, "PlayerA", "PlayerB",
  {
    // Red flag thresholds
    H2H_MIN_SETS: 7,
    H2H_BAL_LOW: 0.40,
    H2H_BAL_HIGH: 0.60,
    H2H_EDGE: 0.35,
    DECIDERS_PER_PLAYER: 2,
    DECIDERS_TOTAL: 3,
    
    // Stability thresholds  
    MIN_TOTAL_SETS: 18,
    MAX_SIGMA: 3.5,
    
    // Strength thresholds
    PMATCH_STRONG: 0.78,
    PMATCH_BASE: 0.72
  }
);
```

## Calibration for Different Volumes

### Target: ~10 Bets Per Day (Default)
```javascript
PMATCH_STRONG: 0.78
PMATCH_BASE: 0.72
MAX_SIGMA: 3.5
temperature: 1.2
```

### More Conservative (~5 Bets Per Day)
```javascript
PMATCH_STRONG: 0.82
PMATCH_BASE: 0.78
MAX_SIGMA: 3.2
temperature: 1.25
```

### More Aggressive (~15 Bets Per Day)
```javascript
PMATCH_STRONG: 0.76
PMATCH_BASE: 0.70
MAX_SIGMA: 3.8
temperature: 1.15
```

## Understanding the Output

### Betting Decision Structure
```javascript
{
  bet: true/false,           // Should we bet?
  tier: "A"/"B",            // Confidence tier (if betting)
  reason: "red-flags"/"unstable"/"weak-signal", // Skip reason
  details: {
    p_match: 0.785,         // Match probability
    totalSets: 22,          // Total sets analyzed
    sigmaA: 2.8,           // Player A volatility
    sigmaB: 3.1,           // Player B volatility
    RF_H2H: false,         // H2H red flag
    RF_DEC: false,         // Decider red flag  
    RF_SW: false           // Swing red flag
  }
}
```

### Strategy Result Structure
```javascript
{
  favorite: "PlayerA",                    // Predicted winner
  p_match: 0.785,                        // Win probability
  p_set: 0.642,                          // Set probability
  betting: { /* betting decision */ },    // Betting recommendation
  recommendation: "🟢 STRONG BET on PlayerA (78.5%)", // Summary
  scores: [                              // Score probabilities
    { score: "3:0", probability: 0.264 },
    { score: "3:1", probability: 0.312 },
    // ...
  ]
}
```

## Red Flag Examples

### H2H Style Dissonance
```
BT Model says: PlayerA 75% favorite
H2H History: PlayerA wins only 25% of sets
→ RED FLAG: Style mismatch, skip bet
```

### Too Many Tiebreaks
```
PlayerA recent matches: 3:2, 2:3, 3:2
→ RED FLAG: Unpredictable in decisive moments
```

### Performance Swings
```
PlayerA recent sets: 6:0, 6:1, 6:0 (dominant) + 0:6, 1:6, 2:6 (terrible)
→ RED FLAG: Inconsistent performance
```

## Integration with Extension

The betting strategy is automatically integrated into the tennis extension:

1. **Popup Display**: Shows betting recommendation at the top
2. **Color Coding**: 🟢 Strong, 🟡 Moderate, ❌ Skip
3. **Detailed Reasoning**: Explains why bet was recommended/skipped
4. **Console Logging**: Full diagnostic information

## Performance Tips

1. **Monitor Hit Rate**: Track Tier A vs Tier B success rates
2. **Adjust Thresholds**: Based on your risk tolerance and volume needs
3. **Review Skipped Bets**: Understand which filters are most active
4. **Temperature Tuning**: Lower = more bets, Higher = fewer but safer

## Mathematical Foundation

The system combines:
- **Bradley-Terry Model**: For skill estimation from set results
- **Bayesian Calibration**: Temperature scaling for probability adjustment  
- **Multi-factor Filtering**: Red flags, stability, and signal strength
- **Adaptive Weighting**: H2H vs recent form based on data quality

This creates a robust system that identifies genuine edges while avoiding common betting traps.

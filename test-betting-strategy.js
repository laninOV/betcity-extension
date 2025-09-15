// Test file for the betting strategy implementation
// Run with: node test-betting-strategy.js

// Import the Bradley-Terry functions
const BT = require('./bradley-terry.js');

// Sample test data
const sampleLast5A = [
  { date: new Date('2024-01-15'), home: 'PlayerA', away: 'Opponent1', sets: [[6,4], [6,2], [6,3]] },
  { date: new Date('2024-01-12'), home: 'PlayerA', away: 'Opponent2', sets: [[6,3], [4,6], [6,4], [6,2]] },
  { date: new Date('2024-01-10'), home: 'Opponent3', away: 'PlayerA', sets: [[2,6], [3,6], [4,6]] },
  { date: new Date('2024-01-08'), home: 'PlayerA', away: 'Opponent4', sets: [[6,1], [6,2], [6,0]] },
  { date: new Date('2024-01-05'), home: 'Opponent5', away: 'PlayerA', sets: [[4,6], [6,7], [6,4], [3,6]] }
];

const sampleLast5B = [
  { date: new Date('2024-01-14'), home: 'PlayerB', away: 'Opponent6', sets: [[6,2], [6,1], [6,3]] },
  { date: new Date('2024-01-11'), home: 'Opponent7', away: 'PlayerB', sets: [[3,6], [2,6], [4,6]] },
  { date: new Date('2024-01-09'), home: 'PlayerB', away: 'Opponent8', sets: [[6,4], [3,6], [6,4], [6,2]] },
  { date: new Date('2024-01-07'), home: 'Opponent9', away: 'PlayerB', sets: [[6,7], [4,6], [6,3], [2,6], [4,6]] },
  { date: new Date('2024-01-04'), home: 'PlayerB', away: 'Opponent10', sets: [[6,3], [6,4], [6,2]] }
];

const sampleH2H = [
  { date: new Date('2023-12-01'), home: 'PlayerA', away: 'PlayerB', sets: [[6,4], [6,2], [6,3]] },
  { date: new Date('2023-10-15'), home: 'PlayerB', away: 'PlayerA', sets: [[3,6], [6,4], [6,2], [6,4]] },
  { date: new Date('2023-08-20'), home: 'PlayerA', away: 'PlayerB', sets: [[6,3], [4,6], [6,4], [6,1]] }
];

console.log('=== Testing Betting Strategy Implementation ===\n');

// Test 1: Basic BT calculation
console.log('1. Testing basic Bradley-Terry calculation...');
try {
  const btResult = BT.btWinner(sampleLast5A, sampleLast5B, sampleH2H, 'PlayerA', 'PlayerB');
  console.log(`✓ BT Result: Favorite = ${btResult.favorite}, p_match = ${(btResult.p_match * 100).toFixed(1)}%`);
  console.log(`  Ratings: PlayerA = ${btResult.ratings.PlayerA.toFixed(3)}, PlayerB = ${btResult.ratings.PlayerB.toFixed(3)}`);
} catch (error) {
  console.log(`✗ BT calculation failed: ${error.message}`);
}

// Test 2: H2H set share calculation
console.log('\n2. Testing H2H set share calculation...');
try {
  const h2hResult = BT.h2hSetShare(sampleH2H, 'PlayerA', 'PlayerB');
  console.log(`✓ H2H Result: p = ${h2hResult.p.toFixed(3)}, total sets = ${h2hResult.total}`);
} catch (error) {
  console.log(`✗ H2H calculation failed: ${error.message}`);
}

// Test 3: Player set statistics
console.log('\n3. Testing player set statistics...');
try {
  const statsA = BT.playerSetStats(sampleLast5A, 'PlayerA');
  const statsB = BT.playerSetStats(sampleLast5B, 'PlayerB');
  console.log(`✓ PlayerA stats: totalSets=${statsA.totalSets}, sigma=${statsA.sigma.toFixed(2)}, deciders=${statsA.deciders}, swings=${statsA.swings}`);
  console.log(`✓ PlayerB stats: totalSets=${statsB.totalSets}, sigma=${statsB.sigma.toFixed(2)}, deciders=${statsB.deciders}, swings=${statsB.swings}`);
} catch (error) {
  console.log(`✗ Player stats calculation failed: ${error.message}`);
}

// Test 4: Betting decision
console.log('\n4. Testing betting decision logic...');
try {
  const btResult = BT.btWinner(sampleLast5A, sampleLast5B, sampleH2H, 'PlayerA', 'PlayerB');
  const bettingDecision = BT.shouldBetBT(
    {
      p_set_raw: btResult.p_set_raw,
      p_set: btResult.p_set,
      p_match: btResult.p_match
    },
    sampleLast5A, sampleLast5B, sampleH2H, 'PlayerA', 'PlayerB'
  );
  
  console.log(`✓ Betting Decision: bet=${bettingDecision.bet}, reason=${bettingDecision.reason}`);
  if (bettingDecision.bet) {
    console.log(`  Tier: ${bettingDecision.tier}, p_match: ${(bettingDecision.details.p_match * 100).toFixed(1)}%`);
  } else {
    console.log(`  Details: ${JSON.stringify(bettingDecision.details)}`);
  }
} catch (error) {
  console.log(`✗ Betting decision failed: ${error.message}`);
}

// Test 5: Full betting strategy
console.log('\n5. Testing full betting strategy...');
try {
  const strategy = BT.btBettingStrategy(sampleLast5A, sampleLast5B, sampleH2H, 'PlayerA', 'PlayerB');
  console.log(`✓ Strategy Result: ${strategy.recommendation}`);
  console.log(`  Favorite: ${strategy.favorite}, p_match: ${(strategy.p_match * 100).toFixed(1)}%`);
  console.log(`  Betting: ${strategy.betting.bet ? `YES (${strategy.betting.tier})` : `NO (${strategy.betting.reason})`}`);
} catch (error) {
  console.log(`✗ Full strategy failed: ${error.message}`);
}

// Test 6: Edge cases
console.log('\n6. Testing edge cases...');

// Test with insufficient data
const shortData = [sampleLast5A[0]];
try {
  const strategy = BT.btBettingStrategy(shortData, sampleLast5B, [], 'PlayerA', 'PlayerB');
  console.log(`✓ Short data test: ${strategy.betting.bet ? 'BET' : strategy.betting.reason}`);
} catch (error) {
  console.log(`✗ Short data test failed: ${error.message}`);
}

// Test with high volatility data (create swings)
const volatileData = [
  { date: new Date('2024-01-15'), home: 'PlayerA', away: 'Opponent1', sets: [[6,0], [6,0], [6,0]] }, // big win
  { date: new Date('2024-01-12'), home: 'Opponent2', away: 'PlayerA', sets: [[6,0], [6,0], [6,0]] }, // big loss
  { date: new Date('2024-01-10'), home: 'PlayerA', away: 'Opponent3', sets: [[6,1], [6,1], [6,1]] }, // big win
  { date: new Date('2024-01-08'), home: 'Opponent4', away: 'PlayerA', sets: [[6,1], [6,1], [6,1]] }, // big loss
  { date: new Date('2024-01-05'), home: 'PlayerA', away: 'Opponent5', sets: [[6,2], [6,2], [6,2]] }  // big win
];

try {
  const strategy = BT.btBettingStrategy(volatileData, sampleLast5B, [], 'PlayerA', 'PlayerB');
  console.log(`✓ Volatile data test: ${strategy.betting.bet ? 'BET' : strategy.betting.reason}`);
} catch (error) {
  console.log(`✗ Volatile data test failed: ${error.message}`);
}

console.log('\n=== Test Complete ===');

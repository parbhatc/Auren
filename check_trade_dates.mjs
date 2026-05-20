// Check what dates the trades actually fall on
const trades = [
  { id: "trade-1767482212949-ewhdetob6", entry_time: 1737385980 },
  { id: "trade-1767482152000-hyzbea08h", entry_time: 1737126060 },
  { id: "trade-1767482075009-2783x7e5i", entry_time: 1737038100 },
  { id: "trade-1767482021774-49omx71q5", entry_time: 1736951940 },
  { id: "trade-1767481971993-io8twkk6b", entry_time: 1736865240 },
  { id: "trade-1767481897767-yxlf6tfpa", entry_time: 1736780400 },
  { id: "trade-1767481783550-6j7nklhna", entry_time: 1736519400 },
  { id: "trade-1767481743611-ge8ju5fxs", entry_time: 1736348760 },
  { id: "trade-1767481681602-m05puul4e", entry_time: 1736260380 },
  { id: "trade-1767481533447-p4ru3raxb", entry_time: 1736175420 },
  { id: "trade-1767481270005-ifxzicyrl", entry_time: 1735917060 },
  { id: "trade-1767480893286-wyhs1tvz4", entry_time: 1735829280 }
];

console.log('Trade entry dates:');
trades.forEach(trade => {
  const date = new Date(trade.entry_time * 1000);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  console.log(`${trade.id}: ${dateStr} (${trade.entry_time})`);
});

// Check the requested date range
const startDate = '2025-01-21';
const endDate = '2025-01-21';

const startDateObj = new Date(startDate + 'T00:00:00Z');
const endDateObj = new Date(endDate + 'T23:59:59Z');
const startTimestamp = Math.floor(startDateObj.getTime() / 1000);
const endTimestamp = Math.floor(endDateObj.getTime() / 1000);

console.log(`\nRequested date range: ${startDate} to ${endDate}`);
console.log(`Timestamp range: ${startTimestamp} to ${endTimestamp}`);

console.log('\nTrades in range:');
trades.forEach(trade => {
  if (trade.entry_time >= startTimestamp && trade.entry_time <= endTimestamp) {
    console.log(`${trade.id}: ${trade.entry_time}`);
  }
});

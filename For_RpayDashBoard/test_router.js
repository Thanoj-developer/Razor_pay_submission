const { classifyQuery, classifyWithLLM, classifyWithKeywords, INBOX } = require('./RouterLogic');

async function runRouterTests() {
  const testQueries = [
    { query: "Open Amazon", expected: INBOX.ORCHESTRATION },
    { query: "Go to YouTube", expected: INBOX.ORCHESTRATION },
    { query: "Search Flipkart for headphones", expected: INBOX.ORCHESTRATION },
    { query: "Launch http://localhost:5173/", expected: INBOX.ORCHESTRATION },
    { query: "Visit Razorpay dashboard", expected: INBOX.ORCHESTRATION },
    { query: "Click on buy now for Converse Street Sneaker", expected: INBOX.AUTO_NAVIGATION },
    { query: "Book this product", expected: INBOX.AUTO_NAVIGATION },
    { query: "Add to cart", expected: INBOX.AUTO_NAVIGATION },
    { query: "Fill search box with wireless mouse", expected: INBOX.AUTO_NAVIGATION },
    { query: "Click pay now and proceed to checkout", expected: INBOX.AUTO_NAVIGATION },
    { query: "Select standard shipping option", expected: INBOX.AUTO_NAVIGATION },
    { query: "Enter OTP 123456 and verify", expected: INBOX.AUTO_NAVIGATION }
  ];

  console.log('================================================================');
  console.log('         SMART QUERY ROUTER INTENT CLASSIFICATION TEST         ');
  console.log('================================================================\n');

  let passed = 0;

  for (const { query, expected } of testQueries) {
    const { inbox, confidence } = await classifyQuery(query, true);
    const isMatch = inbox === expected;
    if (isMatch) passed++;

    console.log(`Query: "${query}"`);
    console.log(`  -> Classified as : ${inbox} (Confidence: ${confidence})`);
    console.log(`  -> Expected      : ${expected} [${isMatch ? '✅ PASS' : '❌ FAIL'}]\n`);
  }

  console.log('================================================================');
  console.log(`RESULTS: ${passed}/${testQueries.length} passed.`);
  console.log('================================================================');
}

runRouterTests().catch(console.error);

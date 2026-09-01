const { routeQuery } = require('./RouterLogic');

async function testFullFlow() {
  console.log('------------------------------------------------------------');
  console.log('TEST 1: ORCHESTRATION ROUTING & EXECUTION');
  console.log('Query: "Launch http://localhost:5173/"');
  console.log('------------------------------------------------------------');
  const res1 = await routeQuery("Launch http://localhost:5173/");
  console.log('Result 1 (Orchestration):', {
    inbox: res1.inbox,
    success: res1.result?.success,
    reply: res1.result?.reply?.substring(0, 100) + '...'
  });

  console.log('\n------------------------------------------------------------');
  console.log('TEST 2: AUTO-NAVIGATION ROUTING & EXECUTION');
  console.log('Query: "Click on buy now for Converse Street Sneaker"');
  console.log('------------------------------------------------------------');
  const res2 = await routeQuery("Click on buy now for Converse Street Sneaker", {
    onStepLog: (step) => console.log(`  [Step ${step.step}] Status: ${step.status}, Action:`, step.action)
  });
  console.log('Result 2 (AutoNav):', {
    inbox: res2.inbox,
    success: res2.result?.success,
    status: res2.result?.status
  });
}

testFullFlow().catch(console.error);

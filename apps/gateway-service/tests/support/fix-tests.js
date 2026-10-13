const fs = require('fs');
const file = 'apps/gateway-service/tests/ai-requests.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Add Idempotency-Key
content = content.replace(/\.post\("\/ai-requests"\)/g, '.post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())');

// Add redis mock import at the top
if (!content.includes('jest.mock("../src/db/redis"')) {
  content = `import RedisMock from "ioredis-mock";
jest.mock("../src/db/redis", () => {
  const mock = new RedisMock();
  return { getRedisClient: () => mock };
});\n` + content;
}

fs.writeFileSync(file, content);
console.log('Fixed ai-requests.test.ts');

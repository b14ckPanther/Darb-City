/**
 * Tests get their own Redis database index, so clearing darb:intent:*, darb:model:calls:* or
 * darb:rl:* never touches the dev API's keys (database 0). The search quality suite uses 15.
 */
export const TEST_REDIS_DB = 14;

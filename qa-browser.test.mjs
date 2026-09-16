import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launchQaBrowser } from './qa-browser.mjs';

const server = createServer((_request, response) => response.end('local fixture'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await launchQaBrowser();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await page.textContent('body'), 'local fixture');
  await assert.rejects(page.goto('https://offline-qa.invalid/'), /ERR_BLOCKED_BY_CLIENT/);
  const mockPage = await browser.newPage();
  await mockPage.route('https://offline-qa.invalid/**', route => route.fulfill({body:'mocked'}));
  await mockPage.goto('https://offline-qa.invalid/');
  assert.equal(await mockPage.textContent('body'), 'mocked');
  const context = await browser.newContext();
  const another = await context.newPage();
  await assert.rejects(another.goto('https://offline-qa.invalid/'), /ERR_BLOCKED_BY_CLIENT/);
  console.log('Offline browser guard: loopback allowed, external blocked, explicit mocks allowed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

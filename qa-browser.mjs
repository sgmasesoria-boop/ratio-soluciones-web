import { chromium } from 'playwright';

// Offline QA only. Specific page.route mocks take priority over this guard.
export async function launchQaBrowser(options = {}) {
  const browser = await chromium.launch({
    ...options,
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: process.platform === 'win32' ? 'msedge' : 'chromium' }),
  });
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async (contextOptions = {}) => {
    const context = await originalNewContext({ ...contextOptions, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const local = ['file:', 'data:', 'about:'].includes(url.protocol)
        || (['http:', 'https:'].includes(url.protocol)
          && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
      return local ? route.continue() : route.abort('blockedbyclient');
    });
    return context;
  };
  browser.newPage = async (options = {}) => {
    const context = await browser.newContext(options);
    return context.newPage();
  };
  return browser;
}

import puppeteer from 'puppeteer';
import fakeUa from 'fake-useragent';

export async function getUserPage(login) {
  const browser = await puppeteer.launch();
  try {
    const responses = [];
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      req.continue();
    });

    page.on('response', async (res) => {
      if (
        res.request().method() === 'GET' &&
        /\/graphql\/(.+)\/User/.test(res.url())
      ) {
        responses.push({
          url: res.url(),
          data: await res.json(),
        });
      }
    });

    await page.setUserAgent(fakeUa());
    await page.setViewport({ width: 2560, height: 1440 });
    await page.goto(`${process.env.TWITTER_BASE}/${login}`, {
      waitUntil: 'networkidle0',
    });

    return responses;
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}

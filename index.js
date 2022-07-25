import 'dotenv/config';
import puppeteer from 'puppeteer';
import fakeUa from 'fake-useragent';
import { promises as fsPromises } from 'fs';

async function getUserPage(userLogin) {
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
    await page.goto(`${process.env.TWITTER_BASE}/${userLogin}`, {
      waitUntil: 'networkidle0',
    });
    await fsPromises.writeFile(
      'responses.json',
      JSON.stringify(responses, null, 2),
      'utf-8'
    );
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}

getUserPage('TheRock')
  .then(() => console.log('Done ✅'))
  .catch(console.log);

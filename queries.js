import fakeUa from 'fake-useragent';
import { promises as fsPromises } from 'fs';

export async function getUserPage(userLogin, browser) {
  const page = await browser.newPage();
  try {
    const responses = [];
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
    return responses;
  } catch (error) {
    throw error;
  } finally {
    await page.close();
  }
}

export async function getTweetDetails(tweetUrl, browser) {
  const page = await browser.newPage();
  try {
    let tweetDetails = {};
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      req.continue();
    });

    page.on('response', async (res) => {
      if (
        res.request().method() === 'GET' &&
        /\/graphql\/(.+)\/TweetDetail/.test(res.url()) &&
        !Object.keys(tweetDetails).length
      ) {
        tweetDetails = await res.json();
        return [tweetDetails, tweetUrl];
      }
    });

    await page.setUserAgent(fakeUa());
    await page.setViewport({ width: 2560, height: 1440 });
    await page.goto(tweetUrl, { waitUntil: 'networkidle0' });
    await fsPromises.writeFile(
      'tweetDetails.json',
      JSON.stringify(tweetDetails, null, 2),
      'utf-8'
    );
    return [tweetDetails, tweetUrl];
  } catch (error) {
    throw error;
  } finally {
    await page.close();
  }
}

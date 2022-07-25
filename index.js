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
    return responses;
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}

async function getTweetDetails(tweetUrl) {
  const browser = await puppeteer.launch();
  try {
    let tweetDetails = {};
    const page = await browser.newPage();
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
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}

function getTweetsUrls(content) {
  try {
    const screenName = content[0].data.data.user.result.legacy.screen_name;
    const tweetsSection =
      content.slice(-1)[0].data.data.user.result.timeline_v2.timeline
        .instructions[1].entries;
    const tweetsUrls = [];

    for (const tweet of tweetsSection) {
      if (/^tweet-(.+)/.test(tweet.entryId)) {
        if (
          tweet.content.itemContent.tweet_results.result.legacy
            .retweeted_status_result
        ) {
          const originalScreenName =
            tweet.content.itemContent.tweet_results.result.legacy
              .retweeted_status_result.result.core.user_results.result.legacy
              .screen_name;
          const originalTweetId =
            tweet.content.itemContent.tweet_results.result.legacy
              .retweeted_status_result.result.rest_id;

          tweetsUrls.push({
            status: 'Retweet',
            url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
            original_url: `${process.env.TWITTER_BASE}/${originalScreenName}/status/${originalTweetId}`,
          });
        } else if (
          tweet.content.itemContent.tweet_results.result.legacy.is_quote_status
        ) {
          tweetsUrls.push({
            status: 'Quotation',
            url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
            original_url:
              tweet.content.itemContent.tweet_results.result.legacy
                .quoted_status_permalink.expanded,
          });
        } else {
          tweetsUrls.push({
            status: 'Tweet',
            url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
            original_url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
          });
        }
      }

      if (tweetsUrls.length >= 10) {
        break;
      }
    }

    return tweetsUrls;
  } catch (error) {
    throw error;
  }
}

getUserPage('GeorgeRussell63')
  .then((responses) => getTweetDetails(getTweetsUrls(responses)[0].url))
  .then(() => console.log('Done ✅'))
  .catch(console.log);

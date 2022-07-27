import 'dotenv/config';
import puppeteer from 'puppeteer';
import fakeUa from 'fake-useragent';
import { promises as fsPromises } from 'fs';
import mongoose from 'mongoose';
import { User } from './models/index.js';

class TaskQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  runTask(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        return task().then(resolve, reject);
      });
      process.nextTick(this.next.bind(this));
    });
  }

  next() {
    while (this.running < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      task().finally(() => {
        this.running -= 1;
        this.next();
      });
      this.running += 1;
    }
  }
}

async function getUserPage(userLogin, browser) {
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

async function getTweetDetails(tweetUrl, browser) {
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

async function getTweetsUrls(login, content) {
  try {
    const userByScreenNameContent = content.find((item) =>
      /\/graphql\/(.+)\/UserByScreenName/.test(item.url)
    );
    const userTweetsContent = content.find((item) =>
      /\/graphql\/(.+)\/UserTweets/.test(item.url)
    );
    const screenName =
      userByScreenNameContent.data.data.user.result.legacy.screen_name;
    const tweetsSection =
      userTweetsContent.data.data.user.result.timeline_v2.timeline
        .instructions[1].entries;
    const tweetsUrls = [];
    const lastTweetId = await User.findOne({ login: login.toLowerCase() });

    for (const tweet of tweetsSection) {
      if (/^tweet-(.+)/.test(tweet.entryId)) {
        if (lastTweetId && lastTweetId.tweetId.toString() === tweet.sortIndex) {
          break;
        }

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
            screenName,
            status: 'Retweet',
            url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
            original_url: `${process.env.TWITTER_BASE}/${originalScreenName}/status/${originalTweetId}`,
          });
        } else if (
          tweet.content.itemContent.tweet_results.result.legacy.is_quote_status
        ) {
          tweetsUrls.push({
            screenName,
            status: 'Quotation',
            url: `${process.env.TWITTER_BASE}/${screenName}/status/${tweet.sortIndex}`,
            original_url:
              tweet.content.itemContent.tweet_results.result.legacy
                .quoted_status_permalink.expanded,
          });
        } else {
          tweetsUrls.push({
            screenName,
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

function readTweetDetails(tweetPreInfo, content) {
  try {
    const tweetsEntries =
      content.data.threaded_conversation_with_injections_v2.instructions[0]
        .entries;
    const tweetDetails = tweetsEntries.find((item) =>
      item.entryId.includes(tweetPreInfo.url.split('/').slice(-1)[0])
    );
    const tweetResultBlock =
      tweetDetails.content.itemContent.tweet_results.result;
    const tweetLegacyBlock = tweetResultBlock.legacy;
    let tweetInfo = {
      id: tweetPreInfo.url.split('/').slice(-1)[0],
    };

    if (tweetPreInfo.status === 'Retweet') {
      tweetInfo = { ...tweetInfo, ...getRetweet(tweetLegacyBlock) };
    } else {
      let tweetFullText = tweetLegacyBlock.full_text.trim();
      const { outer_url, video, photo } = getTweetMedia(tweetLegacyBlock);

      tweetInfo.outer_url = outer_url;
      tweetInfo.video = video;
      tweetInfo.photo = photo;
      tweetInfo.full_text = tweetFullText;
      tweetFullText = editTweetText(tweetInfo, tweetLegacyBlock);
      tweetInfo.full_text = tweetFullText;

      if (tweetLegacyBlock.is_quote_status) {
        const parentTweet = getQuotationTweet(tweetResultBlock);
        tweetInfo.parent = parentTweet;
      }
    }

    return tweetInfo;
  } catch (error) {
    throw error;
  }
}

function getTweetMedia(tweetLegacyBlock) {
  try {
    const mediaInfo = {
      outer_url: null,
      video: null,
      photo: null,
    };

    if (tweetLegacyBlock.extended_entities) {
      const extEnt = tweetLegacyBlock.extended_entities;
      const type = extEnt.media[0].type;

      if (type === 'photo') {
        mediaInfo.photo = extEnt.media[0].media_url_https;
      } else if (type === 'video' || type === 'animated_gif') {
        mediaInfo.video = extEnt.media[0].video_info.variants
          .filter((item) => item.hasOwnProperty('bitrate') && item.bitrate >= 0)
          .sort((a, b) => b.bitrate - a.bitrate)[0].url;
      }
    }

    if (tweetLegacyBlock.entities.urls.length) {
      mediaInfo.outer_url = tweetLegacyBlock.entities.urls[0].expanded_url;
    }

    return mediaInfo;
  } catch (error) {
    throw error;
  }
}

function editTweetText(tweetInfo, tweetLegacyBlock) {
  try {
    if (tweetInfo.outer_url || tweetInfo.video || tweetInfo.photo) {
      tweetInfo.full_text = tweetInfo.full_text
        .slice(0, tweetInfo.full_text.indexOf('https://t.co/'))
        .trim();
    }

    if (tweetLegacyBlock.entities.user_mentions.length) {
      const mentions = tweetLegacyBlock.entities.user_mentions;

      for (const mention of mentions) {
        const startIndexMention = tweetInfo.full_text
          .toLowerCase()
          .indexOf(`@${mention.screen_name.toLowerCase()}`);
        const afterString = tweetInfo.full_text.slice(
          startIndexMention + mention.screen_name.length + 1
        );
        tweetInfo.full_text =
          tweetInfo.full_text.slice(0, startIndexMention) +
          `<a href="${process.env.TWITTER_BASE}/${mention.screen_name}">@${mention.screen_name}</a>` +
          afterString;
      }
    }

    return tweetInfo.full_text;
  } catch (error) {
    throw error;
  }
}

function getRetweet(tweetLegacyBlock) {
  try {
    const retweetedStatusResult = tweetLegacyBlock.retweeted_status_result;
    const tweetInfo = {};
    let tweetFullText = retweetedStatusResult.result.legacy.full_text;
    const { outer_url, video, photo } = getTweetMedia(
      retweetedStatusResult.result.legacy
    );
    tweetInfo.outer_url = outer_url;
    tweetInfo.video = video;
    tweetInfo.photo = photo;
    tweetInfo.full_text = tweetFullText;
    tweetFullText = editTweetText(
      tweetInfo,
      retweetedStatusResult.result.legacy
    );
    tweetInfo.full_text = tweetFullText;

    if (retweetedStatusResult.result.legacy.is_quote_status) {
      tweetInfo.parent = getQuotationTweet(retweetedStatusResult.result);
    }

    return tweetInfo;
  } catch (error) {
    throw error;
  }
}

function getQuotationTweet(tweetResultBlock) {
  try {
    const parentTweetId = tweetResultBlock.quoted_status_result.result.rest_id;
    const parentScreenName =
      tweetResultBlock.quoted_status_result.result.core.user_results.result
        .legacy.screen_name;
    const tweetQuoteLegacyBlock =
      tweetResultBlock.quoted_status_result.result.legacy;
    const parentTweet = {};
    let parentTweetFullText = tweetQuoteLegacyBlock.full_text.trim();
    const {
      outer_url: parentOuterUrl,
      video: parentVideo,
      photo: parentPhoto,
    } = getTweetMedia(tweetQuoteLegacyBlock);
    parentTweet.id = parentTweetId;
    parentTweet.login = parentScreenName;
    parentTweet.outer_url = parentOuterUrl;
    parentTweet.video = parentVideo;
    parentTweet.photo = parentPhoto;
    parentTweet.full_text = parentTweetFullText;
    parentTweetFullText = editTweetText(parentTweet, tweetQuoteLegacyBlock);
    parentTweet.full_text = parentTweetFullText;

    return parentTweet;
  } catch (error) {
    throw error;
  }
}

function tweetTask(tweetObj, browser, queue) {
  return queue.runTask(() => {
    return getTweetDetails(tweetObj.url, browser);
  });
}

async function mainTask(browser, login) {
  const start = performance.now();
  const responses = await getUserPage(login, browser);
  const tweetsUrls = await getTweetsUrls(login, responses);
  const tweetsInfo = [];
  const queue = new TaskQueue(2);
  const promises = tweetsUrls.map((tweetUrl) =>
    tweetTask(tweetUrl, browser, queue)
  );

  const tweets = await Promise.all(promises);

  for (const index in tweets) {
    tweetsInfo.push(
      readTweetDetails(
        tweetsUrls.find((item) => item.url === tweets[index][1]),
        tweets[index][0]
      )
    );
    console.log(`[⏳] Processed #${parseInt(index) + 1}`);
  }

  if (tweetsInfo.length) {
    await fsPromises.writeFile(
      'tweets.json',
      JSON.stringify(tweetsInfo, null, 2),
      'utf-8'
    );
    await User.updateOne(
      { login: login.toLowerCase() },
      { login: login.toLowerCase(), tweetId: tweetsInfo[0].id },
      { upsert: true }
    );
  } else {
    console.log(`User with login ${login} has no new tweets`);
  }
  console.log(
    `Done with ${login} ✅. Time: ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}`
  );

  return {
    login,
    tweets: tweetsInfo,
  };
}

(async () => {
  const browser = await puppeteer.launch();
  const logins = ['TheRock'];
  const data = [];
  try {
    for (const login of logins) {
      data.push(await mainTask(browser, login));
    }

    await fsPromises.writeFile(
      'data.json',
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    console.log('Done ✅');
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
})();

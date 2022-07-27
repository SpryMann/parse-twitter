import 'dotenv/config';
import puppeteer from 'puppeteer';
import { promises as fsPromises } from 'fs';
import mongoose from 'mongoose';
import { User } from './models/index.js';
import TaskQueue from './taskQueue.js';
import { getUserPage, getTweetDetails } from './queries.js';
import { getTweetsUrls, readTweetDetails } from './readData.js';
import { cleanDir } from './helpers.js';

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
  // Add here logins for parsing
  const logins = [
    'evamillersha',
    'Stranger_Things',
    'Restorator51',
    'JensenAckles',
    'xPandorya',
    'AmybethMcnulty',
    'HaileeSteinfeld',
    'Caradelevingne',
    'KevinHart4real',
    'IAmSteveHarvey',
  ];
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
    await cleanDir();

    console.log('Done ✅');
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
})();

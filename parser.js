import { promises as fsPromises } from 'fs';
import mongoose from 'mongoose';
import { User } from './models/index.js';
import { getUserPage } from './queries.js';
import { readUserData } from './readData.js';

async function mainTask(login) {
  try {
    const start = performance.now();
    const responses = await getUserPage(login);
    const tweetsData = await readUserData(login, responses);

    if (tweetsData.tweets.length) {
      console.log(`${tweetsData.tweets.length} new tweets`);

      await User.updateOne(
        { login: login.toLowerCase() },
        { login: login.toLowerCase(), tweetId: tweetsData.tweets[0].id },
        { upsert: true }
      );
    } else {
      console.log(`${login} has no new tweets`);
    }

    console.log(
      `Done with ${login} ✅ Time: ${(
        (performance.now() - start) /
        1000
      ).toFixed(2)}`
    );

    return tweetsData;
  } catch (error) {
    throw error;
  }
}

async function main(logins) {
  try {
    const data = [];

    for (const login of logins) {
      data.push(await mainTask(login));
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
    await mongoose.disconnect();
  }
}

export default main;

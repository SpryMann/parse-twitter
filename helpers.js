import { promises as fsPromises } from 'fs';

export async function cleanDir() {
  try {
    await fsPromises.rm('responses.json');
    await fsPromises.rm('tweetDetails.json');
    await fsPromises.rm('tweets.json');
  } catch (error) {
    throw error;
  }
}

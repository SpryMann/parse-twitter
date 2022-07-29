import { User } from './models/index.js';

export async function readUserData(login, content) {
  try {
    const userTweets = content.find((item) =>
      /\/graphql\/(.+)\/UserTweets/.test(item.url)
    ).data;
    const tweetsEntries =
      userTweets.data.user.result.timeline_v2.timeline.instructions[1].entries;
    const lastTweetId = await User.findOne({ login: login.toLowerCase() });
    const userTweetsData = {
      login,
      tweets: [],
    };

    for (const entry of tweetsEntries) {
      if (/^tweet-(.+)/.test(entry.entryId)) {
        if (lastTweetId && lastTweetId.tweetId.toString() === entry.sortIndex) {
          break;
        }

        userTweetsData.tweets.push(readTweetData(entry));

        if (!lastTweetId && userTweetsData.tweets.length >= 10) {
          break;
        }
      }
    }

    return userTweetsData;
  } catch (error) {
    throw error;
  }
}

function readTweetData(tweetBlock) {
  try {
    const tweetResultBlock =
      tweetBlock.content.itemContent.tweet_results.result;
    const tweetLegacyBlock = tweetResultBlock.legacy;
    let tweetInfo = {
      id: tweetBlock.sortIndex,
    };

    if (tweetLegacyBlock.retweeted_status_result) {
      tweetInfo = {
        ...tweetInfo,
        ...readRetweet(tweetLegacyBlock.retweeted_status_result.result),
      };
    } else {
      let tweetFullText = tweetLegacyBlock.full_text.trim();
      const { outer_url, video, photo } = readTweetMedia(tweetLegacyBlock);

      tweetInfo.outer_url = outer_url;
      tweetInfo.video = video;
      tweetInfo.photo = photo;
      tweetInfo.full_text = tweetFullText;
      tweetFullText = editTweetText(tweetInfo, tweetLegacyBlock);
      tweetInfo.full_text = tweetFullText;

      if (
        tweetLegacyBlock.is_quote_status &&
        tweetResultBlock.quoted_status_result.result.rest_id
      ) {
        const parentTweet = readQuotation(tweetResultBlock);
        tweetInfo.parent = parentTweet;
      }
    }

    return tweetInfo;
  } catch (error) {
    throw error;
  }
}

function readRetweet(tweetResultBlock) {
  try {
    const tweetInfo = {};
    let tweetFullText = tweetResultBlock.legacy.full_text.trim();
    const { outer_url, video, photo } = readTweetMedia(tweetResultBlock.legacy);
    tweetInfo.outer_url = outer_url;
    tweetInfo.video = video;
    tweetInfo.photo = photo;
    tweetInfo.full_text = tweetFullText;
    tweetFullText = editTweetText(tweetInfo, tweetResultBlock.legacy);
    tweetInfo.full_text = tweetFullText;

    if (
      tweetResultBlock.legacy.is_quote_status &&
      tweetResultBlock.quoted_status_result.result.rest_id
    ) {
      tweetInfo.parent = readQuotation(tweetResultBlock);
    }

    return tweetInfo;
  } catch (error) {
    throw error;
  }
}

function readQuotation(tweetResultBlock) {
  try {
    const parentTweetId = tweetResultBlock.quoted_status_result.result.rest_id;
    const parentScreenName =
      tweetResultBlock.quoted_status_result.result.core.user_results.result
        .legacy.screen_name;
    const tweetQuoteLegacyBlock =
      tweetResultBlock.quoted_status_result.result.legacy;
    const parentTweet = {};
    let parentTweetFullText = tweetQuoteLegacyBlock.full_text.trim();
    const { outer_url, video, photo } = readTweetMedia(tweetQuoteLegacyBlock);
    parentTweet.id = parentTweetId;
    parentTweet.login = parentScreenName;
    parentTweet.outer_url = outer_url;
    parentTweet.video = video;
    parentTweet.photo = photo;
    parentTweet.full_text = parentTweetFullText;
    parentTweetFullText = editTweetText(parentTweet, tweetQuoteLegacyBlock);
    parentTweet.full_text = parentTweetFullText;

    return parentTweet;
  } catch (error) {
    throw error;
  }
}

function readTweetMedia(tweetLegacyBlock) {
  try {
    const mediaInfo = {
      outer_url: null,
      video: [],
      photo: [],
    };

    if (tweetLegacyBlock.extended_entities) {
      const extEnts = tweetLegacyBlock.extended_entities.media;

      for (const extEnt of extEnts) {
        const type = extEnt.type;

        if (type === 'photo') {
          mediaInfo.photo.push(extEnt.media_url_https);
        } else if (type === 'video' || type === 'animated_gif') {
          mediaInfo.video.push(
            extEnt.video_info.variants
              .filter(
                (item) => item.hasOwnProperty('bitrate') && item.bitrate >= 0
              )
              .sort((a, b) => b.bitrate - a.bitrate)[0].url
          );
        }
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
    if (
      tweetInfo.outer_url ||
      tweetInfo.video.length ||
      tweetInfo.photo.length
    ) {
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

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  login: String,
  tweetId: String,
});

export default userSchema;

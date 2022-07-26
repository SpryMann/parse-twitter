import 'dotenv/config';
import mongoose from 'mongoose';
import userSchema from './user.schema.js';

mongoose.connect(process.env.MONGO_URL);

export const User = mongoose.model('Users', userSchema);

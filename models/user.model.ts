import mongoose from 'mongoose';

const UserModel = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	phoneNumber: { type: String, required: true },
	commandPermeted: { type: Boolean, require: true, default: false },
	currentServices: { type: String, require: true, default: 'nothing' }
});

export const User = mongoose.model('User', UserModel);

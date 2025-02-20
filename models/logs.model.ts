import mongoose from 'mongoose';

const LogModel = new mongoose.Schema({
	date: { type: Date, default: Date.now },
	impact: { type: String, required: true },
	location: { type: String, required: true },
	text: { type: String, required: true },
	initiator: { type: String, required: true },
	data: { type: Object, required: false }
});

export const Log = mongoose.model('Log', LogModel);

import mongoose from 'mongoose';

const WikipediaModelModel = new mongoose.Schema({
	userID: { type: mongoose.Schema.ObjectId, ref: 'User', required: false },
	language: { type: String, required: true, default: 'en' }
});

export const WikipediaModel = mongoose.model('WikipediaModel', WikipediaModelModel);

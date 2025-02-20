import mongoose from 'mongoose';

const UtilModelModel = new mongoose.Schema({
	userID: { type: mongoose.Schema.ObjectId, ref: 'User', required: false },
	Util_Action: { type: String, require: false, enum: ['sendat'] },
	Util_recPhone: { type: String, require: false },
	Util_date: { type: Date, require: false },
	Util_Message: { type: String, require: false }
});

export const UtilModel = mongoose.model('UtilModel', UtilModelModel);

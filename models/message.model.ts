import mongoose from 'mongoose';

const MessageModel = new mongoose.Schema({
	date: { type: Date, default: Date.now },
	contactID: { type: mongoose.Schema.ObjectId, ref: 'Contact', required: false },
	userID: { type: mongoose.Schema.ObjectId, ref: 'User', required: false },
	message: { type: String, required: true },
	direction: { type: Boolean, required: true }, // in or out in: true, out: false
	status: {
		type: String,
		enum: ['received', 'sent', 'delivered', 'failed', 'pending'],
		default: 'pending',
		required: true,
		index: true
	},
	messageId: { type: String, required: false, index: true, unique: true, sparse: true }, // id from gateway
	deliveredAt: { type: Date, required: false },
	sendAt: { type: Date, required: false }
});

export const Message = mongoose.model('Message', MessageModel);

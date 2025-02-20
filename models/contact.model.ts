import mongoose from 'mongoose';

const ContactModel = new mongoose.Schema({
	createDate: { type: Date, default: Date.now },
	phoneNumber: { type: String, required: true, index: true },
	contactName: { type: String, required: false, index: true, sparse: true }
});

export const Contact = mongoose.model('Contact', ContactModel);

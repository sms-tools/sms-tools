type sseEvent = {
	contactID: string;
	messageID: string;
	event: 'send' | 'delivered' | 'failed' | 'recevied';
	status: sendEvent | deliveredEvent | failedEvent | receivedEvent;
};

type sendEvent = {
	userID: mongoose.Schema.ObjectId;
	message: string;
	sendAt: Date;
	contactName: string;
	phoneNumber: string;
};

type deliveredEvent = {
	deliveredAt: Date;
};

type failedEvent = {
	deliveredAt: Date;
};

type receivedEvent = {
	deliveredAt: Date;
	message: string;
	contactName: string;
	phoneNumber: string;
};

export { sseEvent, sendEvent, deliveredEvent, failedEvent, receivedEvent };

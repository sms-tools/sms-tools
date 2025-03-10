type sseEvent = {
	contactID: string;
	messageID: string;
	phoneNumber: string;
	event: 'send' | 'delivered' | 'failed' | 'recevied';
	status: sendEvent | deliveredEvent | failedEvent | receivedEvent;
};

type sendEvent = {
	userID: mongoose.Schema.ObjectId;
	message: string;
	sendAt: Date;
	contactName: string;
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
};

export { sseEvent, sendEvent, deliveredEvent, failedEvent, receivedEvent };

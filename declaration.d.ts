type sseEvent = {
	contactID: string;
	event: 'send' | 'delivered' | 'failed' | 'recevied';
	status: sendEvent | deliveredEvent | failedEvent;
};

type sendEvent = {
	userID: mongoose.Schema.ObjectId;
	message: String;
	sendAt: Date;
};

type deliveredEvent = {
	deliveredAt: Date;
};

type failedEvent = {
	deliveredAt: Date;
};

type receivedEvent = {
	deliveredAt: Date;
};

export { sseEvent, sendEvent, deliveredEvent, failedEvent, receivedEvent };

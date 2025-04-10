type sseEvent = {
	contactID: string;
	messageID: string;
	phoneNumber: string; // contract phone
	event: 'send' | 'delivered' | 'failed' | 'recevied' | 'pending' | 'queuing';
	status: sendEvent | deliveredEvent | failedEvent | receivedEvent | null; // null for pending and queuing
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

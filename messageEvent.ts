import { Message } from './models/message.model';
import { log } from './tools/log';

async function eventSent(messageId: string, sendAt: Date) {
	log(`Message sent`, 'INFO', __filename, messageId);
	await Message.findOneAndUpdate({ messageId }, { sendAt, status: 'sent' });
}
async function eventDelivered(messageId: string, deliveredAt: Date) {
	log(`Message delivered`, 'INFO', __filename, messageId);
	await Message.findOneAndUpdate({ messageId }, { deliveredAt, status: 'delivered' });
}
async function eventfailed(messageId: string, failedAt: Date, reason: string) {
	log(`Message failed`, 'INFO', __filename, { messageId, reason });
	await Message.findOneAndUpdate({ messageId }, { deliveredAt: failedAt, status: 'failed' });
}

export { eventSent, eventDelivered, eventfailed };

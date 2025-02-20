import { Contact } from '../models/contact.model';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';
import { log } from './log';
import { clearPhone, getOrCreateContact } from './tools';
class SmsSender {
	timeBetwenSend: number;
	pending: Array<{
		phoneNumber: String;
		message: string;
		messageObj: Promise<InstanceType<typeof Message>>;
		initiator?: string;
		status?: (status: 'errored' | 'pending' | 'queuing' | 'send') => void;
	}>;
	runing: boolean;
	constructor() {
		//android limitation for sms send
		// see https://www.xda-developers.com/change-sms-limit-android/
		this.timeBetwenSend = 2000;
		this.pending = [];
		this.runing = false;
	}

	private async sendMessage() {
		if (this.runing) return;
		while (this.pending && this.pending.length != 0) {
			const msg = this.pending.shift();
			if (!msg) {
				this.runing = false;
				return;
			}
			this.runing = true;

			const options = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization:
						'Basic ' + Buffer.from(`${process.env.SMS_USERNAME}:${process.env.PASSWORD}`).toString('base64')
				},
				body: JSON.stringify({
					message: msg?.message,
					phoneNumbers: [msg?.phoneNumber]
				})
			};
			const res = await (await fetch(process.env.GATEWAY_URL + '/message', options)).json();
			if (!res.id) {
				if (msg.status) msg.status('errored');
				log('Error sending message: ' + res, 'ERROR', __filename, msg.initiator);
			} else {
				await Message.findByIdAndUpdate((await msg.messageObj).id, { messageId: res.id });
				if (msg.status) msg.status('send');
				log(
					'Message sent',
					'INFO',
					__filename,
					{ message: msg.message, contact: msg.phoneNumber },
					msg.initiator
				);
			}

			this.runing = false;
			if (this.pending.length == 0) {
				return;
			}
			await new Promise(resolve => setTimeout(resolve, this.timeBetwenSend));
		}
	}

	async sendSms(
		contact: InstanceType<typeof Contact> | InstanceType<typeof User>,
		message: string,
		user?: InstanceType<typeof User>,
		initiator: string = 'root',
		status?: (status: 'errored' | 'pending' | 'queuing' | 'send') => void
	): Promise<InstanceType<typeof Message> | void> {
		const phone = clearPhone(contact.phoneNumber);
		if (!phone) {
			log('Bad phone:', 'ERROR', __filename, { message, contact }, initiator);
			return;
		}

		if (contact instanceof User) {
			const createdConact = await getOrCreateContact(contact.phoneNumber);
			if (!createdConact) {
				log('error in sending to user, no client created', 'ERROR', __filename, { contact, createdConact });
				return;
			}

			contact = createdConact;
		}
		if (status) status('pending');
		const messageObj = new Message({
			contactID: contact._id,
			message,
			direction: false,
			userID: user,
			initiator,
			status: 'pending'
		}).save();

		this.pending.push({ phoneNumber: phone, message, messageObj, status });
		if (status) status('queuing');
		if (!this.runing) this.sendMessage();
		return messageObj;
	}
}
export { SmsSender };

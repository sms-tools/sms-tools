import mongoose from 'mongoose';
import { SseSuscriber } from '..';
import { Contact } from '../models/contact.model';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';
import { log } from './log';
import { clearPhone, getOrCreateContact } from './tools';
import { sseEvent } from '../declaration';
class SmsSender {
	timeBetwenSend: number;
	pending: Array<{
		phoneNumber: String;
		message: string;
		messageObj: Promise<InstanceType<typeof Message>>;
		contact: InstanceType<typeof Contact>;
		initiator?: string;
		eventAction?: (event: 'failed' | 'pending' | 'queuing' | 'send') => void;
	}>;
	runing: boolean;
	constructor() {
		//android limitation for sms send
		// @see https://www.xda-developers.com/change-sms-limit-android/
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

			this.sendSSE(msg.messageObj, 'pending', msg.contact);

			//create request
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
			//send
			const res = await (await fetch(process.env.GATEWAY_URL + '/message', options)).json();
			if (!res.id) {
				this.sendSSE(msg.messageObj, 'failed', msg.contact, undefined, msg.eventAction);
				log('Error sending message: ' + res, 'ERROR', __filename, msg.initiator);
			} else {
				await Message.findByIdAndUpdate((await msg.messageObj).id, { messageId: res.id });
				log(
					'Message sent',
					'INFO',
					__filename,
					{ message: msg.message, contact: msg.phoneNumber },
					msg.initiator
				);
				this.sendSSE(msg.messageObj, 'send', msg.contact);
			}

			this.runing = false;
			if (this.pending.length == 0) {
				return;
			}
			await new Promise(resolve => setTimeout(resolve, this.timeBetwenSend, undefined, msg.eventAction));
		}
	}

	async sendSms(
		contact: InstanceType<typeof Contact> | InstanceType<typeof User>,
		message: string,
		user?: InstanceType<typeof User>,
		initiator: string = 'root',
		eventAction?: (event: 'failed' | 'pending' | 'queuing' | 'send') => void
	): Promise<InstanceType<typeof Message> | void> {
		//proprify phonenumber
		const phone = clearPhone(contact.phoneNumber);
		if (!phone) {
			log('Bad phone:', 'ERROR', __filename, { message, contact }, initiator);
			return;
		}
		//convert user to contact. all messsage are send to contact
		if (contact instanceof User) {
			const createdConact = await getOrCreateContact(contact.phoneNumber);
			if (!createdConact) {
				log('error in sending to user, no client created', 'ERROR', __filename, { contact, createdConact });
				return;
			}

			contact = createdConact;
		}
		const messageObj = new Message({
			contactID: contact._id,
			message,
			direction: false,
			userID: user,
			initiator,
			status: 'pending'
		}).save();

		//add to pending list
		this.pending.push({
			phoneNumber: phone,
			message,
			messageObj,
			contact: contact as InstanceType<typeof Contact>,
			eventAction
		});
		this.sendSSE(messageObj, 'queuing', contact as InstanceType<typeof Contact>, undefined, eventAction);
		// and lanch SendMessage
		if (!this.runing) this.sendMessage();
		return messageObj;
	}

	/**
	 * Sends an Server-Sent Event (SSE) to all user connected
	 *
	 * @async
	 * @param {Promise<InstanceType<typeof Message>>} messageObj - A promise that resolves to a message object.
	 * @param {'failed' | 'pending' | 'queuing' | 'send'} status - The current status of the message.
	 * @param {InstanceType<typeof Contact>} contact - The contact to send the event to.
	 * @param {typeof mongoose.Schema.ObjectId} [userID] - Optional user ID associated with the message.
	 */
	async sendSSE(
		messageObj: Promise<InstanceType<typeof Message>>,
		status: 'failed' | 'pending' | 'queuing' | 'send',
		contact: InstanceType<typeof Contact>,
		userID?: typeof mongoose.Schema.ObjectId,
		eventAction?: (event: 'failed' | 'pending' | 'queuing' | 'send') => void
	) {
		const message = await messageObj;
		if (!message || !message.contactID) return;
		const event: sseEvent = {
			contactID: message.contactID.toString(),
			messageID: message.id,
			phoneNumber: contact.phoneNumber,
			event: status,
			status: null
		};

		if (status === 'send') {
			event.status = {
				userID,
				message: message.message,
				sendAt: new Date(),
				contactName: contact.contactName ?? ''
			};
		}

		if (eventAction) {
			eventAction(status);
		} else {
			SseSuscriber.forEach(e => e(event));
		}
	}
}
export { SmsSender };

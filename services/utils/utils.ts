import { smsSender } from '../..';
import { Contact } from '../../models/contact.model';
import { User } from '../../models/user.model';
import { log } from '../../tools/log';
import { SmsSender } from '../../tools/sendSms';
import { IsPhoneNumber, bolderize, getOrCreateContact } from '../../tools/tools';
import ServicesClass from '../service';
import { UtilModel } from './utilData.model';

class Utils extends ServicesClass {
	constructor() {
		super();
		this.name = 'utils';
		this.description = 'many tools for sms';
		this.version = '1.0';
		this.type = 'command';
		this.commands = ['1z', '2z', '3z'];
	}
	async newMessage(user: InstanceType<typeof User>, message: string) {
		const Util_Action = (await UtilModel.findOne({ userID: user._id }, ['Util_Action']))?.Util_Action;
		if (Util_Action == 'sendat') {
			this.sendAt(user, message);
			return;
		}
		if (message == 'ping') {
			smsSender.sendSms(user, 'Pong!');
		} else if (message.startsWith('sendat')) {
			await UtilModel.updateOne(
				{ userID: user._id },
				{ Util_Action: 'sendat' },
				{ upsert: true, setDefaultsOnInsert: true }
			);
			message = message.replace('sendat ', '');
			this.sendAt(user, message);
		} else {
			smsSender.sendSms(
				user,
				`You have selected the ${bolderize('Util')} service. List of command:
${bolderize('ping')}: Reply pong
${bolderize('sendAt')}: Send a message to someone

${bolderize('home')}: Go back to the main menu`
			);
		}
	}

	private async sendAt(user: InstanceType<typeof User>, message: string) {
		const Util_recPhone = (await UtilModel.findOne({ userID: user._id }, ['Util_recPhone']))?.Util_recPhone;
		if (!Util_recPhone) {
			const messageSplit = message.split(' ');
			if (messageSplit.length >= 5) {
				messageSplit[0] = messageSplit.slice(0, 5).join(' ');
				messageSplit.splice(1, 4);
			}
			if (IsPhoneNumber(messageSplit[0])) {
				await UtilModel.updateOne(
					{ userID: user._id },
					{ Util_recPhone: messageSplit[0] },
					{ upsert: true, setDefaultsOnInsert: true }
				);
				messageSplit.shift();
				message = messageSplit.join(' ');
			} else {
				smsSender.sendSms(user, 'Send the phone number of the recipient');
				return;
			}
		}

		const Util_date = (await UtilModel.findOne({ userID: user._id }, ['Util_date']))?.Util_date;
		if (!Util_date) {
			if (message.trim() == '') {
				smsSender.sendSms(user, 'Select the date the message should be sent. eg: 20/12/23 23:28 or now');
				return;
			}
			const messageSplit = message.split(' ');
			let date = new Date();
			if (messageSplit[0] != 'now') {
				this.ConvertInMs(messageSplit[0] + ' ' + messageSplit[1]);
			}
			if (!date) {
				smsSender.sendSms(user, 'Invalid date, retry... eg: 20/12/23 23:28 or now');
				return;
			}
			if (date.getTime() - Date.now() < 0) {
				smsSender.sendSms(user, 'This date is in the past, try another one. eg: 20/12/23 23:28');
				return;
			}

			await UtilModel.updateOne(
				{ userID: user._id },
				{ Util_date: date },
				{ upsert: true, setDefaultsOnInsert: true }
			);
			messageSplit.shift();
			messageSplit.shift();
			message = messageSplit.join(' ');
		}

		const Util_Message = (await UtilModel.findOne({ userID: user._id }, ['Util_Message']))?.Util_Message;
		if (!Util_Message) {
			if (message.trim() != '') {
				await UtilModel.updateOne(
					{ userID: user._id },
					{ Util_Message: message.trim() },
					{ upsert: true, setDefaultsOnInsert: true }
				);
				const req = await UtilModel.findOne({ userID: user._id }, ['Util_recPhone', 'Util_date']);
				const Util_date = req?.Util_date;
				const Util_recPhone = req?.Util_recPhone;
				smsSender.sendSms(
					user,
					`You want to send: "${message.trim()}"
to the "${Util_recPhone}"
this messge will be sent at ${Util_date?.toLocaleString('en-GB')}

y/n`
				);
			} else {
				smsSender.sendSms(user, 'Send the message');
				return;
			}
			return;
		}

		if (message.toLowerCase() == 'y' || message.toLowerCase() == 'yes') {
			const req = await UtilModel.findOne({ userID: user._id }, ['Util_recPhone', 'Util_date', 'Util_Message']);
			const Util_date = req?.Util_date;
			const Util_recPhone = req?.Util_recPhone;
			const Util_Message = req?.Util_Message;
			const contact = await getOrCreateContact(Util_recPhone ?? '');
			if (Util_date?.getTime() ?? 0 - Date.now() < 0) {
				await this.send(contact, Util_Message ?? '', user, Util_recPhone, smsSender);
			} else {
				setTimeout(
					async () => await this.send(contact, Util_Message ?? '', user, Util_recPhone, smsSender),
					Util_date?.getTime() ?? 0 - Date.now()
				);
			}
		} else {
			await UtilModel.deleteOne({ userID: user._id });
			smsSender.sendSms(user, 'message aborted.');
			this.newMessage(user, '');
		}
	}

	private async send(
		contact: InstanceType<typeof Contact> | undefined,
		Util_Message: String,
		user: InstanceType<typeof User>,
		Util_recPhone: string | null | undefined,
		smsSender: SmsSender
	) {
		if (contact) {
			smsSender.sendSms(contact, Util_Message + '\n\n' + bolderize('This message is forwarded. Do not reply'));
			smsSender.sendSms(user, 'message send');
			await UtilModel.deleteOne({ userID: user._id });
			this.newMessage(user, '');
		} else {
			log('error on create contact', 'ERROR', __filename, { Util_recPhone, contact });
			smsSender.sendSms(user, 'error on send, contact administrator');
			await UtilModel.deleteOne({ userID: user._id });
			this.newMessage(user, '');
		}
	}

	private ConvertInMs(dateString: string): Date | undefined {
		if (!/^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(dateString)) return undefined;

		const [datePart, timePart] = dateString.split(' ');
		const [day, month, year] = datePart.split('/');
		const [hours, minutes] = timePart.split(':');

		const isoDateString = `20${year}-${month}-${day} ${hours}:${minutes}`;
		const dateObject = new Date(isoDateString);

		if (isNaN(dateObject.getTime())) {
			return undefined;
		}

		return dateObject;
	}
}

export default Utils;

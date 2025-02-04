import { Request, Response } from 'express';
import authenticate from '../authentificate';
import { SmsSender } from '../../../tools/sendSms';
import { checkParameters, clearPhone, getOrCreateContact, phoneNumberCheck } from '../../../tools/tools';
import { log } from '../../../tools/log';
import { smsSender } from '../../..';

async function sendSms(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (!user) return;

	if (
		!checkParameters(
			req.body,
			res,
			[
				['phone', 'string'],
				['message', 'string']
			],
			__filename
		)
	) {
		return;
	}

	const phone = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).json({ OK: false, message: 'bad phone number format' });
		log(`Invalid phone number format: ${req.body.phone}`, 'WARNING', __filename, {
			phone: req.body.phone,
			ip: req.hostname,
			user
		});
		return;
	}

	req.body.message = req.body.message.trim();
	if (req.body.message.length == 0) {
		res.status(400).json({ OK: false, message: 'message is empty. please dont send empty message' });
		log('message is empty', 'INFO', __filename, { message: req.body.message, user });
		return;
	}

	const contact = await getOrCreateContact(phone);
	if (!contact) {
		res.status(500).json({ OK: false, message: 'contact insertion failed' });
		log('contact insertion failed', 'ERROR', __filename, { contact, phone, user });
		return;
	}

	log('send message from api', 'INFO', __filename, { user, contact }, user.id);
	//no log, send sms log anyway
	const messageobj = await smsSender.sendSms(contact, req.body.message);
	if (!messageobj) {
		res.status(500).json({ OK: false, mesage: 'error in sending' });
	}
	res.status(200).json({ OK: true, mesage: 'mesage is sending', data: { message: messageobj } });
}

export default sendSms;

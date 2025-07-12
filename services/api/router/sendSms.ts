import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { smsSender } from '../../..';
import { Contact } from '../../../models/contact.model';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, getOrCreateContact, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';

async function sendSms(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (!user) return;

	if (
		!checkParameters(
			req.body,
			res,
			[
				['ContactID', 'ObjectId', true],
				['phoneNumber', 'string'],
				['message', 'string']
			],
			__filename
		)
	) {
		return;
	}

	let contact: InstanceType<typeof Contact> | undefined = undefined;

	if (!req.body.contactID && req.body.phoneNumber) {
		const phone = clearPhone(req.body.phoneNumber);
		if (!phoneNumberCheck(phone)) {
			log('Invalid phone number provided', 'WARNING', __filename, {}, user.id);
			return res.status(400).json({ OK: false, message: 'Invalid phone number' });
		}
		contact = await getOrCreateContact(phone);

		if (!contact || !contact._id) {
			log('Contact not found', 'WARNING', __filename, { phone }, user.id);
			return res.status(404).json({ OK: false, message: 'Contact not found' });
		}
	} else {
		contact = (await Contact.findOne({ _id: new mongoose.Types.ObjectId(`${req.body.ContactID}`) })) || undefined;
	}

	if (!contact) {
		log('Missing required parameters', 'WARNING', __filename, { phone: req.body.phoneNumber }, user.id);
		return res
			.status(400)
			.json({ OK: false, message: 'At least one of these parameters must be provided: ContactID, phoneNumber' });
	}

	req.body.message = req.body.message.trim();
	if (req.body.message.length == 0) {
		res.status(400).json({ OK: false, message: 'message is empty. please dont send empty message' });
		log('message is empty', 'INFO', __filename, { message: req.body.message, user });
		return;
	}

	if (!contact) {
		res.status(500).json({ OK: false, message: 'contact insertion failed' });
		log('contact insertion failed', 'ERROR', __filename, { contact, user }, user.id);
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

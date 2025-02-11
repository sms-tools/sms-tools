import { Request, Response } from 'express';
import { smsSender } from '../../..';
import { Contact } from '../../../models/contact.model';
import { User } from '../../../models/user.model';
import { log } from '../../../tools/log';
import { checkParameters, getContact, getOrCreateContact } from '../../../tools/tools';
import authenticate from '../authentificate';

async function sendManySms(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (!user) return;

	if (
		!checkParameters(
			req.body,
			res,
			[
				['createIfNotExist', 'boolean', true],
				['message', 'string']
			],
			__filename
		)
	)
		return;

	if (!Array.isArray(req.body['data'])) {
		res.status(400).send({ message: 'data must be an array', OK: false });
		log(`data must be an array`, 'WARNING', __filename, { user }, user.id);
		return;
	}

	const errors: Array<[string /*phone*/, string /*reason*/]> = [];
	const sleep: Array<Promise<boolean>> = req.body.data.map(async (usr: string | any) => {
		let contact: InstanceType<typeof Contact> | undefined;
		if (req.body.createIfNotExist != false) {
			contact = await getOrCreateContact(usr);
		} else {
			contact = await getContact(usr);
		}

		if (!contact) {
			errors.push([usr, 'not found']);
			return false;
		}

		smsSender.sendSms(contact, req.body.mesage, (await User.findById(user.id)) ?? undefined, user.id.toString());
	});

	await Promise.all(sleep);
	res.status(200).send({ message: 'OK', OK: true, errors: errors });
	log(req.body.data.length + ' sms send', 'INFO', __filename, { send: req.body.data, errors, user }, user.id);
}

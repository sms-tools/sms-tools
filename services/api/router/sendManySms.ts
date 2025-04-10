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
	//create sse header
	res.writeHead(200, {
		Connection: 'keep-alive',
		'Cache-Control': 'no-cache',
		'Content-Type': 'text/event-stream'
	});
	const sleep: Array<Promise<boolean>> = req.body.data.map(async (usr: [string, string]) => {
		let contact: InstanceType<typeof Contact> | undefined;
		if (req.body.createIfNotExist != false) {
			contact = await getOrCreateContact(usr[1], usr[0]);
		} else {
			contact = await getContact(usr[1]);
		}

		//create promise for await sent final status
		await new Promise(async resolve => {
			if (!contact) {
				//error is an final status
				res.write(`data: ${JSON.stringify({ phone: usr[1], status: 'failed' })}\n\n`, resolve);
				return false;
			}

			await smsSender.sendSms(
				contact,
				req.body.message,
				(await User.findById(user.id)) ?? undefined,
				user.id.toString(),
				async status => {
					//await send of new status
					await new Promise(async resolve => {
						res.write(`data: ${JSON.stringify({ phone: usr[1], status })}\n\n`, resolve);
					});
					if (status == 'failed' || status == 'send') {
						//if we have final status, request is end
						resolve(true);
					}
				}
			);
		});
	});

	await Promise.all(sleep);
	res.end();
	log(req.body.data.length + ' sms send', 'INFO', __filename, { send: req.body.data, errors, user }, user.id);
}

export default sendManySms;

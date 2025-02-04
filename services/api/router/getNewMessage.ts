import { Request, Response } from 'express';
import { Message } from '../../../models/message.model';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, getContact, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';
import { SseSuscriber } from '../../..';

async function getNewMessage(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (!user) return;

	if (
		!checkParameters(
			req.body,
			res,
			[
				['ContactID', 'ObjectId', true],
				['phoneNumber', 'string', true]
			],
			__filename
		)
	)
		return;

	let contactId = req.body.ContactID;

	if (!contactId && req.body.phoneNumber) {
		const phone = clearPhone(req.body.phoneNumber);
		if (!phoneNumberCheck(phone)) {
			log('Invalid phone number provided', 'WARNING', __filename, {}, user.id);
			return res.status(400).json({ OK: false, message: 'Invalid phone number' });
		}

		const contact = await getContact(phone);
		if (!contact || !contact._id) {
			log('Contact not found', 'WARNING', __filename, { phone }, user.id);
			return res.status(404).json({ OK: false, message: 'Contact not found' });
		}

		contactId = contact._id.toString();
	}

	if (!contactId) {
		log('Missing required parameters', 'WARNING', __filename, { phone: req.body.phoneNumber }, user.id);
		return res.status(400).send('At least one of these parameters must be provided: ContactID, phoneNumber');
	}

	// write header for sse
	res.writeHead(200, {
		Connection: 'keep-alive',
		'Cache-Control': 'no-cache',
		'Content-Type': 'text/event-stream'
	});
	log('Client connected to SSE', 'INFO', __filename, { contactId }, user.id);

	// aff callback to sse shared object
	const subscribers = SseSuscriber.get(contactId.toString()) || [];
	const sendMessage = (message: InstanceType<typeof Message>) => {
		try {
			res.write(`${JSON.stringify(message)}`);
		} catch (error) {
			log('Error sending SSE message', 'ERROR', __filename, { contactId, error }, user.id);
		}
	};
	subscribers.push(sendMessage);
	SseSuscriber.set(contactId.toString(), subscribers);

	// if client is desconected
	res.on('close', () => {
		log('Client disconnected from SSE', 'INFO', __filename, { contactId }, user.id);
		const updatedSubscribers = SseSuscriber.get(contactId.toString())?.filter(cb => cb !== sendMessage);
		if (updatedSubscribers?.length) {
			SseSuscriber.set(contactId.toString(), updatedSubscribers);
		} else {
			SseSuscriber.delete(contactId.toString());
		}
		res.end();
	});
}

export default getNewMessage;

import { Request, Response } from 'express';
import { SseSuscriber } from '../../..';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, getContact, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';
import { sseEvent } from '../../../declaration';

async function getNewEvent(req: Request<any>, res: Response<any>) {
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

	if (!contactId && !req.body.phoneNumber) {
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
	const id = Date.now().toString(36);
	const sendMessage = (event: sseEvent) => {
		try {
			res.write(`${JSON.stringify(event)}`);
		} catch (error) {
			log('Error sending SSE message', 'ERROR', __filename, { contactId, error }, user.id);
		}
	};
	SseSuscriber.set(id, sendMessage);

	// if client is desconected
	res.on('close', () => {
		log('Client disconnected from SSE', 'INFO', __filename, { contactId }, user.id);
		SseSuscriber.delete(id);
		res.end();
	});
}

export default getNewEvent;

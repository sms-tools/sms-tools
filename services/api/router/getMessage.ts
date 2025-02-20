import { Request, Response } from 'express';
import { Message } from '../../../models/message.model';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, getContact, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';

/**
 * Retrieves messages for a given contact by validating the request parameters and phone number.
 * If the parameters are valid, messages are fetched and a success response is returned.
 * If the parameters are invalid, an appropriate error response is returned.
 *
 * @param req - The request object containing the message query details.
 * @param res - The response object to send the result.
 *
 * @example
 * body: {
 *  "ContactID": "60d0fe4f5311236168a109ca",
 *  "phoneNumber": "+1234567890",
 *  "page": 1,
 *  "size": 50
 * }
 *
 * @throws {400} at least one of these two arguments must be provided: ContactID, phoneNumber
 * @throws {400} bad phone number
 * @throws {404} contact not found
 * @throws {418} to big request
 * @returns {200} messages retrieved successfully
 */
async function getMessage(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (
		!user ||
		!checkParameters(
			req.body,
			res,
			[
				['ContactID', 'ObjectId', true],
				['phoneNumber', 'string', true],
				['page', 'number', true],
				['size', 'number', true]
			],
			__filename
		)
	)
		return;
	if (req.body.size && req.body.size > 200) {
		log('too big querry', 'WARNING', __filename, { size: req.body.size }, user.id);
		res.status(418).send('to big request');
		return;
	}
	let contact = req.body.ContactID;

	if (!contact && !req.body.phoneNumber) {
		log('no mutch argument', 'WARNING', __filename, { size: req.body.size }, user.id);
		res.status(400).send('at least one of these two arguments must be provided: ContactID, phoneNumber');
		return;
	}

	if (!contact) {
		const phone = clearPhone(req.body.phoneNumber);
		if (!phoneNumberCheck(phone)) {
			log('bad contact phone number', 'WARNING', __filename, { size: req.body.size }, user.id);
			res.status(400).json({ OK: false, message: 'bad phone number' });
		}
		const contactPhone = await getContact(phone);
		if (!contactPhone || !contactPhone._id) {
			log('contact not found', 'WARNING', __filename, { size: req.body.size }, user.id);
			res.status(404).json({ OK: false, message: 'contact not found' });
			return;
		}
		contact = contactPhone._id.toString();
	}

	const msgList: Array<InstanceType<typeof Message>> = [];
	await Message.find({ contactID: { $eq: contact } }, null, {
		limit: req.body.size ?? 0,
		skip: req.body.page ?? 0 * req.body.size
	})
		.limit(req.body.size ?? 50)
		.sort({ date: 1 })
		.cursor()
		.eachAsync(msg => msgList.push(msg));
	log('user reqested ' + msgList.length + ' messages', 'INFO', __filename, { size: req.body.size }, user.id);
	res.status(200).send({ message: msgList.length + ' data send', data: msgList, OK: true });
}

export default getMessage;

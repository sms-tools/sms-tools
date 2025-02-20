import { Request, Response } from 'express';
import { checkParameters, clearPhone, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';
import { log } from '../../../tools/log';
import { Contact } from '../../../models/contact.model';

/**
 * Creates a new contact by validating the request parameters and phone number.
 * If the parameters are valid, a new contact is created and a success response is returned.
 * If the parameters are invalid, an appropriate error response is returned.
 *
 * @param req - The request object containing the contact details.
 * @param res - The response object to send the result.
 *
 * @example
 * body: {
 *  "ContactName": "John Doe",
 *  "phoneNumber": "+1234567890"
 * }
 *
 * @throws {400} invalid phone number
 * @throws {400} invalid contactName
 * @throws {500} error on request
 * @returns {200} contact created successfully
 */
async function createContact(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (
		!user ||
		!checkParameters(
			req.body,
			res,
			[
				['contactName', 'string', true],
				['phoneNumber', 'string', true]
			],
			__filename
		)
	)
		return;
	const phone = clearPhone(req.body.phoneNumber);
	if (!phoneNumberCheck(phone)) {
		res.status(400).json({ OK: false, message: 'invalid phone number' });
		log('invalid phone number', 'WARNING', __filename, { phone }, user.id);
		return;
	}
	if (req.body.contactName && req.body.contactName.trim() == '') {
		res.status(400).json({ OK: false, message: 'invalid contactName' });
		log('invalid contactName', 'WARNING', __filename, { contactName: req.body.contactName }, user.id);
		return;
	}

	const data = await Contact.create({ phoneNumber: phone, contactName: req.body.contactName });
	console.log(data);
	if (!data) {
		res.status(500).json({ OK: false, message: 'error on reqest' });
		log('error on reqest', 'ERROR', __filename, { contactAdded: data }, user.id);
		return;
	}

	res.json({ OK: true, message: 'conatct: ' + data.id + ' created', data });
	log('conatct: ' + data.id + ' created', 'INFO', __filename, null, user.id);
}

export default createContact;

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message } from '../../../models/message.model';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, getContact, phoneNumberCheck } from '../../../tools/tools';
import authenticate from '../authentificate';

async function ContactInfo(req: Request<any>, res: Response<any>) {
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
	const contactStats = await Message.aggregate([
		{
			$match: {
				contactID: new mongoose.Types.ObjectId(`${contactId}`)
			}
		},
		{
			$group: {
				_id: new mongoose.Types.ObjectId(`${contactId}`),
				nbMessageIn: {
					$sum: {
						$cond: [
							{
								$eq: ['$direction', true]
							},
							1,
							0
						]
					}
				},
				nbMessageOut: {
					$sum: {
						$cond: [
							{
								$eq: ['$direction', false]
							},
							1,
							0
						]
					}
				},
				timeForFirstMessage: {
					$min: '$date'
				},
				timeForLastMessage: {
					$max: '$date'
				},
				nbCharExchangedIn: {
					$sum: {
						$cond: [
							{
								$eq: ['$direction', true]
							},
							{ $strLenCP: '$message' },
							0
						]
					}
				},
				nbCharExchangedOut: {
					$sum: {
						$cond: [
							{
								$eq: ['$direction', false]
							},
							{ $strLenCP: '$message' },
							0
						]
					}
				}
			}
		},
		{
			$lookup: {
				from: 'contacts',
				localField: '_id',
				foreignField: '_id',
				as: 'contactInfo'
			}
		},
		{
			$unwind: {
				path: '$contactInfo',
				preserveNullAndEmptyArrays: true
			}
		},
		{
			$addFields: {
				createDate: '$contactInfo.createDate',
				contactName: '$contactInfo.contactName',
				contactPhoneNumber: '$contactInfo.phoneNumber'
			}
		},
		{
			$unset: 'contactInfo'
		}
	]);
	if (!contactStats) {
		res.status(400).json({ OK: false, message: 'contact not found' });
		log(`contact not found`, 'WARNING', __filename, { contactStats }, user.id);
	}

	log(`contact info send for user ${contactId}`, 'INFO', __filename, { contactStats }, user.id);
	return res.status(200).json({
		OK: true,
		contactID: contactId,
		...contactStats[0]
	});
}

export default ContactInfo;

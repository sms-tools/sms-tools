import { Request, Response } from 'express';
import { Message } from '../../../models/message.model';
import { log } from '../../../tools/log';
import { checkParameters } from '../../../tools/tools';
import authenticate from '../authentificate';

async function getContact(req: Request<any>, res: Response<any>) {
	const user = authenticate(req, res);
	if (
		!user ||
		!checkParameters(
			req.body,
			res,
			[
				['size', 'number', true],
				['page', 'number', true]
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

	const contacts = await Message.aggregate([
		{
			$sort: { date: -1 }
		},
		{
			$group: {
				_id: '$contactID',
				lastMessage: { $first: '$$ROOT' }
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
			$unwind: '$contactInfo'
		},
		{
			$project: {
				_id: 0,
				contactID: '$_id',
				contactName: '$contactInfo.contactName',
				phoneNumber: '$contactInfo.phoneNumber',
				message: '$lastMessage.message',
				date: '$lastMessage.date',
				senderID: '$lastMessage.senderID',
				direction: '$lastMessage.direction',
				status: '$lastMessage.status',
				deliveredAt: '$lastMessage.deliveredAt',
				sendAt: '$lastMessage.sendAt'
			}
		},
		{
			$sort: { lastMessageDate: -1 }
		}
	]);
	if (!contacts) {
		log('error in reqest', 'WARNING', __filename, { user }, user.id);
		res.status(500).send('error in request');
	}

	log(contacts.length + ' contact send to user', 'INFO', __filename, { user, contacts }, user.id);
	res.send(JSON.stringify(contacts));
}

export default getContact;

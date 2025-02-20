import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../../models/user.model';
import { checkParameters, clearPhone, phoneNumberCheck } from '../../../tools/tools';
import { log } from '../../../tools/log';
/**
 * Handles user login by verifying the provided phone number and password.
 * If the credentials are valid, a JWT token is generated and returned.
 * If the credentials are invalid, a 401 status code is returned.
 *
 * @example
 * body: {
 * 	"phone":string,
 * 	"password": string
 * }
 * @throws {401} invalid creantals
 * @throws {200} your token on json
 */
async function login(req: Request<any>, res: Response<any>) {
	if (
		!checkParameters(
			req.body,
			res,
			[
				['phone', 'string'],
				['password', 'string']
			],
			__filename
		)
	)
		return;
	const phoneNumber = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phoneNumber)) {
		res.status(400).json({ OK: false, message: 'bad phone number format' });
		log(`Invalid phone number format: ${req.body.phone}`, 'WARNING', __filename, {
			phone: req.body.phone,
			ip: req.hostname
		});
		return;
	}
	const password = req.body.password;
	const foundUser = await User.findOne({ phoneNumber: { $eq: phoneNumber }, password: { $eq: password } });
	if (foundUser) {
		const user = { id: foundUser._id, phoneNumber };
		const token = jwt.sign(user, process.env.privateJWTkey ?? 'error', { expiresIn: '1d' });
		const exp = new Date();
		exp.setHours(exp.getHours() + 24);
		res.json({ token, exp });
		log(`login for user ${user.id}`, 'INFO', __filename, {
			user,
			ip: req.hostname
		});
	} else {
		res.status(401).json({ OK: false, message: 'bad phone number or password' });
		log(`Failed login attempt for phone number: ${req.body.phone}`, 'WARNING', __filename, {
			phone: req.body.phone,
			ip: req.hostname
		});
	}
}

export default login;

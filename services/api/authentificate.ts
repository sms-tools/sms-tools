import jwt from 'jsonwebtoken';
import { log } from '../../tools/log';
import { Request, Response } from 'express';

function authenticate(
	req: Request<any>,
	res: Response<any>
):
	| {
			id: String;
			phoneNumber: String;
			iat: number;
			exp: number;
	  }
	| undefined {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		log('Acces denied', 'WARNING', __filename, { ip: req.hostname });
		res.status(401).send({ message: `Access denied`, OK: false });
		return undefined;
	}
	const usr:
		| {
				id: String;
				phoneNumber: String;
				iat: number;
				exp: number;
		  }
		| undefined = jwt.verify(token, process.env.privateJWTkey ?? 'error', (err, user) => {
		if (err) {
			log('invalid token', 'WARNING', __filename, { ip: req.hostname });
			res.status(401).send({ message: `invalid token`, OK: false });
			return undefined;
		}
		return user;
	}) as any;
	return usr;
}

export default authenticate;

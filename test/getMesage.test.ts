import { config } from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';
import getMessage from '../services/api/router/getMessage';
import login from '../services/api/router/login';

config();
const app = express();
app.use(express.json());
app.post('/login', login);
app.post('/getMessage', getMessage);
let token: String | undefined;
beforeAll(async () => {
	await mongoose.connect(process.env.BDD_URI_TEST ?? '');
	await User.deleteMany({});
	await Message.deleteMany({});
	await User.create({ username: 'loginTest', password: 'test', phoneNumber: '+33123456789', commandPermeted: true });
	token = (await request(app).post('/login').send({ phone: '+33123456789', password: 'test' })).body.token;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('POST /getMessage', () => {
	beforeEach(async () => {
		await Message.deleteMany({});
	});

	// it('should return messages for authenticated user', async () => {
	// 	const contact = await Contact.create({ id: 'clientPhone' });
	// 	await Message.create({ contactID: contact._id, text: 'Hello', sendAt: new Date() });
	// 	const response = await request(app)
	// 		.post('/getMessage')
	// 		.set('Authorization', `Bearer ${token}`)
	// 		.send({ clientID: 'clientPhone' });
	// 	expect(response.status).toBe(200);
	// 	expect(response.body).toHaveLength(1);
	// 	expect(response.body[0].text).toBe('Hello');
	// });
});

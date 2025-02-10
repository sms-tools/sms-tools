import { config } from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '..';
import { User } from '../models/user.model';

config();

beforeAll(async () => {
	await mongoose.connect(process.env.BDD_URI_TEST ?? '');
	await User.deleteMany({});
	await User.create({ username: 'loginTest', password: 'test', phoneNumber: '+33123456789', commandPermeted: true });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('POST /login', () => {
	it('should return a token for valid credentials', async () => {
		const response = await request(app).post('/login').send({ phone: '+33123456789', password: 'test' });

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('token');
	});

	it('should return 401 for invalid credentials', async () => {
		const response = await request(app).post('/login').send({ phone: '+33123456789', password: 'wrongPassword' });

		expect(response.status).toBe(401);
		expect(response.text).toBe('Invalid credentials');
	});
});

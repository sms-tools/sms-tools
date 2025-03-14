import { Express, Response } from 'express';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'path';
import { Contact } from '../models/contact.model';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';
import ServicesClass from '../services/service';
import { log } from './log';
import { SmsSender } from './sendSms';
/**
 * Converts the input text to a bold Unicode variant.
 *
 * This function takes a string and transforms each character into its bold Unicode equivalent,
 * if such an equivalent exists. It supports bold transformation for lowercase letters (a-z),
 * uppercase letters (A-Z), and digits (0-9). Characters outside these ranges are not transformed.
 *
 * @param text - The input string to be transformed.
 * @returns The transformed string with bold Unicode characters.
 */
function bolderize(text: string) {
	return text
		.split('')
		.map(char => {
			const code = char.codePointAt(0);

			if (typeof code == 'undefined') return char;

			if (code >= 97 && code <= 122) {
				// a-z
				return String.fromCodePoint(code + 120_205);
			} else if (code >= 65 && code <= 90) {
				// A-Z
				return String.fromCodePoint(code + 120_211);
			} else if (code >= 48 && code <= 57) {
				//0-9
				return String.fromCodePoint(code + 120_764);
			}
			return char;
		})
		.join('');
}

function IsPhoneNumber(number: any) {
	if (typeof number != 'string') return false;
	if (!number.match(/^(?:\+33|0)\s*[1-9](?:\s*\d{2}){4}$/)) return false;

	return true;
}

function getFileName(filename: string) {
	return filename?.split('\\')?.at(-1)?.split('/')?.at(-1) ?? 'error';
}

function clearPhone(phoneNumber: string): string {
	if (typeof phoneNumber != 'string') return '';
	phoneNumber = phoneNumber.trim();

	phoneNumber = phoneNumber.replaceAll(' ', '');
	phoneNumber = phoneNumber.replaceAll('.', '');
	phoneNumber = phoneNumber.replaceAll('-', '');
	phoneNumber = phoneNumber.replaceAll('o', '0');
	phoneNumber = phoneNumber.replaceAll('(', '');
	phoneNumber = phoneNumber.replaceAll(')', '');
	phoneNumber = phoneNumber.replaceAll('+33', '33');

	if (phoneNumber.startsWith('6') || phoneNumber.startsWith('7')) {
		phoneNumber = '0' + phoneNumber;
	}
	if (phoneNumber.startsWith('33') && phoneNumber.length == 11) {
		phoneNumber = '0' + phoneNumber.slice(2);
	}
	if (phoneNumber.length == 12 && phoneNumber.startsWith('06')) {
		phoneNumber = '+336' + phoneNumber.slice(2);
	}
	if (phoneNumber.startsWith('0')) {
		phoneNumber = phoneNumber.replace('0', '+33');
	}
	return phoneNumber;
}

function phoneNumberCheck(phone: string): boolean {
	if (typeof phone != 'string') return false;
	if (!phone.startsWith('+')) return false;

	const phoneArray = phone.split('');
	if (phone.length % 2 == 0) {
		phoneArray.splice(0, 3);
	} else {
		phoneArray.splice(0, 4);
	}
	phone = phoneArray.join('');
	if (phone.match(/^[0-9]{9}$/)) return true;
	return false;
}

/**
 * Get user by phone number
 * @warning This function dont log anything
 */
async function getUser(phoneNumber: string): Promise<InstanceType<typeof User> | undefined> {
	const user = await User.findOne({ phoneNumber: { $eq: phoneNumber } });
	if (!user) {
		return;
	}
	return user;
}

async function loadServices(expressServer: Express): Promise<Array<ServicesClass>> {
	const services: Array<ServicesClass> = [];
	const servicesDir = path.resolve(__dirname, '../services');

	try {
		//getting all subDirectory of servicesDir
		const serviceDirs = await fs.promises.readdir(servicesDir, { withFileTypes: true });
		const dirs = serviceDirs.filter(dir => dir.isDirectory());
		// charge all services
		for (const dir of dirs) {
			const servicePath = path.join(servicesDir, dir.name, dir.name + '.ts');
			try {
				//import class
				let module;
				if (isInTsxExecutor()) module = await import('file://' + servicePath);
				else module = await import(servicePath);
				if (module.default) {
					//if import default works
					services.push(new module.default());
				} else {
					log(`no class found on ${dir.name}`, 'ERROR', __filename);
				}
				//for router: check if this services have an router
				const routerPath = path.join(servicesDir, dir.name, 'routes.ts');
				if (fs.existsSync(routerPath)) {
					//import router file
					let router;
					if (isInTsxExecutor()) router = await import('file://' + routerPath);
					else router = await import(routerPath);
					if (router.default) {
						// use routes /name/helloWorld .
						expressServer.use('/' + dir.name, router.default());
						log(`new router added from ${routerPath} services`, 'INFO', __filename);
					} else {
						log(`no router found on ${routerPath}`, 'ERROR', __filename);
					}
				}
			} catch (error) {
				log(`error on import of ${dir.name}`, 'ERROR', __filename, { error });
			}
		}
	} catch (error) {
		log(`error on reading services`, 'CRITICAL', __filename, { error });
	}
	return services;
}

/**
 * Get contact by phone number
 * @warning This function dont log anything
 */
async function getContact(phoneNumber: string): Promise<InstanceType<typeof Contact> | undefined> {
	const contact = await Contact.findOne({ phoneNumber: { $eq: clearPhone(phoneNumber) } });
	if (!contact) {
		return;
	}
	return contact;
}
async function createContact(phoneNumber: string, name?: string): Promise<InstanceType<typeof Contact> | undefined> {
	const contact = await Contact.create({
		phoneNumber: clearPhone(phoneNumber),
		contactName: name
	});
	if (!contact) {
		log('error in creating client', 'WARNING', __filename);
		return;
	}
	return contact;
}

async function getOrCreateContact(
	phoneNumber: string,
	name?: string
): Promise<InstanceType<typeof Contact> | undefined> {
	let contact = await getContact(phoneNumber);
	if (!contact) contact = await createContact(phoneNumber, name);
	return contact;
}

/**
 * Check if the parameters are in the body
 * this fonction send response if result is false
 * pass Array of [string, type, bolean?]
 * 	string is the name of parameter
 * 	type is the type of parameters. if type is 'function' the function is executed, if she retrun true this parameters is not valid
 * 	bolean, this parameter is optional ? true is optional
 *
 * /!\ **dont use res** after this function. this fonction send response if result is false
 * @param body
 * @param res
 * @param parameters - Array of [string, type, bolean?] where the first string is the name of the parameter and the second is the type of the parameter, the third is optional and is a boolean to check if the parameter is optional
 * @param orgin
 * @returns boolean - true if all parameters are in the body, false if not. this fonction send response if result is false
 *
 * @throws 400 - Missing parameters body is empty
 * @throws 400 - Missing parameters ( first parameter missing)
 *
 * @version 2.2
 * @author [unelDev](https://github.com/unelDev)
 */
function checkParameters(
	body: any,
	res: Response<any>,
	parameters: Array<
		[
			string,
			(
				| 'string'
				| 'number'
				| 'bigint'
				| 'boolean'
				| 'symbol'
				| 'undefined'
				| 'object'
				| 'ObjectId'
				| ((params: String) => boolean)
			),
			// | 'array' dont work with array
			boolean?
		]
	>,
	orgin: string
): boolean {
	const ip = res.req.hostname;
	if (parameters.length == 0) return true;
	/*
	- if body is undefined
	- if body is empty
	- if all parameter is optional
	*/
	if (!body || (Object.keys(body).length == 0 && parameters.some(el => el[2] != true))) {
		res.status(400).send({ message: 'Missing parameters body is empty', OK: false });
		log(`Missing parameters body is empty from ` + ip, 'WARNING', orgin);
		return false;
	}
	for (let parameter of parameters) {
		// if the parameter is optional and parameter is not in body
		if (parameter[2] && !body[parameter[0]]) {
			continue;
		}

		//parameter is not in body
		if (body[parameter[0]] == undefined) {
			res.status(400).send({ message: `Missing parameters (${parameter.join(':')})`, OK: false });
			log(`Missing parameters (${parameter.join(':')}) from ` + ip, 'WARNING', orgin);
			return false;
		}

		const errorText = `Wrong type for parameter (${parameter[0]} is type: ${typeof body[
			parameter[0]
		]} but required type is ${parameter[1]})`;

		if (parameter[1] == 'number' && isNaN(parseInt(body[parameter[0]]))) {
			// if is nan return Missing parameters because NaN == undefined
			res.status(400).send({
				message: errorText,
				OK: false
			});
			log(errorText + ` from ` + ip, 'WARNING', orgin);
			return false;
		} else if (parameter[1] == 'ObjectId') {
			if (body[parameter[0]].length != 24) {
				res.status(400).send({
					message: errorText,
					OK: false
				});
				log(errorText + ` from ` + ip, 'WARNING', orgin);
				return false;
			}
			if (!mongoose.isValidObjectId(body[parameter[0]])) {
				res.status(400).send({
					message: errorText,
					OK: false
				});
				log(errorText + ` from ` + ip, 'WARNING', orgin);
				return false;
			}
		} else if (typeof parameter[1] == 'function') {
			//execute and the callback
			//if callback == true, return. error in parameter
			if (parameter[1](body[parameter[0]])) {
				log(errorText + ` from ` + ip, 'WARNING', orgin);
				res.status(400).send({
					message: errorText,
					OK: false
				});
				return false;
			}
		} else if (typeof body[parameter[0]] != parameter[1]) {
			//type is not same
			res.status(400).send({
				message: errorText,
				OK: false
			});
			log(errorText + ` from ` + ip, 'WARNING', orgin);
			return false;
		}
		// dont work for array
		// } else if (parameter[1] == 'array' && !Array.isArray(body[parameter[0]])) {
		// 	res.status(400).send({
		// 		message: errorText,
		// 		OK: false
		// 	});
		// 	log(errorText + ` from ` + ip, 'WARNING', orgin);
		// 	return false;
	}
	return true;
}

function isInTsxExecutor() {
	if (process?.execArgv?.at(3)?.includes('tsx') ?? false) return true;
	else return false;
}

export {
	bolderize,
	checkParameters,
	clearPhone,
	createContact,
	getContact,
	getFileName,
	getOrCreateContact,
	getUser,
	IsPhoneNumber,
	loadServices,
	phoneNumberCheck
};

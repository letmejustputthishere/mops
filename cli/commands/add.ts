import path from 'node:path';
import chalk from 'chalk';
import logUpdate from 'log-update';
import {checkConfigFile, getHighestVersion, parseGithubURL, readConfig, writeConfig} from '../mops.js';
import {installFromGithub} from '../vessel.js';
import {install} from './install.js';

export async function add(name: string, {verbose = false, dev = false} = {}) {
	if (!checkConfigFile()) {
		return;
	}

	let config = readConfig();
	if (dev) {
		if (!config['dev-dependencies']) {
			config['dev-dependencies'] = {};
		}
	}
	else {
		if (!config.dependencies) {
			config.dependencies = {};
		}
	}

	let pkgDetails: any;

	// local package
	if (name.startsWith('./') || name.startsWith('../') || name.startsWith('/')) {
		pkgDetails = {
			name: path.parse(name).name === '.' ? '_' : path.parse(name).name,
			path: name,
			repo: '',
			version: '',
		};
	}
	// github package
	else if (name.startsWith('https://github.com') || name.split('/').length > 1) {
		const {org, gitName, branch} = parseGithubURL(name);

		pkgDetails = {
			name: parseGithubURL(name).gitName,
			repo: `https://github.com/${org}/${gitName}#${branch}`,
			version: '',
		};
	}
	// mops package
	else {
		let ver: string;
		if (name.includes('@')) {
			// @ts-ignore
			[name, ver] = name.split('@');
		}
		else {
			let versionRes = await getHighestVersion(name);
			if ('err' in versionRes) {
				console.log(chalk.red('Error: ') + versionRes.err);
				return;
			}
			ver = versionRes.ok;
		}

		pkgDetails = {
			name: name,
			repo: '',
			version: ver,
		};
	}

	if (pkgDetails.repo) {
		await installFromGithub(pkgDetails.name, pkgDetails.repo, {verbose: verbose});
	}
	else if (!pkgDetails.path) {
		let ok = await install(pkgDetails.name, pkgDetails.version, {verbose: verbose});
		if (!ok) {
			return;
		}
	}

	const depsProp = dev ? 'dev-dependencies' : 'dependencies';
	let deps = config[depsProp];
	if (deps) {
		deps[pkgDetails.name] = pkgDetails;
	}
	else {
		throw Error(`Invalid config file: [${depsProp}] not found`);
	}
	writeConfig(config);

	logUpdate.clear();
	console.log(chalk.green('Package installed ') + `${pkgDetails.name} = "${pkgDetails.repo || pkgDetails.path || pkgDetails.version}"`);
}
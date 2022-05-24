import fs from 'fs';
import chalk from 'chalk';
import logUpdate from 'log-update';
import {Principal} from '@dfinity/principal';
import {globbySync} from 'globby';
import minimatch from 'minimatch';
import prompts from 'prompts';
import {checkConfigFile, getIdentity, mainActor, progressBar, readConfig} from '../mops.js';

export async function publish() {
	if (!checkConfigFile()) {
		return;
	}

	let config = readConfig();

	// validate
	for (let key of Object.keys(config)) {
		if (!['package', 'dependencies', 'permissions', 'scripts'].includes(key)) {
			console.log(chalk.red('Error: ') + `Unknown config section [${key}]`);
			return;
		}
	}

	// required fields
	if (!config.package) {
		console.log(chalk.red('Error: ') + 'Please specify [package] section in your mops.toml');
		return;
	}
	for (let key of ['name', 'version']) {
		if (!config.package[key]) {
			console.log(chalk.red('Error: ') + `Please specify "${key}" in [config] section in your mops.toml`);
			return;
		}
	}

	// desired fields
	for (let key of ['description', 'repository']) {
		if (!config.package[key]) {
			let res = await prompts({
				type: 'confirm',
				name: 'ok',
				message: `Missing recommended config key "${key}", publish anyway?`,
			});
			if (!res.ok) {
				return;
			}
		}
	}

	let packageKeys = [
		'name',
		'version',
		'keywords',
		'description',
		'repository',
		'documentation',
		'homepage',
		'readme',
		'license',
		'isPrivate',
		'files',
		'dfx',
		'moc',
		'donation',
	];
	for (let key of Object.keys(config.package)) {
		if (!packageKeys.includes(key)) {
			console.log(chalk.red('Error: ') + `Unknown config key 'package.${key}'`);
			return;
		}
	}

	// check lengths
	let keysMax = {
		name: 50,
		version: 20,
		keywords: 5,
		description: 200,
		repository: 300,
		documentation: 300,
		homepage: 300,
		readme: 100,
		license: 30,
		files: 20,
		dfx: 10,
		moc: 10,
		donation: 64,
	};

	for (let [key, max] of Object.entries(keysMax)) {
		if (config.package[key] && config.package[key].length > max) {
			console.log(chalk.red('Error: ') + `package.${key} value max length is ${max}`);
			return;
		}
	}

	if (config.package.dependencies && Object.keys(config.package.dependencies).length > 100) {
		console.log(chalk.red('Error: ') + 'max dependencies is 100');
		return;
	}

	if (config.package.permissions && Object.keys(config.package.permissions).length > 50) {
		console.log(chalk.red('Error: ') + 'max permissions is 50');
		return;
	}

	if (config.package.keywords) {
		for (let keyword of config.package.keywords) {
			if (keyword.length > 20) {
				console.log(chalk.red('Error: ') + 'max keyword length is 20');
				return;
			}
		}
	}

	if (config.package.files) {
		for (let file of config.package.files) {
			if (file.startsWith('/') || file.startsWith('../')) {
				console.log(chalk.red('Error: ') + 'file path cannot start with \'/\' or \'../\'');
				return;
			}
		}
	}

	// map fields
	let backendPkgConfig = {
		name: config.package.name,
		version: config.package.version,
		keywords: config.package.keywords || [],
		description: config.package.description || '',
		repository: config.package.repository || '',
		homepage: config.package.homepage || '',
		documentation: config.package.documentation || '',
		readme: 'README.md',
		license: config.package.license || '',
		isPrivate: false,
		owner: getIdentity()?.getPrincipal() || Principal.anonymous(),
		dfx: config.package.dfx || '',
		moc: config.package.moc || '',
		donation: config.package.donation || '',
		dependencies: (Object.entries(config.dependencies || {})).map(([name, version]) => {
			return {name, version};
		}),
		permissions: [],
		scripts: [],
	};

	let defaultFiles = [
		'mops.toml',
		'README.md',
		'LICENSE',
		'!.mops/**',
	];
	let files = config.package.files || ['**/*.mo'];
	files = [...files, ...defaultFiles];
	files = globbySync([...files, ...defaultFiles]);

	// check required files
	if (!files.includes('mops.toml')) {
		console.log(chalk.red('Error: ') + ' please add mops.toml file');
		return;
	}
	if (!files.includes('README.md')) {
		console.log(chalk.red('Error: ') + ' please add README.md file');
		return;
	}

	// check allowed exts
	for (let file of files) {
		if (!minimatch(file, '**/*.{mo,did,md,toml}')) {
			console.log(chalk.red('Error: ') + `file ${file} has unsupported extension. Allowed: .mo, .did, .md, .toml`);
			return;
		}
	}

	// progress
	let total = files.length + 2;
	let step = 0;
	function progress() {
		step++;
		logUpdate(`Publishing ${config.package.name}@${config.package.version} ${progressBar(step, total)}`);
	}

	// upload config
	progress();
	let actor = await mainActor();
	let publishing = await actor.startPublish(backendPkgConfig);
	if (publishing.err) {
		console.log(chalk.red('Error: ') + publishing.err);
		return;
	}
	let puiblishingId = publishing.ok;

	// upload files
	let parallel = async (threads, items, fn) => {
		return new Promise((resolve) => {
			let busyThreads = 0;
			items = items.slice();

			let loop = () => {
				if (!items.length) {
					if (busyThreads === 0) {
						resolve();
					}
					return;
				}
				if (busyThreads >= threads) {
					return;
				}
				busyThreads++;
				fn(items.shift()).then(() => {
					busyThreads--;
					loop();
				});
				loop();
			};
			loop();
		});
	};

	await parallel(8, files, async (file) => {
		progress();
		let content = fs.readFileSync(file);
		await actor.uploadFile(puiblishingId, file, Array.from(content));
	});

	// finish
	progress();
	await actor.finishPublish(puiblishingId);

	console.log(chalk.green('Published ') + `${config.package.name}@${config.package.version}`);
}
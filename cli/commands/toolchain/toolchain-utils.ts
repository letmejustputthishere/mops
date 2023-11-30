import path from 'node:path';
import fs from 'fs-extra';
import decompress from 'decompress';
import decompressTarxz from 'decomp-tarxz';
import {deleteSync} from 'del';
import {Octokit} from 'octokit';
import tar from 'tar';

import {getRootDir} from '../../mops.js';

export let downloadGithubRelease = async (url: string, dest: string) => {
	let res = await fetch(url);

	if (res.status !== 200) {
		console.error(`ERROR ${res.status} ${url}`);
		process.exit(1);
	}

	let arrayBuffer = await res.arrayBuffer();
	let buffer = Buffer.from(arrayBuffer);

	let tmpDir = path.join(getRootDir(), '.mops', '_tmp');
	let archive = path.join(tmpDir, path.basename(url));

	fs.mkdirSync(tmpDir, {recursive: true});
	fs.writeFileSync(archive, buffer);

	fs.mkdirSync(dest, {recursive: true});

	if (archive.endsWith('.xz')) {
		await decompress(archive, dest, {
			strip: 1,
			plugins: [decompressTarxz()],
		}).catch(() => {
			deleteSync([tmpDir]);
		});
	}
	else {
		await tar.extract({
			file: archive,
			cwd: dest,
		});
	}

	deleteSync([tmpDir], {force: true});
};

export let getLatestReleaseTag = async (repo: string): Promise<string | undefined> => {
	let releases = await getReleases(repo);
	let release = releases.find((release: any) => !release.prerelease && !release.draft);
	return release?.tag_name;
};

export let getReleases = async (repo: string) => {
	let octokit = new Octokit;
	let res = await octokit.request(`GET /repos/${repo}/releases`, {
		per_page: 10,
		headers: {
			'X-GitHub-Api-Version': '2022-11-28'
		}
	});
	if (res.status !== 200) {
		console.log('Releases fetch error');
		process.exit(1);
	}
	return res.data;
};
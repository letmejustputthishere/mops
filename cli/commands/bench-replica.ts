import {execSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {execaCommand} from 'execa';
import {PocketIc} from '@hadronous/pic';
import {getRootDir} from '../mops.js';
import {createActor, idlFactory} from '../declarations/bench/index.js';

export class BenchReplica {
	mode : 'dfx' | 'pocket-ic';
	verbose = false;
	canisters: Record<string, {cwd: string; canisterId: string; actor: any;}> = {};
	pocketIc?: PocketIc;

	constructor(mode: 'dfx' | 'pocket-ic', verbose = false) {
		this.mode = mode;
		this.verbose = verbose;
	}

	async start() {
		console.log(`Starting ${this.mode} replica...`);

		if (this.mode == 'dfx') {
			await this.stop();
			let dir = path.join(getRootDir(), '.mops/.bench');
			fs.writeFileSync(path.join(dir, 'dfx.json'), JSON.stringify(this.dfxJson(''), null, 2));
			execSync('dfx start --background --clean --artificial-delay 0' + (this.verbose ? '' : ' -qqqq'), {cwd: dir, stdio: ['inherit', this.verbose ? 'inherit' : 'ignore', 'inherit']});
		}
		else {
			this.pocketIc = await PocketIc.create();
		}
	}

	async stop() {
		if (this.mode == 'dfx') {
			let dir = path.join(getRootDir(), '.mops/.bench');
			execSync('dfx stop' + (this.verbose ? '' : ' -qqqq'), {cwd: dir, stdio: ['pipe', this.verbose ? 'inherit' : 'ignore', 'pipe']});
		}
		else if (this.pocketIc) {
			this.pocketIc.tearDown();
		}
	}

	async deploy(name: string, wasm: string, cwd: string = process.cwd()) {
		if (this.mode === 'dfx') {
			await execaCommand(`dfx deploy ${name} --mode reinstall --yes --identity anonymous`, {cwd, stdio: this.verbose ? 'pipe' : ['pipe', 'ignore', 'pipe']});
			let canisterId = execSync(`dfx canister id ${name}`, {cwd}).toString().trim();
			let actor = await createActor(canisterId, {
				agentOptions: {
					host: 'http://127.0.0.1:4944',
				},
			});
			this.canisters[name] = {cwd, canisterId, actor};
		}
		else if (this.pocketIc) {
			let {canisterId, actor} = await this.pocketIc.setupCanister(idlFactory, wasm);
			this.canisters[name] = {
				cwd,
				canisterId: canisterId.toText(),
				actor,
			};
		}
	}

	getActor(name: string): unknown {
		return this.canisters[name]?.actor;
	}

	getCanisterId(name: string): string {
		return this.canisters[name]?.canisterId || '';
	}

	dfxJson(canisterName: string) {
		let canisters: Record<string, any> = {};
		if (canisterName) {
			canisters[canisterName] = {
				type: 'custom',
				wasm: 'canister.wasm',
				candid: 'canister.did',
			};
		}

		return {
			version: 1,
			canisters,
			defaults: {
				build: {
					packtool: 'mops sources',
				},
			},
			networks: {
				local: {
					type: 'ephemeral',
					bind: '127.0.0.1:4944',
				},
			},
		};
	}
}

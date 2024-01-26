import path from 'node:path';
import fs from 'node:fs';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {defineConfig} from 'vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import dfxJson from '../dfx.json';

type Network = 'ic' | 'local' | 'staging';
let network = process.env['DFX_NETWORK'] as Network || 'local';

interface CanisterIds {
	/* eslint-disable-next-line no-unused-vars */
	[key : string] : {[key in Network] : string}
}

let canisterIds : CanisterIds;
try {
	canisterIds = JSON.parse(
		fs.readFileSync(network === 'local' ? '../.dfx/local/canister_ids.json' : '../canister_ids.json').toString(),
	);
}
catch (e) {
	console.error('\n⚠️  Before starting the dev server run: dfx deploy\n\n');
}

// Generate canister ids, required by the generated canister code in .dfx/local/declarations/*
// This strange way of JSON.stringifying the value is required by vite
const canisterDefinitions = Object.entries(canisterIds).reduce((acc, [key, val]) => ({
	...acc,
	[`process.env.${key.toUpperCase()}_CANISTER_ID`]: JSON.stringify(val[network as Network]),
	[`process.env.CANISTER_ID_${key.toUpperCase()}`]: JSON.stringify(val[network as Network]),
}), {});

// List of all aliases for canisters
// This will allow us to: import {canisterName} from "canisters/canisterName"
const aliases = Object.entries(dfxJson.canisters).reduce(
	/* eslint-disable-next-line no-unused-vars */
	(acc, [name, _value]) => {
		// Get the network name, or `local` by default.
		const networkName = network || 'local';
		const outputRoot = path.join(__dirname, '.dfx', networkName, 'canisters', name);

		return {
			...acc,
			['canisters/' + name]: path.join(outputRoot, 'index' + '.js'),
		};
	},
	{},
);

// Gets the port dfx is running on from dfx.json
const DFX_PORT = '4943';

// See guide on how to configure Vite at:
// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		svelte(),
		viteStaticCopy({
			targets: [
				{
					src: 'external/*',
					dest: 'external'
				},
				{
					src: '.ic-assets.json',
					dest: '.'
				},
				{
					src: '.well-known/*',
					dest: '.well-known'
				},
			]
		}),
	],
	build: {
		target: ['es2020'],
		lib: {
			entry: './index.html',
			formats: ['es'],
		},
		rollupOptions: {
			external: ['img', 'external'],
			output: {
				entryFileNames: 'bundle/[name]-[hash:20].js',
				chunkFileNames: 'bundle/[name]-[hash:20].js',
				assetFileNames: 'bundle/[name]-[hash:20].[ext]',
			}
		},
	},
	resolve: {
		alias: {
			// Here we tell Vite the "fake" modules that we want to define
			...aliases,
		},
	},
	server: {
		watch: {
			usePolling: true,
		},
		fs: {
			allow: ['.'],
		},
		proxy: {
			// This proxies all http requests made to /api to our running dfx instance
			'/api': {
				// target: 'https://icp-api.io/',
				target: `http://127.0.0.1:${DFX_PORT}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '/api'),
			},
		},
	},
	define: {
		// Here we can define global constants
		// This is required for now because the code generated by dfx relies on process.env being set
		...canisterDefinitions,
		'process.env.DFX_NETWORK': JSON.stringify(process.env.DFX_NETWORK === 'local' ? 'local' : 'ic'),
		'process.env.NODE_ENV': JSON.stringify(
			network === 'local' ? 'development' : 'production',
		),
	},
});
export type Config = {
	package?: {
		name: string;
		version: string;
		description?: string;
		license?: string;
		repository?: string;
		keywords?: string[];
		baseDir?: string;
		readme?: string;
		files?: string[];
		homepage?: string;
		documentation?: string;
		dfx?: string;
		moc?: string;
		donation?: string;
	};
	dependencies?: Dependencies;
	'dev-dependencies'?: Dependencies;
};

export type Dependencies = Record<string, Dependency>;

export type Dependency = {
	name: string;
	version?: string; // mops package
	repo?: string; // github package
	path?: string; // local package
}
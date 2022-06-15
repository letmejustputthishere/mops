import Text "mo:base/Text";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import TrieMap "mo:base/TrieMap";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Result "mo:base/Result";
import Debug "mo:base/Debug";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
// import {hello} "mo:utils/test";

import Utils "../utils";
import Version "./version";
import Types "./types";
import {validateConfig} "./validate-config";
import DownloadLog "./download-log";
import StorageManager "../storage/storage-manager";
import Storage "../storage/storage-canister";
import {generateId} "../generate-id";

actor {
	public type PackageName = Text.Text; // lib
	public type PackageId = Text.Text; // lib@1.2.3
	public type Err = Text.Text;
	public type Dependency = Types.Dependency;
	public type Access = Types.Access;
	public type PackageConfig = Types.PackageConfig;
	public type PackagePublication = Types.PackagePublication;
	public type PackageDetails = Types.PackageDetails;

	let apiVersion = "0.1"; // (!) make changes in pair with cli

	var packageVersions = TrieMap.TrieMap<PackageName, [Version.Version]>(Text.equal, Text.hash);
	var packageOwners = TrieMap.TrieMap<PackageName, Principal>(Text.equal, Text.hash);
	var highestConfigs = TrieMap.TrieMap<PackageName, PackageConfig>(Text.equal, Text.hash);

	var packageConfigs = TrieMap.TrieMap<PackageId, PackageConfig>(Text.equal, Text.hash);
	var packagePublications = TrieMap.TrieMap<PackageId, PackagePublication>(Text.equal, Text.hash);
	var fileIdsByPackage = TrieMap.TrieMap<PackageId, [FileId]>(Text.equal, Text.hash);

	let downloadLog = DownloadLog.DownloadLog();
	let storageManager = StorageManager.StorageManager();

	// publish
	type PublishingId = Text.Text;
	type PublishingErr = Err;
	type PublishingPackage = {
		time: Time.Time;
		user: Principal;
		config: PackageConfig;
		storage: Principal;
	};
	public type FileId = Text.Text;
	public type PublishingFile = {
		id: FileId;
		path: Text.Text;
	};
	let publishingPackages = TrieMap.TrieMap<PublishingId, PublishingPackage>(Text.equal, Text.hash);
	let publishingFiles = TrieMap.TrieMap<PublishingId, Buffer.Buffer<PublishingFile>>(Text.equal, Text.hash);


	// PRIVATE
	func _getHighestVersion(name: PackageName): ?Version.Version {
		let versionsMaybe = packageVersions.get(name);
		if (Option.isSome(versionsMaybe)) {
			let versions = Utils.unwrap(versionsMaybe);
			let verSorted = Array.sort(versions, Version.compare);

			if (verSorted.size() != 0) {
				return ?verSorted[verSorted.size() - 1];
			};
		};
		return null;
	};

	func _resolveVersion(name: PackageName, version: Version.Version): Version.Version {
		if (version == "highest") {
			Utils.expect(_getHighestVersion(name), "Package '" # name # "' not found");
		}
		else {
			version;
		};
	};

	func _updateHighestConfig(config: PackageConfig) {
		switch (_getHighestVersion(config.name)) {
			case (?ver) {
				if (Version.compare(config.version, ver) == #greater) {
					highestConfigs.put(config.name, config);
				};
			};
			case (null) {
				highestConfigs.put(config.name, config);
			};
		}
	};

	func _getPackageDetails(name: PackageName, version: Version.Version): PackageDetails {
		let packageId = name # "@" # version;
		let config = Utils.expect(packageConfigs.get(name # "@" # version), "Package '" # packageId # "' not found");
		let publication = Utils.expect(packagePublications.get(packageId), "Publication not found for package " # packageId);

		return {
			owner = Option.get(packageOwners.get(config.name), Utils.anonymousPrincipal());
			config = config;
			publication = publication;
			downloadsInLast30Days = 0;
			downloadsTotal = 0;
		}
	};


	// PUBLIC
	public shared ({caller}) func startPublish(config: PackageConfig): async Result.Result<PublishingId, PublishingErr> {
		assert(Utils.isAuthorized(caller));

		// validate config
		switch (validateConfig(config)) {
			case (#ok()) {};
			case (#err(err)) {
				return #err(err);
			};
		};

		// check permissions
		switch (packageOwners.get(config.name)) {
			case (null) {};
			case (?owner) {
				if (owner != caller) {
					return #err("You don't have permissions to publish this package");
				};
			};
		};

		// check if the same version is published
		switch (packageVersions.get(config.name)) {
			case (?versions) {
				let sameVersionOpt = Array.find<Version.Version>(versions, func(ver: Version.Version) {
					ver == config.version;
				});
				if (sameVersionOpt != null) {
					return #err(config.name # "@" # config.version # " already published");
				};
			};
			case (null) {};
		};

		// check dependencies
		for (dep in config.dependencies.vals()) {
			let packageId = dep.name # "@" # dep.version;
			if (packageConfigs.get(packageId) == null) {
				return #err("Dependency " # packageId # " not found in registry");
			};
		};

		let publishingId = await generateId();

		if (publishingPackages.get(publishingId) != null) {
			return #err("Already publishing");
		};

		await storageManager.ensureUploadableStorages();

		// start
		publishingPackages.put(publishingId, {
			time = Time.now();
			user = caller;
			config = config;
			storage = storageManager.getStorageForUpload();
		});
		publishingFiles.put(publishingId, Buffer.Buffer(10));

		#ok(publishingId);
	};

	public shared ({caller}) func startFileUpload(publishingId: PublishingId, path: Text.Text, chunkCount: Nat, firstChunk: Blob): async Result.Result<FileId, Err> {
		assert(Utils.isAuthorized(caller));

		let publishing = Utils.expect(publishingPackages.get(publishingId), "Publishing package not found");
		assert(publishing.user == caller);

		let pubFiles = Utils.expect(publishingFiles.get(publishingId), "Publishing files not found");
		assert(pubFiles.size() < 100);

		let moMd = Text.endsWith(path, #text(".mo")) or Text.endsWith(path, #text(".md"));
		let didToml = Text.endsWith(path, #text(".did")) or Text.endsWith(path, #text(".toml"));
		let license = Text.endsWith(path, #text("LICENSE")) or Text.endsWith(path, #text("LICENSE.md")) or Text.endsWith(path, #text("license"));
		if (not (moMd or didToml or license)) {
			Debug.trap("File " # path # " has unsupported extension. Allowed: .mo, .md, .did, .toml");
		};

		let fileId = publishing.config.name # "@" # publishing.config.version # "/" # path;

		ignore await storageManager.startUpload(publishing.storage, {
			id = fileId;
			path = path;
			chunkCount = chunkCount;
			owners = [];
		});

		if (chunkCount != 0) {
			ignore await storageManager.uploadChunk(publishing.storage, fileId, 0, firstChunk);
		};

		let pubFile: PublishingFile = {
			id = fileId;
			path = path;
		};
		pubFiles.add(pubFile);

		#ok(fileId);
	};

	public shared ({caller}) func uploadFileChunk(publishingId: PublishingId, fileId: FileId, chunkIndex: Nat, chunk: Blob): async Result.Result<(), Err> {
		let publishing = Utils.expect(publishingPackages.get(publishingId), "Publishing package not found");
		assert(publishing.user == caller);

		await storageManager.uploadChunk(publishing.storage, fileId, chunkIndex, chunk);
	};

	public shared ({caller}) func finishPublish(publishingId: PublishingId): async Result.Result<(), Err> {
		assert(Utils.isAuthorized(caller));

		let publishing = Utils.expect(publishingPackages.get(publishingId), "Publishing package not found");
		assert(publishing.user == caller);

		let packageId = publishing.config.name # "@" # publishing.config.version;
		let pubFiles = Utils.expect(publishingFiles.get(publishingId), "Publishing files not found");

		var mopsToml = false;
		var readmeMd = false;

		for (file in pubFiles.vals()) {
			if (file.path == "mops.toml") {
				mopsToml := true;
			};
			if (file.path == "README.md") {
				readmeMd := true;
			};
		};

		if (not mopsToml) {
			return #err("Missing required file mops.toml");
		};
		if (not readmeMd) {
			return #err("Missing required file README.md");
		};

		let fileIds = Array.map(pubFiles.toArray(), func(file: PublishingFile): Text.Text {
			file.id;
		});

		let res = await storageManager.finishUploads(publishing.storage, fileIds);
		if (Result.isErr(res)) {
			return res;
		};

		fileIdsByPackage.put(packageId, fileIds);

		let versions = Option.get(packageVersions.get(publishing.config.name), []);
		packageVersions.put(publishing.config.name, Array.append(versions, [publishing.config.version]));

		packageConfigs.put(packageId, publishing.config);
		packageOwners.put(publishing.config.name, caller);
		highestConfigs.put(publishing.config.name, publishing.config);
		packagePublications.put(packageId, {
			user = caller;
			time = Time.now();
			storage = publishing.storage;
		});

		publishingFiles.delete(publishingId);
		publishingPackages.delete(publishingId);

		#ok();
	};


	// QUERY
	public shared query ({caller}) func getApiVersion(): async Text.Text {
		apiVersion;
	};

	// TODO: return Result
	public shared query ({caller}) func getHighestVersion(name: PackageName): async Version.Version {
		Utils.expect(_getHighestVersion(name), "Package '" # name # "' not found");
	};

	// TODO: return Result
	public shared query ({caller}) func getPackageDetails(name: PackageName, version: Version.Version): async PackageDetails {
		var ver = _resolveVersion(name, version);
		_getPackageDetails(name, ver);
	};

	// TODO: return Result
	public shared query ({caller}) func getFileIds(name: PackageName, version: Version.Version): async [FileId] {
		let packageId = name # "@" # version;
		Utils.expect(fileIdsByPackage.get(packageId), "Package '" # packageId # "' not found");
	};

	public shared ({caller}) func notifyInstall(name: PackageName, version: Version.Version) {
		let packageId = name # "@" # version;

		ignore Utils.expect(packageConfigs.get(packageId), "Package not found");

		downloadLog.add({
			time = Time.now();
			name = name;
			version = version;
			downloader = caller;
		});
	};

	public query func search(searchText: Text.Text): async [PackageDetails] {
		let max = 20;
		let matchedConfigs = Buffer.Buffer<PackageConfig>(max);
		let pattern = #text(searchText);

		for (config in highestConfigs.vals()) {
			if (Text.contains(config.name, pattern) or Text.contains(config.description, pattern)) {
				matchedConfigs.add(config);
			};
		};

		var configs = Array.sort<PackageConfig>(matchedConfigs.toArray(), func(a, b) {
			var aPoints = 0;
			var bPoints = 0;

			if (Text.contains(a.name, pattern)) aPoints += 10;
			if (Text.contains(b.name, pattern)) bPoints += 10;

			if (a.name.size() < b.name.size()) aPoints += 1;
			if (a.name.size() > b.name.size()) bPoints += 1;

			Nat.compare(bPoints, aPoints);
		});

		// limit results
		Array.tabulate<PackageDetails>(Nat.min(configs.size(), max), func(i: Nat) {
			_getPackageDetails(configs[i].name, configs[i].version);
		});
	};

	public query func getRecentlyUpdatedPackages(): async [PackageDetails] {
		let max = 5;
		let packagesDetails = Buffer.Buffer<PackageDetails>(max);

		let pubsReversed = Array.reverse(Iter.toArray(packagePublications.keys()));

		label l for (packageId in pubsReversed.vals()) {
			switch (packageConfigs.get(packageId)) {
				case (?config) {
					packagesDetails.add(_getPackageDetails(config.name, config.version));

					if (packagesDetails.size() >= max) {
						break l;
					};
				};
				case (null) {};
			};
		};

		packagesDetails.toArray();
	};

	public query func getStoragesStats(): async [(StorageManager.StorageId, StorageManager.StorageStats)] {
		storageManager.getStoragesStats();
	};


	// SYSTEM
	stable var packagePublicationsStable: [(PackageId, PackagePublication)] = [];
	stable var packageVersionsStable: [(PackageName, [Version.Version])] = [];
	stable var packageOwnersStable: [(PackageName, Principal)] = [];
	stable var packageConfigsStable: [(PackageId, PackageConfig)] = [];
	stable var highestConfigsStable: [(PackageName, PackageConfig)] = [];

	stable var fileIdsByPackageStable: [(PackageId, [FileId])] = [];

	stable var downloadLogStable: DownloadLog.Stable = null;
	stable var storageManagerStable: StorageManager.Stable = null;


	system func preupgrade() {
		highestConfigsStable := Iter.toArray(highestConfigs.entries());
		packagePublicationsStable := Iter.toArray(packagePublications.entries());
		packageVersionsStable := Iter.toArray(packageVersions.entries());
		packageOwnersStable := Iter.toArray(packageOwners.entries());
		packageConfigsStable := Iter.toArray(packageConfigs.entries());
		fileIdsByPackageStable := Iter.toArray(fileIdsByPackage.entries());
		downloadLogStable := downloadLog.toStable();
		storageManagerStable := storageManager.toStable();
	};

	system func postupgrade() {
		highestConfigs := TrieMap.fromEntries<PackageName, PackageConfig>(highestConfigsStable.vals(), Text.equal, Text.hash);
		highestConfigsStable := [];

		packagePublications := TrieMap.fromEntries<PackageId, PackagePublication>(packagePublicationsStable.vals(), Text.equal, Text.hash);
		packagePublicationsStable := [];

		packageVersions := TrieMap.fromEntries<PackageName, [Version.Version]>(packageVersionsStable.vals(), Text.equal, Text.hash);
		packageVersionsStable := [];

		packageOwners := TrieMap.fromEntries<PackageName, Principal>(packageOwnersStable.vals(), Text.equal, Text.hash);
		packageOwnersStable := [];

		packageConfigs := TrieMap.fromEntries<PackageId, PackageConfig>(packageConfigsStable.vals(), Text.equal, Text.hash);
		packageConfigsStable := [];

		fileIdsByPackage := TrieMap.fromEntries<PackageId, [FileId]>(fileIdsByPackageStable.vals(), Text.equal, Text.hash);
		fileIdsByPackageStable := [];

		downloadLog.loadStable(downloadLogStable);
		downloadLogStable := null;

		storageManager.loadStable(storageManagerStable);
		storageManagerStable := null;
	};
};
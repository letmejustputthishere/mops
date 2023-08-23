import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface DependencyV2 {
  'name' : PackageName,
  'repo' : string,
  'version' : string,
}
export interface DownloadsSnapshot {
  'startTime' : Time,
  'endTime' : Time,
  'downloads' : bigint,
}
export interface DownloadsSnapshot__1 {
  'startTime' : Time,
  'endTime' : Time,
  'downloads' : bigint,
}
export type Err = string;
export type FileId = string;
export interface PackageConfigV2 {
  'dfx' : string,
  'moc' : string,
  'scripts' : Array<Script>,
  'baseDir' : string,
  'documentation' : string,
  'name' : PackageName,
  'homepage' : string,
  'description' : string,
  'version' : string,
  'keywords' : Array<string>,
  'donation' : string,
  'devDependencies' : Array<DependencyV2>,
  'repository' : string,
  'dependencies' : Array<DependencyV2>,
  'license' : string,
  'readme' : string,
}
export interface PackageConfigV2__1 {
  'dfx' : string,
  'moc' : string,
  'scripts' : Array<Script>,
  'baseDir' : string,
  'documentation' : string,
  'name' : PackageName,
  'homepage' : string,
  'description' : string,
  'version' : string,
  'keywords' : Array<string>,
  'donation' : string,
  'devDependencies' : Array<DependencyV2>,
  'repository' : string,
  'dependencies' : Array<DependencyV2>,
  'license' : string,
  'readme' : string,
}
export interface PackageDetails {
  'ownerInfo' : User,
  'owner' : Principal,
  'deps' : Array<PackageSummary__1>,
  'testStats' : TestStats__1,
  'downloadsTotal' : bigint,
  'downloadsInLast30Days' : bigint,
  'downloadTrend' : Array<DownloadsSnapshot>,
  'versionHistory' : Array<PackageSummary__1>,
  'dependents' : Array<PackageSummary__1>,
  'devDeps' : Array<PackageSummary__1>,
  'downloadsInLast7Days' : bigint,
  'config' : PackageConfigV2__1,
  'publication' : PackagePublication,
}
export type PackageId = string;
export type PackageName = string;
export type PackageName__1 = string;
export interface PackagePublication {
  'storage' : Principal,
  'time' : Time,
  'user' : Principal,
}
export interface PackageSummary {
  'ownerInfo' : User,
  'owner' : Principal,
  'testStats' : TestStats__1,
  'downloadsTotal' : bigint,
  'downloadsInLast30Days' : bigint,
  'downloadsInLast7Days' : bigint,
  'config' : PackageConfigV2__1,
  'publication' : PackagePublication,
}
export interface PackageSummary__1 {
  'ownerInfo' : User,
  'owner' : Principal,
  'testStats' : TestStats__1,
  'downloadsTotal' : bigint,
  'downloadsInLast30Days' : bigint,
  'downloadsInLast7Days' : bigint,
  'config' : PackageConfigV2__1,
  'publication' : PackagePublication,
}
export type PackageVersion = string;
export type PageCount = bigint;
export type PublishingErr = string;
export type PublishingId = string;
export type Result = { 'ok' : null } |
  { 'err' : Err };
export type Result_1 = { 'ok' : PublishingId } |
  { 'err' : PublishingErr };
export type Result_2 = { 'ok' : FileId } |
  { 'err' : Err };
export type Result_3 = { 'ok' : null } |
  { 'err' : string };
export type Result_4 = { 'ok' : PackageDetails } |
  { 'err' : Err };
export type Result_5 = { 'ok' : PackageVersion } |
  { 'err' : Err };
export type Result_6 = { 'ok' : Array<[PackageName__1, PackageVersion]> } |
  { 'err' : Err };
export type Result_7 = { 'ok' : Array<FileId> } |
  { 'err' : Err };
export interface Script { 'value' : string, 'name' : string }
export type SemverPart = { 'major' : null } |
  { 'minor' : null } |
  { 'patch' : null };
export type StorageId = Principal;
export interface StorageStats {
  'fileCount' : bigint,
  'cyclesBalance' : bigint,
  'memorySize' : bigint,
}
export interface TestStats { 'passedNames' : Array<string>, 'passed' : bigint }
export interface TestStats__1 {
  'passedNames' : Array<string>,
  'passed' : bigint,
}
export type Text = string;
export type Time = bigint;
export interface User {
  'id' : Principal,
  'emailVerified' : boolean,
  'twitter' : string,
  'displayName' : string,
  'name' : string,
  'site' : string,
  'email' : string,
  'twitterVerified' : boolean,
  'githubVerified' : boolean,
  'github' : string,
}
export interface User__1 {
  'id' : Principal,
  'emailVerified' : boolean,
  'twitter' : string,
  'displayName' : string,
  'name' : string,
  'site' : string,
  'email' : string,
  'twitterVerified' : boolean,
  'githubVerified' : boolean,
  'github' : string,
}
export interface _SERVICE {
  'backup' : ActorMethod<[], undefined>,
  'claimAirdrop' : ActorMethod<[Principal], string>,
  'finishPublish' : ActorMethod<[PublishingId], Result>,
  'getAirdropAmount' : ActorMethod<[], bigint>,
  'getAirdropAmountAll' : ActorMethod<[], bigint>,
  'getApiVersion' : ActorMethod<[], Text>,
  'getBackupCanisterId' : ActorMethod<[], Principal>,
  'getDefaultPackages' : ActorMethod<
    [string],
    Array<[PackageName__1, PackageVersion]>
  >,
  'getDownloadTrendByPackageId' : ActorMethod<
    [PackageId],
    Array<DownloadsSnapshot__1>
  >,
  'getDownloadTrendByPackageName' : ActorMethod<
    [PackageName__1],
    Array<DownloadsSnapshot__1>
  >,
  'getFileIds' : ActorMethod<[PackageName__1, PackageVersion], Result_7>,
  'getHighestSemverBatch' : ActorMethod<
    [Array<[PackageName__1, PackageVersion, SemverPart]>],
    Result_6
  >,
  'getHighestVersion' : ActorMethod<[PackageName__1], Result_5>,
  'getMostDownloadedPackages' : ActorMethod<[], Array<PackageSummary>>,
  'getMostDownloadedPackagesIn7Days' : ActorMethod<[], Array<PackageSummary>>,
  'getNewPackages' : ActorMethod<[], Array<PackageSummary>>,
  'getPackageDetails' : ActorMethod<[PackageName__1, PackageVersion], Result_4>,
  'getPackagesByCategory' : ActorMethod<
    [],
    Array<[string, Array<PackageSummary>]>
  >,
  'getRecentlyUpdatedPackages' : ActorMethod<[], Array<PackageSummary>>,
  'getStoragesStats' : ActorMethod<[], Array<[StorageId, StorageStats]>>,
  'getTotalDownloads' : ActorMethod<[], bigint>,
  'getTotalPackages' : ActorMethod<[], bigint>,
  'getUser' : ActorMethod<[Principal], [] | [User__1]>,
  'notifyInstall' : ActorMethod<[PackageName__1, PackageVersion], undefined>,
  'restore' : ActorMethod<[bigint, bigint], undefined>,
  'search' : ActorMethod<
    [Text, [] | [bigint], [] | [bigint]],
    [Array<PackageSummary>, PageCount]
  >,
  'setUserProp' : ActorMethod<[string, string], Result_3>,
  'startFileUpload' : ActorMethod<
    [PublishingId, Text, bigint, Uint8Array | number[]],
    Result_2
  >,
  'startPublish' : ActorMethod<[PackageConfigV2], Result_1>,
  'takeAirdropSnapshot' : ActorMethod<[], undefined>,
  'uploadFileChunk' : ActorMethod<
    [PublishingId, FileId, bigint, Uint8Array | number[]],
    Result
  >,
  'uploadTestStats' : ActorMethod<[PublishingId, TestStats], Result>,
}

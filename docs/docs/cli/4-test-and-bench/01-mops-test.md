---
slug: /cli/mops-test
sidebar_label: mops test
---

# `mops test`

Mops can run Motoko unit tests
```
mops test
```

Put your tests in `test/*.test.mo` files.

All tests run as quickly as possible thanks to parallel execution.

See [test package](https://mops.one/test) to help you write tests.

## Options

### `--reporter`, `-r`

Test reporter.

```
--reporter <reporter>
```

Available reporters:

- `verbose` - print each test name
- `files` - print only test files
- `compact` - pretty progress bar
- `silent` - print only errors

Default `verbose` if there is only one file to test and `files` otherwise.

### `--watch`, `-w`

Re-run tests every time you change *.mo files.

```
--watch
```


### `--mode`

Test run mode

```
--mode <mode>
```

Available modes:

- `interpreter` - run tests via `moc -r` (default)
- `wasi` - compile test file to wasm and execute it with `wasmtime`. Useful, when you use `to_candid`/`from_candid`, or if you get stackoverflow errors.


You can also specify `wasi` mode for a specific test file by adding the line below as the first line in the test file
```
// @testmode wasi
```

**Replica tests**

Replica tests are useful if you need to test actor code which relies on the IC API(cycles, timers, canister upgrades, etc.).

To run replica tests, your test file should look like this:
```motoko
...

actor {
  public func runTests() : async () {
    // your tests here
  };
};
```

See example [here](https://github.com/ZenVoich/mops/blob/main/test/storage-actor.test.mo).

Under the hood, Mops will:
- Start a local replica on port `4945`
- Compile test files and deploy them
- Call `runTests` method of the deployed canister

### `--replica`

Which replica to use to run actor tests.

Default `pocket-ic` if `pocket-ic` is specified in `mops.toml` in `[toolchain]` section, otherwise `dfx`.

Possible values:
- `dfx` - use `dfx` local replica
- `pocket-ic` - use [PocketIC](https://pypi.org/project/pocket-ic/) light replica via [pic.js](https://www.npmjs.com/package/@hadronous/pic) wrapper
---
title: Makefiles are the best thing since sliced bread
description: They're honestly so peak
date: 2026-01-11
authors: ['Angad Tendulkar']
tags:
  - raves
---

Over the past few weeks, I've had the absolute pleasure of learning how Makefiles work. They are gorgeous, beautiful, and you will never need a build script again[^1][^2][^3].

## The Problem

The other day I was trying to get rayon, a library for parallelization using an `Iterator`-like API, to compile on WebAssembly. In a twist no one _ever_ saw coming, the web isn't multithreaded[^4][^5]. Fortunately, the lads over at rayon thought of this and came up with web workers: a cursed API that kinda allows you to run an asynchronous API on another thread[^6].

Ok, so, I go ahead and build my code with rayon enabled and it generates some weird looking JS file in `snippets/wasm-bindgen-rayon-{{hash}}/src` but I figure it's ok. I go to run `bun dev` aaaand.... crash.

Apparently, that weird JS file was referencing another JS file that doesn't exist. yayy!

### What?

Apparently, something like webpack[^7] is supposed to automagically resolve the `../../..` to mean `../../../attendance_crypto.js`? This obviously doesn't make any sense so we have a few options:

1. Fix someone else's code
2. Hacks

Obviously, option two wins here

## Hax?

Ok so game plan: run `sed -i magic_regex_to_fix_all_problems snippets/**/*.js`
But how do I game plan? I need this to happen:

- Every time I build the `src-wasm` project
- I also want to automatically copy the files in `dist/` to the frontend, because I'm tired of it

Your clever mind immediately jumps to a build script. Great! Now we have a 1000-line `build.rs` file that takes a year and a half to build[^8] and copies a few files around and maybe runs that regex if you're lucky. Bravo, drinks all around[^9].

## Introducing: The `Makefile`

Want to copy a file?

```Makefile
wasm:
  cp -r src-wasm/pkg app/wasm
```

Two lines of code. run `make wasm` to copy. That fucking easy.
The C developers were right. This is genius.

Want to do a bit more?

```Makefile
wasm:
	@echo "=== Building WASM package"
	cd src-crypto && rm -rf pkg && wasm-pack build --target web --release
	@echo "=== Copying package files"
	rm -rf app/wasm
	cp -r src-crypto/pkg app/wasm
	@echo "=== Patching workerHelpers.js files"
	sed -i 's|\.\./\.\./\.\.|../../../attendance_crypto.js|g' app/wasm/snippets/*/src/workerHelpers.js
```

This now builds the project, copies the files, patches the broken parts, and cleans up after itself, all faster than that `build.rs` it took you a decade to write.

And it's not that `build.rs` is a _bad_ thing necessarily, I mean, it has it's uses[^10], but no one _really_ needs that complexity.[^11]

Makefiles are the perfect, all-in-one solution for monorepos in need of a way to move compiled files around, all without the overhead of a programming language[^12], compile times[^13], [or whatever the hell this is](https://github.com/Team2791/Robot2025/blob/main/build.gradle). As an added bonus, basically every C developer will be on your side[^14].

[^1]: exception: programmatic stuff that you need a full programming language for (e.g. schema generation)

[^2]: exception: when a library you're using requires a `build.rs` (**_cough_** prost **_cough_**)

[^3]: ok there are a lot more exceptions but goddamnit if Makefiles aren't great

[^4]: exception: web workers and service workers

[^5]: exception: webcrypto probably? depends on the implementation I'd say. also probably webgl/webgpu, canvases, ffmpeg, networking and I/O, and various other things. the point is that there are limited options for runnning _arbitrary_ code on multiple threads, which is what counts.

[^6]: not really, it's IPC all the way down. the best you can do with this is define a typescript namespace and type your worker to hell and hope it doesn't explode?

[^7]: i remember webpack a little bit from my react days oh so long ago

[^8]: Someone at Rust HQ should really consider fixing it's build times (**_cough_** dynamic libraries **_cough_**)

[^9]: non-alcoholic of course

[^10]: \* _prost intensifies_ \*

[^11]: pro tip: if you ever find yourself needing a `build.rs` file, you're probably doing some kind of code generation; and by then you should probably be using a `proc-macro`. Just saying.

[^12]: in my defense, bash _barely_ counts as a programming language

[^13]: python: ...

[^14]: do they use `cmake` now? I'm not sure...

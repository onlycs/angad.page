---
title: 'The State of Shaders'
description: 'A rant about how bad shaders are'
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - 'rants'
  - 'microsoft'
---

## Shaders

Ok, so, someone a million years ago decided that GPUs get their own programming language. This is fairly understandable; GPUs execute code in a fundamentally different way than CPUs. It would probably still have been easier for developers if whoever made the first shader language just made a GCC backend or something.

There are probably reasons as to why they didn't. My guess? probably because GPU architectures change often (think Ampere → Ada Lovelace → Blackwell), unlike x86 which has only been updated once to support 64-bit computing. Still doesn't mean they couldn't have made our lives easier.

## Architecture

Shaders are generally compiled at runtime. The one exception is SPIR-V shaders which are compiled into an intermediate bytecode beforehand. OpenGL, Windows DirectX, and Apple's Metal all have their own, separate shader languages.

When compiled, the shaders resemble assembly.[^1] Then, each GPU will execute a wavefront[^2] in groups of 64 threads. Each thread still runs one instruction at a time, but every thread runs the same one instruction in parallel.[^3] Computations themselves are done on ALUs.[^4]

## Why the different languages

So whenever something sucks to use, I've been trained to assume it's just Microsoft's fault.[^5] So when OpenGL came out with the first mainstream, cross-platform, and open-source shader language known as GLSL, Microsoft came along and said "Hey, you know what would be cool? Our own language" and came out with their own proprietary, Windows-only HLSL soon after.

## The Vulkan Era

In the mid-2010s, the brand-new replacement for OpenGL known as Vulkan brought with it SPIR-V, an IR for shaders that aimed to unify this mess. And it was good on paper... until Microsoft decided to be themselves again and introduce their own, proprietary DXIL.

## Oh wait I forgot about Apple

No one cares about Apple, we can forget about them.

## SPIR-V Now

I've been writing shaders for my fluid simulation using a blend of the Rust-like WGSL, but I'm going to port it over to the up-and-coming [`rust-gpu`](https://rust-gpu.github.io/) project which aims to compile honest-to-goodness Rust code to SPIR-V shaders which can then, hopefully, be run by WGPU and not suck.

[^1]: Not like `.s` files, just the instructions are kind of similar

[^2]: Or a "warp" for Nvidia chips

[^3]: Conditionals and jumps create inefficiencies because certain threads will have to execute extra or fewer instructions

[^4]: Arithmetic Logic Units, aka CUDA for Nvidia

[^5]: IE existing, Visual Studio, DirectX/D3D, UWP, old Edge, the dotnet rewrite, DevOps and VSTS, UEFI and secure boot, WSL existing, Github sucks since purchase, Minecraft sucks since purchase, Windows deleting my `bootctl` entry every few months. And those are just the ones I could come up with off the top of my head.

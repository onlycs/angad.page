---
title: Fluid Simulations Writeup
description: A writeup of the process of making a fluid simulation in Rust, from choosing a graphics library to writing compute shaders.
date: 2025-02-26
tags:
  - projects
  - fluidsim
---

> 3/26: Minor grammar changes and explanation improvements
>
> 4/06: Fix LaTeX multiplication formatting

I finished my Fluid Simulations project yesterday. The process took around 2 months for me[^1], and I want to document the process. Let's get started.

## Choosing a Library

To start, I needed a graphics library in Rust. Unfortunately, most of them were, with all due respect for the developers, [unreasonably difficult for beginners](https://github.com/gfx-rs/wgpu), [had unnecessary abstractions with terrible compile times](https://github.com/bevyengine/bevy), or [didn't have a good ecosystem or support for `wasm32` or compute shaders](https://github.com/ggez/ggez)[^2].

### Game Engines are Cheating

I knew this from the very beginning. You learn basically nothing[^3] from having [an overarching graphics and physics engine do all the heavy lifting for you](https://unity.com). I decided that the library that I ended up going with didn't count as a game engine, since [all it does is render](https://github.com/ggez/ggez?tab=readme-ov-file#features), which is just the amount of lift I needed to get this thing off the ground.

### The `wgpu` Attempt

`wgpu` is an extremely low-level wrapper for Vulkan and WebGPU. It's meant to be as bare-bones as possible—nothing is there to help the user.
So I pull up some documentation, and churn out a couple hundred lines of code, not to mention [[The State of Shaders|a point generator written in another language for some reason]] just to get a singular triangle on the screen. This was fucking ridiculous for attempt one.

### `ggez` — A Rust library to create a Good Game Easily

`ggez` is a high-level rendering API that runs on top of `wgpu`. It makes it super easy to draw a circle, or even a bunch of circles. However, it did not have `wasm` support, meaning I would need to port this project away from `ggez` to get something working on the web.

## Physics ↔ Rendering Architecture

If you want to wait for a physics tick to finish before drawing anything to the screen, its inefficient. Your window is waiting for physics to finish and physics is waiting for your window to finish, resulting in massive lag and fps drops. So the solution was a little bit of this:
![](https://i.imgur.com/YSozyI3.png)

### Draw a circle!

I got circle drawing working on commit [`f318824`](https://github.com/onlycs/fluidsim/tree/f31882452b88e43b8feece42e69d8dae4b412707)

### Drawing a UI

So I really wanted a little options menu inside the app where you could tune the settings to your liking. To do this, literally everyone uses a well-known library called [`egui`](https://github.com/emilk/egui). Unfortunately, neither `ggez` nor `egui` provided interoperability between the two. [So I did it myself](https://github.com/onlycs/fluidsim/blob/61c2335fca0b86e7fd9ef455459b0dcd48b967e1/src/renderer/egui_translator.rs). It was really annoying. There was literally a block of code where I was just translating [_so many key presses_](https://github.com/onlycs/fluidsim/blob/61c2335fca0b86e7fd9ef455459b0dcd48b967e1/src/renderer/egui_translator.rs#L161-L276). The code was literally just

```rust
match (ggez_keypress) {
	ggez::KeyCode::KeyA => egui::Key::A,
	ggez::KeyCode::KeyB => egui::Key::B,
	// and so on (I'm paraphrasing to make this easier to understand, but still)
}
```

## The Maths

### Pixels is not a Unit

The first thing you have to understand is that pixels are not a viable unit to actually use in real life. Fortunately, display information on the Framework 16 is readily available. The number of pixels per inch on the screen I was using was 188. Using a little magic, I made a length unit `pixel`, which converted directly to meters. By the end of it, I was able to drop a pencil and it would line up perfectly with a circle falling on the screen.

### The To-Do List

There are two ways people do fluid simulations. I don't remember the first one. The second one is something called smoothed particle hydrodynamics, also known as SPH. This method relies on using a ton of little particles and modeling the forces between them. We use a little something called the [Navier-Stokes equations](<https://en.wikipedia.org/wiki/Navier%E2%80%93Stokes_equations#:~:text=navier%E2%80%93stokes%20equations%20with%20uniform%20viscosity%20(convective%20form)>)[^7] to determine what forces to apply to our particles given some state. Here's what needed to be done.

1. Calculate the density $\rho$ at that particle
2. To calculate the pressure force $a^{pressure}_{i}$, assuming unit mass for simplicity
   1. The magnitude of the vector, which is $|\rho-\rho_{target}|*k$, where $k$ is strength
   2. The direction, given by $-\nabla\rho$, the negative gradient of the density function (Calculus!)[^6]
3. Apply the pressure force

### Calculating the Density

The density is given by this function

$$
\rho_i = \sum_{j}m_j \times W(||r_i-r_j||)
$$

which says, the density $\rho_i$ for a given particle $i$ is approximated to be the weighted sum of the masses $m_j$ for all neighboring particles $j$. The weight is determined by a smoothing function $W$, which takes as its input the distance between the two particles $i$ and $j$, denoted by $||r_i - r_j||$. We're also going to cache the densities for later use.

## The Smoothing Function $W$

$W$ is given by

$$
W(distance, radius) =
  \frac
    {(radius-distance)^2}
    {4\pi \times radius^4/6}
$$

The $\frac{4\pi * radius^4}{6}$ term is the volume of the smoothing function, calculated a long time ago by Wolfram Alpha when I knew what I was doing.[^8]

### Calculating the Pressure Given Density

The pressure is given by the function

$$
P_i = |\rho_i-\rho_{target}| \times k
$$

which says, the pressure $P_i$ for a given particle $i$ is the difference between the density $\rho$ at $i$ and the target density $\rho_{target}$, multiplied by a strength $k$, which is user-controllable. We only use this once when we calculate the pressure force which repels particles, so there is no need to cache this as well.

### Calculating the Pressure Force

The pressure force is given by the function

$$
a^{pressure}_i =
  -\sum_j m_j
  \times (\frac{P_i}{\rho_i^2}+\frac{P_j}{\rho_j^2})
  \times \nabla W(||r_i - r_j||)
$$

However, I'm just realizing that I miswrote it in code. I think I found a different equation elsewhere, which looks something like this

$$
a^{pressure}_i =
  -\sum_{j} \frac
    {m_j \times \frac{P_i+P_j}{2} \times \nabla W(||r_i - r_j||)}
    {\rho_i}
$$

Don't really know how that happened. Let's go over this term-by-term

- $a^{pressure}_i$ represents the applied pressure force to some particle $i$
- $\sum_j$ means "for every particle j, add up the following:"
- $m_j$ represents the mass of particle j
- $P_i$ and $P_j$ represents the pressure of two particles $i$ and $j$
- $\nabla W$ represents the inverse gradient of the smoothing function $W$, i.e. $W'$ or the first derivitave of $W$.
- $\rho_i$ is the density of some particle $i$
- $||r_i - r_j||$ is the distance between the positions of particles $i$ and $j$

After programming all of that, we get a slow, but usable simulation. It's a bit chaotic, and I'll get to why in a bit, but we first have to do some optimization.

## Optimization — Spatial Lookup

Our current code is written to loop over every particle $j$. However, the smoothing function $W$ returns zero after a given smoothing radius.
There's a thing you can do with computers doing simulations, where you break the scene up into blocks of particles which couldn't possibly interact. When calculating some property $A_i$ of some particle $i$ (e.g. density or pressure force), we only need to loop over the particles in the block of $i$ and the blocks surrounding $i$.
To make this more clear:
![](https://i.imgur.com/6CZUrZd.png)
For a given red particle, only the blue particles should be considered into calculations. The purple particles are too far away to do anything, given our smoothing radius.

Some more calculations are required to split the grid up into an arbitrarily sized grid at runtime. I'll walk you through it.
We currently store the particles like this:

```rust
positions: [Vec2; 16384],
```

This means that there can be up to 16384 particle positions, each of which are given by some two dimensional vector[^9], centered at the center of the window.

Let's look at a smaller example:
![](https://i.imgur.com/0V2YYD4.png)
Here we have a 2 by 3 grid of particles, and 5 available particles. I've color coded them.
Lets do an example computation for particle 1. The position for the particle is $(1, 1)$[^10]. To get a special number called the cell key, we can multiply the $x$ and $y$ positions by two different prime numbers, $p_1$ and $p_2$, then add them up. Let's say the cell key for the particle becomes 47. We then have to wrap that around the number of particles (there are 6), so we divide the cell key by 6, but take the remainder, 5 in this case.
![](https://i.imgur.com/PwnXg21.png)
We can go ahead and do this for all particles, and then we need to sort both the particle indices using the cell keys as the keys for the sort.
![](https://i.imgur.com/2EINaEC.png)
Note that cell key 2 still corresponds to particles 5 and 4, etc. Note that now, particles with the same cell are next to each other in the lower array. We can easily see that particles 5 and 4 are together in the same cell (they share a cell key), particle 2 is by itself, and particle 1 and 3 are together as well.
The last thing we need to do is create another array of start indices.
![](https://i.imgur.com/h67E979.png)
`start_indices[2] = 1`, therefore the first index in cell keys which starts with a "2" is one. That is,
`cell_keys[start_indices[i]] = i` for any `i` that exists in `cell_keys`.
To fetch the left and right boundaries of the cell keys array:

```python
def indices_in_cell(cell_key): # pseudocode
	start = start_indices[cell_key]
	remaining_indices = range(cell_key, len(start_indices))
	end = remaining_indices.firstWhich(x: start_indices[x] is finite)
	return particle_indices[start:end] # get every element from index start->end
```

## Viscosity

> It's a bit chaotic, and I'll get to why in a bit

Well this is that bit. To increase viscosity means to decrease the flow of the particles, that is, how much they like to move relative to each other. This is how we calculate it[^11]

$$
a^{viscosity}_i =
  k_{viscosity}
  \times \sum_j m_j
  \times (v_i - v_j)
  \times W(||r_i - r_j||)
$$

This essentially averages out velocities, but using the smoothing function so particles further away do not influence the average as much. By scaling based on a relatively small[^12] $k_{viscosity}$, we don't make the simulation ultra-stiff.

## `wgpu` Port

I'm going to summarize this part, even though it took the longest, by far. The port was boring, tedious, and mainly consisted of a ton of boilerplate which I'm not qualified to try to explain.

### Drawing Circles

`ggez` was not the most efficient, and conflicted with my eventual goal of getting the project to run on the web, or using compute shaders. It took me a while, but I converted the entire renderer to `wgpu`. The circles were done using [`lyon`'s example code](https://github.com/nical/lyon/tree/main/examples/wgpu). The run-down is, if you send a ton of meshes to the GPU to draw at the same time, it's much faster than sending many individual meshes. `lyon` handles how the GPU is drawing each circle, and I just send 16384 primitives along with it, which tells the GPU where and which color to draw each circle.

### Compute Shaders

Compute shaders are a way to make the GPU do all of the physics computations in parallel, which is faster than doing it on the CPU. Most of the equations listed above need to be repeated for each particle, which the GPU excels at.
However [[The State of Shaders|the current state of shaders suck]]. And honestly, writing in a language that is not Rust, [but tries to be like Rust](https://github.com/onlycs/jasmine), is really annoying. I mean, pointers just didn't work right. And sometimes, `naga-oil` would just fail to compile it for no reason. After banging my head against a wall for a few weeks, I just decided to move to [`rust-gpu`](https://github.com/rust-gpu/rust-gpu), which is a way to write [`spir-v`](https://en.wikipedia.org/wiki/Standard_Portable_Intermediate_Representation) shaders, directly in Rust.
The decision meant that I didn't have to do much rewriting, since the code that I wrote for the CPU was very GPU-friendly. The only hard part was the [[Fluid Simulations#Optimization — Spatial Lookup|sort step for spatial lookup]], which I ended up offloading to [a library](https://github.com/KeKsBoTer/wgpu_sort), which [I forked](https://github.com/onlycs/wgpu_sort) to support the latest version of `wgpu`.

## The End?

Probably. If I was going to fix something, it would probably be the [[Fluid Simulations#Calculating the Pressure Force|bad]] [[Fluid Simulations#Viscosity|maths]] that exist in some places. But I want to move on, I've spent too long here.

[^1]: Ok, but, I'm _me_. It should definitely **not** take just two months.

[^2]: I respect developers of the aforementioned libraries, but honestly, it [shouldn't](https://github.com/onlycs/fluidsim/tree/renderer-bevy) [be](https://github.com/onlycs/fluidsim/commit/a2703884a17d22066e1d84793dd58067831fef0f) [this hard](https://github.com/onlycs/fluidsim/tree/ggez-wasm32) to draw a ton of colored circles, even on a `wasm` target

[^3]: You learn fluid simulation maths, but nothing about how computers render shit, which is what I was really after

[^5]: Pixels per inch

[^6]: God bless Mrs. Dirtadian and the fact that I'm in precalc honors right now, otherwise I wouldn't have been able to math.

[^7]: No, I did not actually read and understand this Wikipedia article

[^8]: I remember that there were two integral signs but that's all I know

[^9]: If you haven't taken calculus yet, you can think of `Vec2` like a point on the X/Y plane

[^10]: For computers, we measure position from the top-left

[^11]: This is not super accurate, I know.

[^12]: ~0.06

---
title: "Fluid Simulation: A Whole 'Nother Dimension"
description: An explanation of how I updated the simulation to 3 dimensions
date: 2026-05-28
authors:
  - Angad Tendulkar
tags:
  - projects
  - fluidsim
---
I finished making my fluid simulation in three dimensions today. Let's walk through the process
## 1. Updating Dependencies
This part was, by far, the most infuriating. I started by updating all of the crates with `cargo update` and then updating all of the flake dependencies by `nix flake update`. I then went through the project and fixed the syntax changes in `wgpu` from `0.27` to `0.28`. And that should have been the end of it.
### 1.1. The Sorter
I used a forked crate, [`wgpu-sort`](https://github.com/onlycs/wgpu-sort), to handle all of my sorting needs. And, well, after I updated it to the latest version of `wgpu`, all of the tests miraculously failed.

After failing three times to write my own sorter implementation, I spent a good half hour scavenging the internet for code someone else had written. I found [`wgpu-algorithms`](https://github.com/SamJSui/wgpu-algorithms), a project that had been very clearly written entirely using AI. However, the tests *did* work. I then [forked it](https://github.com/onlycs/wgpu-algorithms), and went through great lengths to actually make the performance decent.[^1] The crate also didn't necessarily lend itself to having its code be reused by other `wgpu` projects—`wgpu` usage was entirely self-contained, there was no API exposed that allowed for usage of a predefined `CommandEncoder` or `ComputePass`. Even better, it was almost completely broken for "slow" GPUs (using VT4/128 workgroups).
### 1.2. `spirv-std`
I'm using a crate (or, rather, ecosystem thereof) to compile Rust code to **S**tandard **P**ortable **I**ntermediate **R**epresentation[^2], more commonly known as SPIR or SPIR-V (for its fifth version).  

It re-exports `glam` as its `Vec[X]` crate of choice, but the version listed in its `Cargo.toml` doesn't work. I had to manually go into my `Cargo.lock` and delete the bad version of `glam` (which is `0.33`) and replace it with the functional `0.31`.
### 1.3. Trying again for a Windows and OSX release
After spending god knows how long wrestling with NixOS, I ended up using `cargo-xwin` and `cargo-zigbuild` to cross-compile to `x86_64-pc-windows-msvc` and `universal2-apple-darwin` respectively.
## 2. Brushing Up on the Code
Going back to this project after a year, I realize I had made some… poor choices. Namely, this type of late-init helper as scattered everywhere:
```rust
struct TheActualData { ... }
#[derive(Default)]
struct DataState(Option<TheActualData>);

impl DataState {
	fn init(&mut self, ...) { ... }
}

// The cursed bit
impl Deref for DataState {
	type Target = TheActualData;
	// ...you get the jist, DerefMut was implemented as well
}
```
I am unsure what force of nature compelled me to write this (probably some last-minute deadline) but I fixed it. Yay!
## 3. Updating the Simulation
### 3.1. GPUs Like Multiples of 8
So, a `Vec3` looks a little like this:
```rust
pub struct Vec3 {
	x: f32,
	y: f32,
	z: f32
}
```
Very... straightforward. There is just one problem: It's 12 bytes long. While I do not have a degree in mathematics, I'm fairly confident that 12 is not a multiple of 8.

This is a problem because, apparently, in order to send data to the GPU, it has to be a multiple of 8 bytes long. Which shouldn't really have been a problem, since I wasn't sending one `Vec3`—I was sending $2^{18}$ (=262144). But no, if I send an array of `<T>`, apparently `T` itself needs to be a multiple of 8 bytes long. 

So, instead of sending `Vec3`s, I actually had to send `Vec4`s, wasting god knows how much VRAM (which is already on short supply these days) just because stupid WebGPU can't have packed arrays. Genuinely, so bad.
### 3.2. Smoothing Mathematics
To turn the fluid simulation curves into 3D, I had to recalculate every volume integral. To convert from polar coordinates to Cartesian coordinates, I was multiplying by $r$. To convert from spherical coordinates to Cartesian, I had to multiply by the Jacobian factor $r^2 \sin \theta$. You also need to add an extra integral: $\int_0^{2\pi} […] \, \mathrm{d}\phi$.
#### 3.2.1. Density
$$
\begin{align*}
V &= \int_0^{2\pi}
	\int_0^\pi
		\int_0^h (h-r)^2 \times r^2 \sin \theta \, \mathrm{d}r
	\, \mathrm{d}\theta
\, \mathrm{d}\phi \\
&= (\int_0^{2\pi} \mathrm{d}\phi)
	(\int_0^{\pi} \sin \theta \, \mathrm{d}\theta)
	(\int_0^h (h-r)^2 \times r^2 \, \mathrm{d}r) \\
&= \frac{2\pi \times h^5}{15}
\end{align*}
$$
#### 3.2.2. Near Density
$$
\begin{align*}
V &= \int_0^{2\pi}
	\int_0^\pi
		\int_0^h (h-r)^3 \times r^2 \sin \theta \, \mathrm{d}r
	\, \mathrm{d}\theta
\, \mathrm{d}\phi \\
&= (\int_0^{2\pi} \mathrm{d}\phi)
	(\int_0^{\pi} \sin \theta \, \mathrm{d}\theta)
	(\int_0^h (h-r)^3 \times r^2 \, \mathrm{d}r) \\
&= \frac{2\pi \times h^6}{15}
\end{align*}
$$
#### 3.2.3. Viscosity
$$
\begin{align*}
V &= \int_0^{2\pi}
	\int_0^\pi
		\int_0^h (h^2-r^2)^3 \times r^2 \sin \theta \, \mathrm{d}r
	\, \mathrm{d}\theta
\, \mathrm{d}\phi \\
&= (\int_0^{2\pi} \mathrm{d}\phi)
	(\int_0^{\pi} \sin \theta \, \mathrm{d}\theta)
	(\int_0^h (h^2-r^2)^3 \times r^2 \, \mathrm{d}r) \\
&= \frac{64\pi \times h^9}{315}
\end{align*}
$$
#### 3.2.4. Derivatives 
$$
c^\prime(r, h) = \frac{\frac{d}{dr}s(r, h)}{V}
$$
* $c^\prime$ is the derivative of the curve
* $s(r, h)$ is the unscaled smoothing term (e.g. $(h-r)^2$ for density)
* $V$ is the volume of said smoothing term, calculations above.
### 3.3. Bounding Box Transformations
Since the bounding box of the simulation is no longer just the size of the screen, I allowed the size and rotation of said box to be configured using the panel. The collision got a bit more complicated, but it boiled down to converting everything to box-space, doing collisions normally, and converting back.
## 4. 3D Rendering
### 4.1. View and Projection Matrices
To keep this part short, you need a view matrix and a projection matrix to render things in 3D. This makes up the math that can essentially project a 3D scene onto your 2D screen, while taking into account the position, rotation, FOV, and aspect ratio of the camera.

I'll derive everything here. I'll represent the camera's translation vector as $\vec{t}$ and the camera's rotation as a [quaternion](https://wikipedia.org/wiki/quaternion) $q = \begin{pmatrix}x & y & z & w\end{pmatrix}$[^4].
#### 4.1.1. The View Matrix
Start by deriving the camera's translation $\mathbf{T}$ and rotation matrix $\mathbf{R}$
$$
\mathbf{T} = \begin{pmatrix}  
1 & 0 & 0 & t_x \\
0 & 1 & 0 & t_y \\
0 & 0 & 1 & t_z \\
0 & 0 & 0 & 1
\end{pmatrix}
$$
The rotation matrix is a bit more complicated. Start with
$$
\begin{array}{lll}
r_{00} = 1 - 2(y^2 + z^2) & r_{01} = 2(xy - wz) & r_{02} = 2(xz + wy) \\
r_{10} = 2(xy + wz)       & r_{11} = 1 - 2(x^2 + z^2) & r_{12} = 2(yz - wx) \\
r_{20} = 2(xz - wy)       & r_{21} = 2(yz + wx) & r_{22} = 1 - 2(x^2 + y^2)
\end{array}
$$
And then
$$
\mathbf{R} = 
\begin{pmatrix}
r_{00} & r_{01} & r_{02} & 0 \\
r_{10} & r_{11} & r_{12} & 0 \\
r_{20} & r_{21} & r_{22} & 0 \\
0 & 0 & 0 & 1
\end{pmatrix}
$$
Finally, the view matrix is just
$$
\mathbf{V} = (\mathbf{T}\mathbf{R})^{-1}
$$
#### 4.1.2. The Projection Matrix
First, calculate the focal length:
$$
s = \cot(\frac{\mathrm{fov}}{2})
$$
where $\mathrm{fov}$ is the FOV of the camera, defaulting to 90 degrees

Then, the projection matrix is given by:
$$
\mathbf{P} = 
\begin{pmatrix}
\dfrac{s}{\text{aspect}} & 0 & 0 & 0 \\
0 & s & 0 & 0 \\
0 & 0 & -\dfrac{f+n}{f-n} & -\dfrac{2fn}{f-n} \\
0 & 0 & -1 & 0
\end{pmatrix}
$$
where
* $\mathrm{aspect}$ is the aspect ratio of the screen
* $f$ and $n$ are "far" and "near" z-values. I hardcoded $f = 1000.0$ and $n = 0.1$
### 4.2. Billboards
Previously, I was tessellating a circle using `lyon` and rendering everything using a vertex shader, which did nothing other than converting from physics to pixel units.[^3] This does not scale to three dimensions—I'd be sending a much larger number of points without really needing to.

Instead, it's much more effective to send a square of points to the GPU. We can use the GPU to transform them based on the 3D position of the actual particle we want to draw.
$$
\mathbf{p}_{\text{screen}} = \mathbf{P}\mathbf{V}\mathbf{M}\mathbf{p}_{\text{local}}
$$
Where $\mathbf{M}$ is the billboard's model matrix, and $\mathbf{p}_{\mathrm{local}}$ is the position of the point (extended by a zero). In practice, this is not how we compute things; instead, we pass every point to the GPU and do some slightly different math:
```rust
let view_center = (globals.view * prim.translate.extend(1.0)).truncate();
let view_pos = view_center + vec3(a_position.x * r, a_position.y * r, 0.0);

*out_pos = globals.projection * view_pos.extend(1.0);
```
where,
* `globals.view` is $\mathbf{V}$
* `globals.projection` is $\mathbf{P}$
* `a_position` is the point in question
* `r` is the radius of each particle

We can then use the fragment shader (i.e. what assigns color to things) to not draw a color if the current point is greater than $r$ away from the center of the particle. Et voila, we have some fake spheres that don't eat VRAM.
## 5. Conclusion
That's essentially everything I changed to make the simulation in three dimensions. The app is functional on Windows and Mac, somehow, and downloads are available on the [GitHub](https://github.com/onlycs/fluidsim). I also went and revised [[Fluid Simulation|the original writeup]].

[^1]: Seriously, ChatGPT was recreating entirely new buffers and bind groups *every single `sort()` call*. 

[^2]: And yes, I did know this acronym off of the top of my head. Fight me.

[^3]: One physics unit equals 100 pixels

[^4]: I realize that most mathematics represents this as $q = A + Bi + Cj + Dk$, but the actual data is packed is $\begin{pmatrix}x & y & z & w\end{pmatrix}$, so I'm just going to roll with the latter.

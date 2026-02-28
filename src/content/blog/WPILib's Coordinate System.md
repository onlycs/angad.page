---
title: "WPILib's Coordinate System"
description: "WPILib's coordinate system is really bad"
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - 'rants'
  - 'frc'
---

I really want to know—WPI—what the fuck is this
![](https://i.imgur.com/q1gUYKJ.png)

That. makes. no. sense. For those who don't know, this is **not** how 3d coordinate systems are found in the wild. This is the standard system literally everyone else uses
![](https://i.imgur.com/10nGduh.png)
This makes sense. This is how it should be. But WPILib had to be it's own special snowflake.

## Controller Mappings

I find this really funny.
In WPILib's coordinate system, left is $+Y_w$, up is $+X_w$ (I'm using ${}_w$ to denote WPILib, and ${}_c$ to denote controllers). However, with controllers, right is $+X_c$ and down is $+Y_c$. Additionally, [WPILib's rotation system is backwards](https://docs.wpilib.org/en/stable/docs/software/basic-programming/coordinate-system.html#rotation-conventions). So to convert between controller power and WPILib's coordinate system, you say that

```java
convert(double controller_x, double controller_y, double controller_rot) {
	return Tuple3(-controller_y, -controller_x, -controller_rot);
}
```

Literally negating everything.

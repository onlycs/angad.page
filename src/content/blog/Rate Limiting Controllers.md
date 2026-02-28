---
title: 'Rate Limiting Controllers'
description: 'How we limit the acceleration of our robot to prevent tipping'
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - 'frc'
---

To put it lightly, our robot is unbalanced. We have a very large elevator stationed on one end of the robot, with literally nothing on the other side. This means that it's going to be susceptible to tipping if we give it power and then immediately stop. Because the swerve modules are in brake mode, there is basically infinite deceleration as whatever closed loop controller tries to match the commanded as closely as possible. We could either rely on the driver to always remember to slowly decelerate the robot, or we could do it for him.

## Manual Attempt 1

```java
Vector2 lastInput;
double lastTime;
final double maxAccel;

Vector2 calculate(double x, double y) {
	Vector2 vel = [x, y]; // pseudocode—life's too short to write java
	Vector2 rel = vel - lastInput; // use lastInput as world-center

	double now = Time.now();
	double dt = now - lastTime;
	double dist = rel.normalize(); // modifies rel in-place, returns mag
	double accel = dist / dt;

	if (accel > maxAccel) {
		double maxDist = maxAccel * dt;
		vel = (rel * maxDist) + lastInput; // make acceleration max
	}

	lastTime = now;
	lastInput = vel;

	return vel;
}
```

This didn't work—don't know why. Just went back and forth and back in simulations.

## Slew Rate Limiting

```java
SlewRateLimiter xLimit = new SlewRateLimiter(xRate);
// same for y and rotation

Tuple3 calculate(double x, double y, double rot) {
	return (xLimit.calculate(x), ...etc)
}
```

Apparently `SlewRateLimiter` limits the rate of change of an input to whatever rate as units per second. The main difference here is that, instead of limiting acceleration as a whole, it does the x and y components separately which _should_ have a similar effect, but I don't know—I haven't done the math. This one worked in simulations, but I have yet to test it on our actual robot.

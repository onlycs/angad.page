---
title: KBNT
description: A story of how I wrote a keylogger and triggered the school's antivirus... for robotics.
date: 2026-03-21
tags:
  - microsoft
  - frc
  - cysec
  - school
  - rust
---
## The Problem
The Xbox Series 2 Elite controllers have four paddles on the back of them. These paddles are not part of the generic controller HID spec, and as such, DriverStation has no support for them (as their own buttons). The Xbox Accessories App will allow you to do one of the following:
1. Remap the paddles to buttons that already exist on the controller, or
2. Map the paddles to keyboard presses

I chose the latter
## Implementation
KBNT stands for Keyboard over NetworkTables. The goal is to capture keypresses and send them to the robot. This is a little complicated in practice, but doable:
1. Query for the `DriverStation.exe` process. I don't want to waste resources trying to connect to a robot that isn't nearby. You can do this with a `WMI` query, which is kinda like a freaky SQL for the entire computer.
2. Pause the thread until we get the `DriverStation.exe` process. In practice, this is done by requesting asynchronous process creation events and `.await`ing on a `tokio::sync::oneshot` thingy. 
3. While DS is open, repeatedly try to connect to the robot's NetworkTables instance, using an IP address provided in a config file somewhere.
4. Once connected, publish `KBNT/KeysToPress: string` and `KBNT/NumKeydowns: int[]` where each index in the latter array corresponds to a character in the former string.
5. Add a windows kernel hook (`SetWindowsHookExW`) that listens for every key-press, and sends it over a `tokio::sync::mpsc`, which increments the relevant indices in the `NumKeydowns` array.
6. Every robot loop, detect if any of the keydown values have been incremented and emit a `Trigger`.
## This is a Keylogger
So, ask yourself, what would CloudStrike Falcon see when looking at the compiled binary. I'm hooking into a system-level keyboard listener and taking the output and sending it over the network to a configurable IP address. Now I'm no cybersecurity expert, but I'm pretty sure that's called a keylogger. I did end up having to go to my school's IT department[^1] and explain the whole thing. Not the most fun experience.
## Some Fun Facts
* Interestingly, only the release binary was flagged by CSF. Building in Rust's debug mode allowed KBNT to flow under the radar. Considering the latter binary *has* debug symbols... this is incredibly interesting because it should have theoretically been significantly easier to detect.
* There's no API to interrupt and/or run a function (on a thread) when an NT value changes (on the Java side). You'd have to poll on the 20Hz event loop, which could cause you to miss keypresses if you didn't use my solution.
* WPILib is pretty flawed in general, [[Ferrobot - Introduction|something I hope to fix in my lifetime]].
* Our first robotics competition (Hudson Valley Regional) is being held at Rockland Community College. Did you know that this county (i.e. Rockland County) has the highest Jewish population proportion of any county in the entirety of the United States of America, at like 30ish percent?

[^1]: who, for context, already don't like me too much

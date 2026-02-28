---
title: 'Ferrobot - Part 2'
description: "The FFI/interop for Ferrobot is finally done! Let's take a look at how it works."
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - 'projects'
  - 'frc'
  - 'rust'
---

I just finished all the FFI/interop for Ferrobot (yay!). Let's take a look at it

## The Device

A device is essentially the backbone of the communication between Rust and WPILib C++. At the moment, I have planned three device types, `SparkMax` motor controllers, `NavX` gyros, and `XboxController`s, with more coming when I get those done. Each device is kept in a `std::map` on the C++ side, keyed by the identifier of the device.[^1] Each device type has its own container, which stores its own map, and handles different commands.

```rust
struct Device {
	kind: DeviceType,
	id: u8, // can id, gyro port, etc.
}
```

## Commands

Each device type has a dedicated command type. For example, the command type for a spark max could have the fields `set_output`, `set_position`, `set_velocity`, etc. These commands can be sent to the motor asynchronously, meaning we can actually finally have a multithreaded robot (insane).

To construct these structs, we get to do a little bit of type erasure. We can do something like:

```rust
struct Command {
	device: Device,
	command: *const c_void, // type determined by device.kind at runtime
}

struct SparkMaxCommand {
	command_type: SparkMaxCommandType, // set_velocity, set_position, etc.
	data: f64, // actually a c_void; not all commands share the same type
}
```

On the C++ side:

```cpp
extern "C" {
	ffi::Response handle_command(ffi::Command *command);
}

// somewhere
switch (command→device.type) {
case DeviceType::SparkMax:
	m_sparkMaxContainer→handleCommand(command→device.id, (const SparkMaxCommand *)command.data);
}

// somewhere else
class SparkMaxContainer {
public:
	...
	ffi::Response HandleCommand(uint8_t can_id, const SparkMaxCommand *command);

private:
	...
	std::map<uint8_t, SparkMax> m_sparks;
}
```

## Proper Error Handling

Similar to how the type of the command was inferred based on the device type, we can infer the response or error type based on the command type.

```rust
pub fn command<D: Device>(
	device: &D,
	command: D::Command
) → Result<*const D::Command::Ok, *const D::Command::Err> {
	...

	let ffi_command = Command {
		device: *device,
		command: Box::into_raw(Box::new(command)) as *const c_void
	};

	...

	let response: Response = handle_command(ffi_command);

	...

	if response.ok {
		return Ok(response.data as *const _)
	}

	return Err(response.data as *const _)
}
```

Very cool stuff ig.

[^1]: e.g. CAN id for spark max's

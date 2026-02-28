---
title: 'Operating Systems - Hello, World!'
description: 'My first steps in making an operating system'
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - 'operating-system'
  - 'projects'
  - 'rust'
---

My next project, I decided, would be to make my own operating system. I realize it definitely will not compete with Windows or Linux. I plan to use this project as a tool to learn how operating systems actually work.

## Architecture

When I was planning out this project, I had originally wanted to make a generic x86 or x64 operating system, that I could perhaps boot on my computer in the future. Midway through planning, however, I switched gears and decided to target `risc-v`[^1] because why not.

For those of you who are confused, there are multiple types (known as architectures) of CPUs. Each arch has a different set of operations (known as an instruction set) it can perform. The two main architectures are x86, which are used in almost all mainstream desktop and laptop computers,[^2] and ARM, which is used by phones and smartwatches. ARM processors have a much smaller instruction set than x86, which makes them much more power efficient, but much less powerful.

`risc-v` is an extremely new and open-source processor. It's more power efficient and also faster than ARM and x86[^3]. However, since it's so new, `risc-v` has seen little adoption from the tech world[^4]. I decided to target this for the purposes of learning because why not.

## A Guideline

If you recall something from my [[Fluid Simulations#`ggez` — A Rust library to create a Good Game Easily|fluid simulation]] project, I had used `ggez` as a starting point to get the project off the ground before I replaced it with the much lower-level `wgpu`. I decided that I would probably need something similar. So I used [some other guy's code](https://osblog.stephenmarz.com) to get myself to an `elf` file that boots when run using QEMU.

## Communications (UART)

UART stands for Universal Asynchronous Receiver-Transmitter. QEMU emulates the [16550 UART](https://opensocdebug.readthedocs.io/en/latest/02_spec/07_modules/dem_uart/uartspec.html).

### Setting Up the Chip

We're going to follow along with this [nice flowchart](https://www.intel.com/content/www/us/en/docs/programmable/683130/22-2/16550-uart-general-programming-flow-chart.html), using [this wiki](http://www.breakintoprogram.co.uk/hardware/components/8250-uarts) for addresses and stuff.

First, I'm going to make a struct with the base address of the UART.

```rust
pub struct Uart {
	pub base: usize
}

impl Uart {
	pub fn new(base: usize) → Self {
		Self {
			base
		}
	}

	fn ptr(&mut self) -> *mut u8 {
        self.base as *mut u8
    }
}
```

And make an initialize function

```rust
pub unsafe fn init(&mut self) {
	let ptr = self.ptr();
}
```

Step one is to enable the FIFO

```rust
// enable the fifo by writing a one to bit zero of the FCR (offset 2)
ptr.add(2).write_volatile(0b1);
```

Then we can set the FCR word length to 8 bits (`0b11`)

```rust
// FCR word length is 8 bits, 0b11
const FCR: u8 = 0b11;

// set FCR
ptr.add(3).write_volatile(FCR);
```

_Note that we need to store the `FCR` variable separately because we use the FCR to set `DLAB=1` and change the baud rate._

Then, we enable interrupts

```rust
// enable interrupts in the IER
ptr.add(1).write_volatile(0b01);
```

We need to calculate the divisor numbers that we put in the DLL and DLH to set the baud rate. We can do this using the formula

$$
\text{divisor} =
\lceil
\frac{\text{clock rate}}{\text{baud rate}* 16}
\rceil
$$

Or in code

```rust
const CLOCK_HZ: u32 = 22_729_000;
const BAUD_RATE: u32 = 2400;
const DIVISOR: u16 = CLOCK_HZ.div_ceil(BAUD_RATE * 16) as u16;
const DIVISOR_L: u8 = (DIVISOR >> 8) as u8; // top and bottom 8 bits
const DIVISOR_H: u8 = (DIVISOR & 0xff) as u8;
```

We then have to enable the DLL and DLH

```rust
// 0b1 << 7 is the DLAB bit
ptr.add(3).write_volatile(FCR | 0b1 << 7);
```

And write our values in the appropriate registers

```rust
// put l and h bytes in DLL and DLH respectively
ptr.add(0).write_volatile(DIVISOR_L);
ptr.add(1).write_volatile(DIVISOR_H);
```

Then set our DLAB back to actually use the UART

```rust
// after we change baud, we never touch the DLL and DLH again
// so we can set DLAB to 0
ptr.add(3).write_volatile(FCR);
```

### Reading and Writing

To read, we first need to check if the LSR claims there is data, and if it does, we can read the RBR

```rust
let ptr = self.ptr();

unsafe {
    // check LSR for data
    if ptr.add(5).read_volatile() & 0b1 == 0 {
        // no data, LSR bit 0 is 0
        None
    } else {
        // read from RBR
        Some(ptr.add(0).read_volatile())
    }
}
```

To write, it's similar. We just need to wait until the FIFO has enough space.

```rust
let ptr = self.ptr_mut();

unsafe {
    // wait for space in FIFO (THRE=1)
    while ptr.add(5).read_volatile() & (0b1 << 5) == 0 {
        // no space, LSR bit 5 is 0. block until there is space
    }

    // write to THR
    ptr.add(0).write_volatile(byte);
}
```

_I plan to replace this with a thread or something soon so we don't ever need to block._

### Making it Rusty - `fmt::Write`

This is really simple

```rust
impl fmt::Write for Uart {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for byte in s.bytes() {
            self.write(byte);
        }

        Ok(())
    }
}
```

### Modifying `print` Macros

We can now change the `print` (and `println`) macros to

```rust
#[macro_export]
macro_rules! print {
    ($($args:tt)+) => {{
        use core::fmt::Write;
	    // or writeln!
        let _ = write!(::angad_os::uart::Uart::new(0x1000_0000), $($args)+);
    }};
}
```

## Hello, World!

Finally, we can write a hello world.

```rust
#[unsafe(no_mangle)] // this tells rust **not** to change the name of the function when compiling
extern "C" // this tells rust to export this function so that C (or, in this case, assembly) code can call it
fn kmain() {
	Uart::new(0x1000_0000).init();
	println!("Hello, World!");
}
```

The full code, as always, is available [on my Github](https://github.com/onlycs/angados)

[^1]: Pronounced "Risk Five"

[^2]: The main exception here is Apple, which uses ARM all around.

[^3]: \[source needed]

[^4]: I _believe_ there is a Linux kernel build out for it, but there is little distro support for the architecture.

---
title: 'Memory Allocation'
description: 'How we allocate memory for our operating system'
date: 2025-05-20
authors: ['Angad Tendulkar']
tags:
  - projects
  - operating-system
  - rust
---

> 3/27: Grammar

## Revisiting the Project

I've been busy the past few weeks with my robotics competition, and I haven't worked on this project as much as I'd have liked to. Now that I've come back to it, I'll share the goals I have in mind and the steps I'm going to take to get there

### Goals

I definitely want this to do the following

1. Userspace
   I want the Operating System to be able to run userspace code, i.e. not _just_ be a kernel. I want to provide decent hardware system calls to userspace code.
2. FS
   I want a filesystem for the operating system. It should be able to read and write to the `hdd.dsk` file.

I'm also thinking about making a smart home (Matter) swarm using a Raspberry Pi that I have at home running home assistant. It would be nice to get the OS running on a RISC-V microcontroller (with WiFi support) to control devices at home. Also imagine saying "yeah, I set that up myself. The light bulbs actually run an operating system that I made in 11th grade." That would be so badass.

If I end up not doing that, I'll work on

1. Sound
   Sound forwarding to host OS
2. Display Output
   I want a display output for the operating system so that it can draw (some) stuff to the screen. I want the TTY here, too, if there ends up being one
3. Bad Apple
   I want it to render Bad Apple, with sound

### Assistance

Obviously, I've been using Stephen Marz's OS as a baseline for my own. He definitely has different goals than me, however[^1], so I'm not going to be sticking to his as closely as I am right now. There are a couple of things in the project right now that I don't yet know how to do[^2] but I should be fine not replacing them for a while.

That being said, however, it's not like I'm forgoing using Marz's implementation completely. It will probably be used as a research "guide," similar to how I use the internet to do normal programming.

Anyways, back to programming.

## The Stack and the Heap

The heap is a place in memory which the kernel operates. This is in contrast to the stack which is generally faster[^3] and holds most small, fixed-sized data[^4][^5], and is separate for each program. The stack is fairly small[^6], so larger data is generally stored on the heap[^7], along with data that can change size[^8] (think `Vec` or `ArrayList`). However, a pointer[^9] to your data in the heap is always stored on the stack.

## Allocation

We can break up the total memory we have into a couple sections. The first bit is taken up by our bootloader (which was written by Marz in assembly) and our kernel binary. The next bit is taken up by all the stack memory that programs running on the virtual machine will need to use. The remainder (~128MB) is ours to use.

We can break up that memory into 4096 byte chunks, called pages, and reserve the first 32 kilobytes for the page tables[^10][^11], which keeps track of the memory that is currently in use. Every byte in the page tables corresponds sequentially to an actual page, and contains data about whether the page is taken or the last page in that particular allocation[^12]. To allocate some memory, we can loop over every page in the page allocation tables, and check if it is free. If it is free, we can check whether it is the beginning of a free chunk that is greater than or equal to in size of the amount of pages the caller requested by looping some more. If we can't find anything, we can crash because we're out of memory at that point[^13]. The code for that looks something like this:

```rust
pub fn alloc(pages: usize) -> *mut u8 {
    assert!(pages > 0, "Must allocate at least one page of memory");

    unsafe {
        let num_pages = HEAP_SIZE / PAGE_SIZE;
        let ptr = HEAP_START as *mut Page;

        let mut found_free = 0;

        // search for a free chunk that has enough pages
        for page in 0..num_pages - pages {
            if !(*ptr.add(page)).is_taken() {
                found_free += 1;
            } else {
                found_free = 0;
            }

            if found_free < pages {
                continue;
            }

            // page is currently the last page
            let start_page = page + 1 - pages;

            // once found, make sure each page is marked non-free
            for allocate in start_page..page {
                (*ptr.add(allocate)).reset(PageFlags::TAKEN);
            }

            // mark the last page as taken and last
            (*ptr.add(page)).reset(PageFlags::TAKEN | PageFlags::LAST);

            // convert to a pointer. ALLOC_START is the start of usable memory
            // (before that is for the page tables)
            return (ALLOC_START + PAGE_SIZE * start_page) as *mut u8;
        }
    }

    panic!("Out of memory");
}
```

### Deallocation

We basically do that entire thing in reverse:

```rust
pub fn dealloc(ptr: *mut u8) {
    assert!(!ptr.is_null(), "Tried to deallocate a null pointer");

    unsafe {
        // convert from pointer to page index
        let addr = HEAP_START + (ptr as usize - ALLOC_START) / PAGE_SIZE;

        // catch in case we try to write outside of page area
        assert!(
            addr >= HEAP_START && addr < ALLOC_START,
            "Tried to deallocate an address which was out of range"
        );

        // keep clearing until we hit last bit
        let mut p = addr as *mut Page;
        while (*p).is_taken() && !(*p).is_last() {
            (*p).clear();
            p = p.add(1);
        }

        // do a check
        assert!(
            (*p).is_last(),
            "Possible double-free: not taken bit found before last bit"
        );

        // clear last bit
        (*p).clear();
    }
}
```

As always, all the code is [on GitHub](https://github.com/onlycs/angados)

Also Madiha says "hi!"

[^1]: He actually wants to make a proper OS. I know, crazy.

[^2]: Mostly consisting of different programming languages to load in my Rust

[^3]: The memory itself isn't faster, but heap memory requires the operating system to go through an allocation step which can be expensive

[^4]: All numbers except your languages `BigInt` and `BigFloat`, fixed-sized arrays (in Rust at least), characters, strings. Most languages also let you choose to allocate your data on the heap instead if you want, but a pointer to the heap is always stored in the stack to access this data.

[^5]: Strings in rust are sometimes™ stored on the stack, depending on what string type you use (yes there are multiple, yes it's confusing until you learn the differences and then it makes sense).

[^6]: If I recall correctly, 8MB on modern Linux systems, less for Windows. It's configurable, on Linux at least.

[^7]: I'm talking images, videos, etc that is stored there for processing

[^8]: I have never seen growable/shrinkable data structures on the stack.

[^9]: A pointer is a number that corresponds to the place in memory which some data is stored. You can use that number to access your data (which is itself stored elsewhere).

[^10]: Also known as: memory allocation tables, allocation tables, page allocation tables.

[^11]: Not to be confused with: filesystem tables. We use tables for a lot of things and these are for the pages.

[^12]: I actually plan to store more data here. I believe the MMU requires the full 8 bytes to store more security information (i.e. userspace stuff) but that's out of scope for today

[^13]: Even though we still have _some_ free space, it's impractical since you can't defragment memory like you can storage when you have direct control over everything holding access to a file.

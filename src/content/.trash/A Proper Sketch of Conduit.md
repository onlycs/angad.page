---
title: A Proper Sketch of Conduit
description: Consider designing how it will work before making it
date: 2026-03-21
tags:
  - android
  - linux
  - projects
  - design
  - conduit
---
## The Idea
I've had an idea recently for a cross-platform alternative/port to the kind of interoperability iOS devices have with Macs. I'll likely be porting it to just Android and Linux to start but as time goes on I'd like to get to supporting Microslop [[KBNT|assuming I don't trigger an antivirus or something like that]]. 
## Server
The plan is a WebRTC server so we can swap over to peer-to-peer quickly. 

Fun fact: I spent around 45 minutes designing my own handshake (like, with crypto) and then I realized I could just use the Signal protocol. God bless those nerds fr.

Everything else can just be binary message packets (`bytemuck` is what I'm looking for iirc).
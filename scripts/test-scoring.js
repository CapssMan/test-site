#!/usr/bin/env node
"use strict";

// Stage 10A deliberately removed answer keys and scoring from the public client.
// Keep the historical entry point, but route it to the authoritative backend
// harness so existing CI commands continue to test 0/80/100%, forged score-field
// rejection, telemetry advisory behavior and the exact CA 40/80 manifest.
require("./test-backend-scoring.js");

console.log("Historical scoring entry point now verifies authoritative backend scoring: OK");

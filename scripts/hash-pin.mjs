#!/usr/bin/env node
// Makes the PIN_HASH value for your environment variables.
//
//   npm run hash-pin
//
// It asks for your PIN (typing is hidden), and prints:
//   PIN_HASH=...        a bcrypt hash of the PIN, base64-encoded so the "$" signs
//                       in bcrypt hashes don't get mangled by .env files
//   SESSION_SECRET=...  a fresh random secret for signing the login cookie
//                       (only needed once; changing it locks every device)
//
// Your PIN itself is never saved or printed.

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { stdin, stdout, exit } from "node:process";

function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    if (!stdin.isTTY) {
      // Piped input (e.g. in scripts): read one line.
      let buf = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (d) => (buf += d));
      stdin.on("end", () => resolve(buf.split(/\r?\n/)[0] ?? ""));
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") {
          stdout.write("\n");
          exit(130); // Ctrl+C
        }
        if (c === "\u007f" || c === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (c >= " ") {
          value += c;
          stdout.write("•");
        }
      }
    };
    stdin.on("data", onData);
  });
}

const pin = (await askHidden("Type your new PIN: ")).trim();
if (pin.length < 4) {
  console.error("Use at least 4 characters (6 or more digits is better).");
  exit(1);
}
if (stdin.isTTY) {
  const again = (await askHidden("Type it again: ")).trim();
  if (again !== pin) {
    console.error("The two PINs don't match. Nothing was changed.");
    exit(1);
  }
}
if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
  console.warn("\nWarning: that PIN is very easy to guess. Consider a less obvious one.\n");
}

const hash = await bcrypt.hash(pin, 12);
const encoded = Buffer.from(hash, "utf8").toString("base64");

console.log("\nAdd these to .env.local (for your computer) and to Vercel → Settings → Environment Variables:\n");
console.log(`PIN_HASH=${encoded}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
console.log("\nKeep SESSION_SECRET the same afterwards; only replace PIN_HASH when you change your PIN.");

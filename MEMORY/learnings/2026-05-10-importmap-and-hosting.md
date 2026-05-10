# Payload ImportMap + Hosting: Hard Lessons

Date: 2026-05-10

## The blank admin screen

Spent hours debugging a blank admin panel, blaming Netlify, then Vercel, then Next.js 16 vs 15. The actual cause: `importMap.js` was an empty `{}` placeholder written during scaffolding.

**Fix:** `npx payload generate:importmap` — must run after any collection change. Now integrated into the build script.

**Rule:** Never hand-write Payload generated files. Always use the CLI commands.

## The Netlify detour

Switched from Vercel to Netlify to consolidate hosting (118 existing sites). Netlify's function runtime genuinely can't handle Payload's server actions — this is a real incompatibility, not a config issue. The REST API works fine on Netlify; the admin panel does not.

**Rule:** Payload CMS = Vercel. Tools = Netlify. Don't try to consolidate these.

## Build script

Added `payload generate:importmap` to the build command so this can never drift:
```
"build": "payload generate:importmap && next build"
```

## Time cost

~4 hours debugging across two platforms. Root cause was 1 line of code in a scaffolded file.

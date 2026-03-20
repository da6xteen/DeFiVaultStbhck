## Jules VM constraints — READ BEFORE EVERY TASK

The Jules VM cannot run nested Docker containers (overlayfs error).

NEVER run these commands:
- docker-compose up
- docker run
- prisma migrate dev (requires live DB)
- prisma db push (requires live DB)

ALWAYS use these instead for verification:
- npx prisma validate          ✅ works without DB
- DATABASE_URL="postgresql://fake:fake@localhost/fake" npx prisma generate  ✅ works
- npx tsc --noEmit             ✅ works
- npm test (jest with mocks)   ✅ works
- anchor build                 ✅ works (Rust compiler is available)
- anchor test --skip-deploy    ✅ works (local validator lite)

For any step that requires a real database, add a comment in the code
explaining how to run it locally, and skip that verification step.

## Solana / Anchor constraints

Anchor CLI is NOT installed in Jules VM. Do not attempt to install it.

NEVER run:
- anchor build
- anchor test  
- anchor deploy
- solana-test-validator

ALWAYS use instead:
- cargo check                    ✅ verifies Rust compilation
- cargo clippy -- -D warnings    ✅ lint checks
- cargo fmt --check              ✅ formatting

For test files (anchor/tests/*.ts):
- Write them fully and correctly
- Verify TypeScript syntax with: npx tsc --noEmit --allowJs
- Add comment at top of each test file:
  // Tests verified locally with: anchor test --provider.cluster localnet

Acceptance criteria for ALL Anchor programs:
Replace "anchor build passes" → "cargo check passes"
Replace "anchor test passes" → "cargo check + clippy pass, tests written"

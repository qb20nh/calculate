# Calculate

Math crossword game built with Preact and Vite.

## Commands

- `pnpm dev` - start local Vite dev server.
- `pnpm build` - build and prerender production output into `dist/`.
- `pnpm preview` - serve built production output.
- `pnpm test` - run unit tests with coverage.
- `pnpm e2e` - run browser smoke tests against preview output.
- `pnpm quality` - run knip, typecheck, duplicate check, tests, and lint.
- `pnpm audit --prod` - check production dependency advisories.

## Notes

Custom game URLs preserve puzzle settings. Input is capped to keep generation and rendering bounded:
board size `5..20`, total tiles `9..120`, seed length `64`, retry count `0..9999`.

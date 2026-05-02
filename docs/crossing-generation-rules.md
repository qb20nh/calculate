# Crossing Generation Rules

1. Solution shape: use 3 horizontal and 3 vertical valid equations with shared crossing tiles.
2. Tile count: each intended solution must use at most 30 occupied tiles.
3. Search order: start at the theoretical lower bound and enumerate canonical intended solutions by tile count ascending until 1000 unique intended solutions are recorded.
4. Given count: prefer lower initial given counts.
5. Answer shape: intended solution layout must not be forced flush to top or left.
6. Equation forms: use only `left op right = result` or `result = left op right`.
7. Operations: use only `+`, `-`, `*`, `/`; division must be integer-only.
8. Inventory/givens: placeable tiles are always digits `0` through `9`, operators `+`, `-`, `*`, `/`, and four `=` tiles.
9. Number size: intended solution and initial board must contain only numbers from `0` to `99`; no contiguous digit run length may be `3` or greater.
10. Single-digit anchor: each intended formula must contain at least one number from `0` to `9`.
11. Trivial formulas: reject `N+0=N`, `N*0=0`, `N*1=N`, `N/N=1`, `N-0=N`, `N-N=0`, `N/1=N`.
12. Formula uniqueness: all 6 intended formulas must be mathematically unique, including reversed or commuted equivalents.
13. Initial board: reject boards that are already solved, have a trivial visible formula, or expose a direct one-missing compute form like `left op right = ?` or `left op right ? result`.
14. Difficulty order: score by estimated human cognitive effort only; scores must increase exponentially, and stage 9 must be `10x` harder than stage 1 with up to `10%` margin of error.

## Search Findings

- Searching 22 through 26 occupied solution tiles found no 22-tile levels before advancing, found 1000 canonical intended solutions at 23 tiles, and produced a valid 9-stage difficulty curve with 23 solution tiles, 5 givens, and final/first difficulty ratio `10.01x`.

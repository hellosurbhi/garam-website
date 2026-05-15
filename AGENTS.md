# Global Agent Instructions

## Branch Safety

- Never commit or push while on `main` or `master`.
- Before any `git add`, `git commit`, or `git push`, check the current branch.
- If the branch is `main` or `master`, create or switch to a feature branch first.
- If work lands on `main` by accident, stop and confirm the recovery plan before pushing anything else.

## Working Rules

- Prefer the repository's existing patterns and local helpers.
- Update `CHANGELOG.md` for meaningful changes.
- Record unrelated discovered bugs in `BUGS.md`.
- Record corrected mistakes in `LESSONS.md`.
- Run the relevant checks before marking work complete.

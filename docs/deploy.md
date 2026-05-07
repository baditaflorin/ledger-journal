# Deploy

Live site: https://baditaflorin.github.io/ledger-journal/

Repository: https://github.com/baditaflorin/ledger-journal

GitHub Pages serves the `docs/` directory from the `main` branch.

Manual publish:

```sh
npm install
make lint
make test
make build
git add docs package-lock.json package.json src public scripts Makefile
git commit -m "chore: publish pages build"
git push origin main
```

Rollback:

```sh
git revert <publishing-commit>
git push origin main
```

Custom domains are not configured in v0.1.0. If added later, place `CNAME` in `docs/` and configure a CNAME or ALIAS record to GitHub Pages according to GitHub's current Pages DNS instructions.

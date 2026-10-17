# Maintaining Omarchy Market

The default branch is `master`. Changes go through pull requests, including
changes made by repository administrators. Before merging:

- Keep the branch up to date with `master`.
- Pass `portable (22)`, `portable (24)` and `portable (26)` from GitHub Actions.
- Resolve review conversations.
- Run the relevant native checks locally when changing QML or desktop behavior;
  portable CI cannot validate the installed desktop.

Force pushes and deletion of `master` are blocked. Admin enforcement is enabled.
PRs do not require a second person's approval, so a solo maintainer can merge
checked work. Increase the approval requirement when another active maintainer
can review changes. Review requests and manual reviews remain available.

These are GitHub repository settings, not automatically enforced by this file.
Inspect them under Settings → Branches; do not bypass failed checks to release.
See [GitHub's branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

For releases, update `manifest.json` and `CHANGELOG.md` together and merge the
validated PR before tagging its default-branch commit. Include user-visible
behavior changes and verification limits in release notes. Preserve existing
user settings during local installation checks.

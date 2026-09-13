#!/usr/bin/env bash
#
# The contract quandojs.dev's scaffold expects of `docs/`, checked here.
#
# The site reads a page title, a frontmatter description, and a trailing
# `<!-- card -->` snippet from each `docs/<path>/README.md`. This check runs
# before publication and rejects pages with missing metadata.
#
# The docs root README is deliberately exempt: it is an index for people
# browsing this repo on GitHub, and the site has its own home page, so the
# scaffold does not copy it.
#
# Keep the card pattern below in step with `scaffold-docs.mts` there.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

if [[ ! -d docs ]]; then
  echo "No docs/ directory. Nothing to check."
  exit 0
fi

failures=0

fail() {
  echo "  $1" >&2
  failures=$((failures + 1))
}

while IFS= read -r page; do
  # The docs root index, which the site does not copy.
  if [[ "$page" == "docs/README.md" ]]; then
    continue
  fi

  echo "$page"

  grep --quiet --extended-regexp '^# .+' "$page" ||
    fail "no H1. The site lifts it into the page title."

  # Social descriptions are declared in each page's frontmatter.
  perl -0777 -ne '
    my ($frontmatter) = /\A---\r?\n(.*?)\r?\n---/s;
    my ($description) = ($frontmatter // "") =~ /^description:[ \t]*(.+)$/m;
    $description //= "";
    $description =~ s/^([\x27"])(.*)\1$/$2/;
    $description =~ s/^\s+|\s+$//g;
    exit(length($description) > 0 && length($description) <= 160 ? 0 : 1);
  ' "$page" ||
    fail "no description of 1 to 160 characters in frontmatter."

  # The same pattern scaffold-docs.mts matches with: an HTML comment opening
  # with `card`, wrapping one fenced block.
  perl -0777 -ne '
    exit(/^[^\S\n]*<!--\s*card\s*\n```(\w*)\n([\s\S]*?)\n```\s*-->/m ? 0 : 1)
  ' "$page" ||
    fail "no <!-- card --> block. The site scaffold fails without one."
done < <(find docs -name README.md | sort)

if [[ $failures -gt 0 ]]; then
  echo >&2
  echo "$failures problem(s). See docs/README.md for the contract." >&2
  exit 1
fi

echo
echo "docs/ satisfies the site scaffold's contract."

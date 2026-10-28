#!/bin/sh
# Publish docs/ to the gh-pages branch (GitHub Pages source).
set -e
cd "$(dirname "$0")/.."
git subtree split --prefix docs -b gh-pages-tmp
git push -f origin gh-pages-tmp:gh-pages
git branch -D gh-pages-tmp

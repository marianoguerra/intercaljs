#!/usr/bin/env sh

cat templates/intercal.require.start.js > intercal.require.js
head -n -2 src/intercal.js | tail -n +4 >> intercal.require.js
cat templates/intercal.require.end.js >> intercal.require.js

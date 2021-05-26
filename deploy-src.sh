#!/bin/sh
scp -r ./packages/badanmu/src bin@124.70.83.120:/cygdrive/c/webserver/badanmu/
ssh bin@124.70.83.120 'cd /cygdrive/c/webserver/badanmu/ && npm run build'

#!/bin/sh
APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -x "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" ]; then :; fi
exec gradle "$@"

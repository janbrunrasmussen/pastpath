APP ?= pastpath
VERSION ?= $(shell git rev-parse --short HEAD)
NOW ?= $(shell date +%s)

APP_PATH ?= /usr/local/$(APP)
USER ?= EXAMPLE

LAUNCH_NAME=com.$(USER).$(APP)
LAUNCH_FILE=$(LAUNCH_NAME).plist
LAUNCH_DIR=/Users/$(USER)/Library/LaunchAgents

CONFIG_FILE ?= config.json

build:
	go build -o $(APP) -ldflags "-X main.BuildVersion=$(VERSION)"
.PHONY: build

install: build
	mkdir -p $(APP_PATH)
	cp $(APP) $(APP_PATH)
	cp $(CONFIG_FILE) $(APP_PATH)
	cp -a static $(APP_PATH)
	cp deployment/macos/$(LAUNCH_FILE) $(LAUNCH_DIR)
	launchctl unload $(LAUNCH_DIR)/$(LAUNCH_FILE) || :
	launchctl load $(LAUNCH_DIR)/$(LAUNCH_FILE)
	launchctl start $(LAUNCH_FILE) || :
	sleep 10 && curl -s -o /dev/null -w "%{http_code}" localhost:10000 | grep -q "^20" || (echo "Server not started" && false)
.PHONY: install

update: build
	cp $(APP) $(APP_PATH)
	cp $(CONFIG_FILE) $(APP_PATH)
	cp -a static $(APP_PATH)
	kill $$(pgrep -f "$(APP_PATH)/$(APP)")
	sleep 10 && curl -s -o /dev/null -w "%{http_code}" localhost:10000 | grep -q "^20" || (echo "Server not started" && false)
.PHONY: install

run:
	go run -ldflags "-X main.BuildVersion=$(VERSION)+$(NOW)" *.go --config config.local.json
.PHONY: run

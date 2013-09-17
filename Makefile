JSHINT = node ./node_modules/.bin/jshint
MOCHA = node ./node_modules/.bin/mocha

TESTS = test/*.js
SRC = $(shell find bin lib -type f -name "*.js")

REPORTER ?= spec

dev:
	npm install

clean:
	npm prune

lint:
	$(JSHINT) $(SRC)
	$(JSHINT) $(TESTS)

test:
	$(MOCHA) --reporter $(REPORTER) $(TESTS)

.PHONY: dev clean lint test

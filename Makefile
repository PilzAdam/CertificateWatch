
files := manifest.json *.js *.html icons/*.png _locales/*/messages.json

certificate_watch.xpi: $(files) Makefile
	rm -f certificate_watch.xpi
	zip certificate_watch.xpi $(files)

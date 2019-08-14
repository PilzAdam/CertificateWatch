
files := manifest.json *.js *.html

certificate_watch.xpi: $(files) Makefile
	rm -f certificate_watch.xpi
	zip certificate_watch.xpi $(files) icons/*.png


files := manifest.json *.js *.html

certificate_checker.xpi: $(files) Makefile
	rm -f certificate_checker.xpi
	zip certificate_checker.xpi $(files) icons/*.png

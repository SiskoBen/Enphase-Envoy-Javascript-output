# Enphase-Envoy-Javascript-output

This started out as a proof of concept as there was no existing Homey App that would support my Enphase Envoy (which has a D7 firmware requiring tokens).
Enphase Energy does have shell and python sample code (https://enphase.com/download/accessing-iq-gateway-local-apis-or-local-ui-token-based-authentication) but no JavaScript code (which is what Homey uses).
the file app.js is a working proof of concept to get data from the Local Envoy-S/IQ Gateway using a token that the app.js retreives from Enphase directly.

The file "Envoy2Homey_silent.js" is a Javascript file i now run on a linux/Ubuntu machine which then feeds data from the Envoy-S/IQ Gateway into Homey
Homey has some virtual devices setup and an app installed that is capable to listen to posted JSON from the Javascript to update the virtual devices in a flow.

Note that apparently the logic to get a new token when it expires (which i beleive to be after 72 hours for a normal non-installer Enphase account) is not working so i now have set the linux/ubuntu container to reboot in the nigt every day to force a new authentication token to be retreived.

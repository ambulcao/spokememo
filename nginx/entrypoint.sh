#!/bin/sh
# The nameserver is the Podman or Docker DNS for this network. Resolving on
# each request avoids nginx sticking to a container IP from before a recreate.
resolver=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)
resolver=${resolver:-127.0.0.11}
sed "s/__NGINX_RESOLVER__/${resolver}/" /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'

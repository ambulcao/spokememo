FROM nginx:alpine

# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl

# Create SSL directory
RUN mkdir -p /etc/ssl/private

# Generate self-signed SSL certificate (valid for 10 years)
# For production, replace with real certificates from Let's Encrypt
RUN openssl req -x509 -newkey rsa:4096 \
    -keyout /etc/ssl/private/key.pem \
    -out /etc/ssl/certs/cert.pem \
    -days 3650 \
    -nodes \
    -subj "/C=US/ST=State/L=City/O=SpokeMemo/CN=localhost"

# Set proper permissions
RUN chmod 600 /etc/ssl/private/key.pem && \
    chmod 644 /etc/ssl/certs/cert.pem

# Copy nginx configuration. The entrypoint fills in the network DNS.
COPY nginx.conf /etc/nginx/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
